import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseIssfPlayers } from './issf.parser';
import type { RosterRow } from '../../members/roster-import';

/**
 * Automatické čítanie zoznamu hráčov klubu z ISSF (issf.futbalsfz.sk).
 *
 * ISSF nemá verejné API — ide o prihlásený Wicket systém. Služba sa pokúsi
 * prihlásiť klubovým ISSF kontom (z .env), stiahnuť stránky zoznamu hráčov a
 * rozparsovať ich na RosterRow[] (zdieľané s Excel importom). Prihlasovací tok
 * ISSF (OAuth2/Wicket) sa môže meniť — generický form-login nižšie je najlepší
 * odhad a môže si vyžiadať doladenie podľa reálnej odpovede (preto podrobné logy
 * a konfigurovateľné URL cez .env).
 *
 * Konfigurácia (.env → docker-compose api environment):
 *   ISSF_USERNAME, ISSF_PASSWORD        — klubový ISSF manažér
 *   ISSF_PLAYERS_URL (voliteľné)        — URL zoznamu hráčov klubu
 *   ISSF_LOGIN_URL   (voliteľné)        — prihlasovacia URL
 */

const DEFAULT_PLAYERS_URL =
  'https://issf.futbalsfz.sk/wicket/bookmarkable/sk.tempest.sfz.web.matrika.klub.manager.ZoznamHracovKlubuPage';
const DEFAULT_LOGIN_URL = 'https://issf.futbalsfz.sk/login';
const UA = 'Mozilla/5.0 (fkknv.sk portal; member sync)';

/** Jednoduchý cookie jar (name→value, bez per-host rozlíšenia — SSO v rámci futbalsfz). */
class CookieJar {
  private jar = new Map<string, string>();
  setFrom(res: Response) {
    // Node fetch zlučuje Set-Cookie do jedného reťazca cez getSetCookie()
    const raw: string[] = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const line of raw) {
      const pair = line.split(';')[0];
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq > 0) this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

/** fetch s cookie jarom a ručným sledovaním presmerovaní (kvôli SSO cookies). */
async function cjFetch(
  url: string,
  jar: CookieJar,
  opts: { method?: string; body?: string; headers?: Record<string, string> } = {},
  maxHops = 10,
): Promise<{ res: Response; url: string; body: string }> {
  let current = url;
  let method = opts.method ?? 'GET';
  let body = opts.body;
  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(current, {
      method,
      body,
      redirect: 'manual',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        Cookie: jar.header(),
        ...opts.headers,
      },
    });
    jar.setFrom(res);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, url: current, body: await res.text().catch(() => '') };
      current = new URL(loc, current).toString();
      method = 'GET';
      body = undefined;
      continue;
    }
    return { res, url: res.url || current, body: await res.text() };
  }
  throw new BadRequestException('ISSF: príliš veľa presmerovaní pri prihlásení.');
}

interface HtmlForm {
  action: string;
  inputs: Record<string, string>;
  passwordField: string | null;
  textFields: string[];
}

/** Vytiahne prvý <form> zo stránky (action + hidden/skryté inputy + detekcia polí). */
function parseForm(html: string, baseUrl: string): HtmlForm | null {
  const form = /<form\b[^>]*>[\s\S]*?<\/form>/i.exec(html)?.[0];
  if (!form) return null;
  const actionRaw = /<form\b[^>]*\baction\s*=\s*["']([^"']*)["']/i.exec(form)?.[1] ?? baseUrl;
  const action = new URL(actionRaw || baseUrl, baseUrl).toString();
  const inputs: Record<string, string> = {};
  let passwordField: string | null = null;
  const textFields: string[] = [];
  const inputRe = /<input\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = inputRe.exec(form))) {
    const tag = m[0];
    const name = /\bname\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (!name) continue;
    const type = (/\btype\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? 'text').toLowerCase();
    const value = /\bvalue\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    inputs[name] = value;
    if (type === 'password') passwordField = name;
    else if (type === 'text' || type === 'email') textFields.push(name);
  }
  return { action, inputs, passwordField, textFields };
}

@Injectable()
export class IssfService {
  private readonly logger = new Logger(IssfService.name);

  isConfigured(): boolean {
    return !!(process.env.ISSF_USERNAME && process.env.ISSF_PASSWORD);
  }

  private playersUrl(): string {
    return process.env.ISSF_PLAYERS_URL || DEFAULT_PLAYERS_URL;
  }
  private loginUrl(): string {
    return process.env.ISSF_LOGIN_URL || DEFAULT_LOGIN_URL;
  }

  /** Prihlási sa a vráti naplnený cookie jar. */
  private async login(): Promise<CookieJar> {
    const jar = new CookieJar();
    const username = process.env.ISSF_USERNAME as string;
    const password = process.env.ISSF_PASSWORD as string;

    // 1) otvor prihlasovaciu stránku (nasleduj prípadný redirect na OAuth2)
    const start = await cjFetch(this.loginUrl(), jar);
    const form = parseForm(start.body, start.url);
    if (!form || !form.passwordField) {
      this.logger.warn('ISSF: na prihlasovacej stránke sa nenašiel prihlasovací formulár.');
      throw new BadRequestException('ISSF: prihlasovací formulár sa nenašiel (prihlásenie treba doladiť).');
    }

    // 2) vyplň a odošli (meno = prvé textové pole, heslo = password pole)
    const payload: Record<string, string> = { ...form.inputs };
    const userField = form.textFields[0];
    if (userField) payload[userField] = username;
    payload[form.passwordField] = password;
    const body = new URLSearchParams(payload).toString();
    const after = await cjFetch(form.action, jar, { method: 'POST', body, headers: { Referer: start.url } });

    // hrubá kontrola úspechu: po úspechu väčšinou nie je ďalší password formulár
    if (/type\s*=\s*["']password["']/i.test(after.body) && /chyb|nespr|invalid|hesl/i.test(after.body)) {
      throw new BadRequestException('ISSF: prihlásenie zlyhalo (skontrolujte ISSF_USERNAME/ISSF_PASSWORD).');
    }
    return jar;
  }

  /** Stiahne a rozparsuje zoznam hráčov klubu (vrátane ďalších stránok). */
  async fetchRoster(): Promise<RosterRow[]> {
    if (!this.isConfigured()) {
      throw new BadRequestException('ISSF integrácia nie je nastavená (chýba ISSF_USERNAME / ISSF_PASSWORD).');
    }
    const jar = await this.login();

    const first = await cjFetch(this.playersUrl(), jar);
    if (/type\s*=\s*["']password["']/i.test(first.body)) {
      throw new BadRequestException('ISSF: po prihlásení nie je prístup k zoznamu hráčov (prihlásenie treba doladiť).');
    }
    const pageInfos: Array<{ url: string; body: string }> = [{ url: first.url, body: first.body }];

    // Wicket stránkovanie: pozbieraj odkazy na ďalšie stránky toho istého zoznamu
    const hrefs = new Set<string>();
    const aRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(first.body))) {
      const href = a[1];
      if (href && /ZoznamHracovKlubuPage/i.test(href)) {
        try {
          hrefs.add(new URL(href, first.url).toString());
        } catch {
          /* ignoruj neplatné URL */
        }
      }
    }
    let fetched = 0;
    for (const href of hrefs) {
      if (fetched >= 25) break; // poistka proti slučke
      if (href === first.url) continue;
      try {
        const p = await cjFetch(href, jar);
        pageInfos.push({ url: p.url, body: p.body });
        fetched++;
      } catch {
        /* preskoč nedostupnú stránku */
      }
    }

    // Zoznam hráčov sa v ISSF (Wicket) načítava cez AJAX až po otvorení stránky.
    // Na stránkach zoznamu zavoláme tie isté AJAX requesty — ich odpoveď obsahuje
    // naplnenú tabuľku, ktorú vieme rozparsovať.
    const bodies: string[] = pageInfos.map((p) => p.body);
    for (const p of pageInfos) {
      if (!/ZoznamHracovKlubuPage/i.test(p.url)) continue;
      // DataTable sa napĺňa AJAXom priamo na stránke zoznamu (odkazy sú v atribútoch
      // s entitnými úvodzovkami &#039;)
      bodies.push(...(await this.fetchWicketAjax(p.url, p.body, jar)));
      // + poistka: odoslanie vyhľadávacieho formulára (prázdne filtre = všetci)
      const result = await this.submitSearch(p.url, p.body, jar);
      if (result) {
        bodies.push(result.body);
        bodies.push(...(await this.fetchWicketAjax(result.url, result.body, jar)));
      }
    }

    const rows = parseIssfPlayers(bodies);
    this.logger.log(`ISSF: načítaných ${bodies.length} častí (${pageInfos.length} stránok + AJAX), ${rows.length} hráčov.`);
    if (!rows.length) {
      bodies.forEach((b, i) => this.diagnose(b, i < pageInfos.length ? pageInfos[i]!.url : `ajax#${i}`, i));
      for (const p of pageInfos) if (/ZoznamHracovKlubuPage/i.test(p.url)) this.diagnoseForm(p.body, p.url);
      throw new BadRequestException(
        'ISSF: nenašli sa žiadni hráči (zmenená štruktúra stránky alebo prihlásenie — pozri logy).',
      );
    }
    return rows;
  }

  /**
   * Zavolá Wicket AJAX requesty registrované na stránke (wicketAjaxGet/„u":…) a
   * vráti telá odpovedí. Wicket vracia AJAX len s hlavičkou Wicket-Ajax: true,
   * inak presmeruje na celú stránku.
   */
  private async fetchWicketAjax(pageUrl: string, pageBody: string, jar: CookieJar): Promise<string[]> {
    // Wicket vkladá AJAX volania do atribútov s entitnými úvodzovkami (&#039;),
    // preto najprv dekódujeme HTML entity a až potom hľadáme URL.
    const decoded = pageBody
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
    const baseUrl = /Wicket\.Ajax\.baseUrl\s*=\s*["']([^"']+)["']/i.exec(decoded)?.[1] ?? '';
    const urls = new Set<string>();
    const add = (raw: string | undefined) => {
      if (!raw) return;
      try {
        urls.add(new URL(raw, pageUrl).toString());
      } catch {
        /* ignoruj */
      }
    };
    let m: RegExpExecArray | null;
    const reGet = /wicketAjax(?:Get|Post)\(\s*['"]([^'"]+)['"]/gi;
    while ((m = reGet.exec(decoded))) add(m[1]);
    const reU = /["']u["']\s*:\s*['"]([^'"]+)['"]/gi;
    while ((m = reU.exec(decoded))) add(m[1]);

    this.logger.warn(`ISSF ajax: ${pageUrl} → ${urls.size} AJAX URL: ${[...urls].slice(0, 12).join(' , ')}`);

    const out: string[] = [];
    let n = 0;
    for (const u of urls) {
      if (n >= 12) break;
      n++;
      try {
        const res = await fetch(u, {
          headers: {
            'User-Agent': UA,
            'Wicket-Ajax': 'true',
            'Wicket-Ajax-BaseURL': baseUrl,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'text/xml, */*; q=0.01',
            Referer: pageUrl,
            Cookie: jar.header(),
          },
        });
        jar.setFrom(res);
        out.push(await res.text());
      } catch {
        /* preskoč */
      }
    }
    return out;
  }

  /**
   * Odošle vyhľadávací formulár zoznamu hráčov s prázdnymi filtrami (všetky stavy),
   * čím ISSF vráti stránku s naplnenou tabuľkou hráčov.
   */
  private async submitSearch(
    pageUrl: string,
    pageBody: string,
    jar: CookieJar,
  ): Promise<{ url: string; body: string } | null> {
    // vyber blok práve vyhľadávacieho formulára (action obsahuje vyhladavaniePanel)
    const forms = pageBody.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
    const form = forms.find((f) => /action\s*=\s*["'][^"']*vyhladavaniePanel/i.test(f));
    if (!form) {
      this.logger.warn('ISSF: vyhľadávací formulár sa nenašiel.');
      return null;
    }
    const actionRaw = /<form\b[^>]*\baction\s*=\s*["']([^"']*)["']/i.exec(form)?.[1] ?? '';
    const action = new URL(actionRaw.replace(/&amp;/g, '&'), pageUrl).toString();

    const params = new URLSearchParams();
    const inputRe = /<input\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRe.exec(form))) {
      const tag = m[0];
      const name = /\bname\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (!name) continue;
      const type = (/\btype\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? 'text').toLowerCase();
      const value = /\bvalue\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
      if (type === 'checkbox') {
        // zaškrtni všetky stavy (aj neaktívnych/zahraničie), nech máme kompletný zoznam
        params.append(name, value);
      } else if (type === 'submit') {
        params.append(name, value);
      } else if (type === 'hidden') {
        params.append(name, value);
      } else {
        params.append(name, ''); // prázdne textové filtre = bez obmedzenia
      }
    }
    // select pohlavie → prázdne (obe)
    if (/name\s*=\s*["']pohlavie["']/i.test(form)) params.set('pohlavie', '');

    const bodyStr = params.toString();
    const res = await cjFetch(action, jar, {
      method: 'POST',
      body: bodyStr,
      headers: { Referer: pageUrl },
    });
    const tables = (res.body.match(/<table[\s\S]*?<\/table>/gi) ?? []).length;
    this.logger.warn(`ISSF search: POST ${action} → url=${res.url} tables=${tables}`);
    this.logger.warn(`ISSF search body: ${bodyStr.slice(0, 600)}`);
    // feedback/validačné hlášky
    const feedback = [...res.body.matchAll(/<(?:li|span|div)[^>]*class=["'][^"']*(?:feedback|error|chyb)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|span|div)>/gi)]
      .map((m) => (m[1] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 8);
    this.logger.warn(`ISSF search feedback: ${feedback.join(' | ') || '—'}`);
    // úryvok okolo výsledkovej oblasti
    const idx = res.body.search(/Neboli nájden|záznam|datatable|dataview|zoznam/i);
    if (idx >= 0) {
      this.logger.warn(`ISSF search result snippet: ${res.body.slice(Math.max(0, idx - 300), idx + 1200).replace(/\s+/g, ' ')}`);
    }
    return { url: res.url, body: res.body };
  }

  /** Diagnostika stiahnutej stránky (keď sa nenašli hráči) — pomáha doladiť parser/login. */
  private diagnose(html: string, url: string, index: number) {
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
    const hasPwd = /type\s*=\s*["']password["']/i.test(html);
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    const headerSamples = tables.slice(0, 8).map((t, k) => {
      const firstTr = /<tr[\s\S]*?<\/tr>/i.exec(t)?.[0] ?? '';
      const cells = (firstTr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? [])
        .map((c) => c.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return `#${k}[${cells.join(' | ')}]`;
    });
    this.logger.warn(
      `ISSF diag page ${index}: url=${url} | title="${title}" | pwdForm=${hasPwd} | tables=${tables.length} | ${headerSamples.join(' ')}`,
    );
    if (process.env.ISSF_DEBUG) {
      const snippet = html.replace(/\s+/g, ' ').slice(0, 1500);
      this.logger.warn(`ISSF diag page ${index} snippet: ${snippet}`);
    }
  }

  /** Podrobná diagnostika vyhľadávacieho formulára na stránke zoznamu hráčov. */
  private diagnoseForm(html: string, url: string) {
    const formTags = html.match(/<form\b[^>]*>/gi) ?? [];
    const forms = formTags.map((f) => {
      const action = /\baction\s*=\s*["']([^"']*)["']/i.exec(f)?.[1] ?? '';
      const method = /\bmethod\s*=\s*["']([^"']*)["']/i.exec(f)?.[1] ?? 'get';
      const id = /\bid\s*=\s*["']([^"']*)["']/i.exec(f)?.[1] ?? '';
      return `{id=${id} method=${method} action=${action}}`;
    });
    const inputs = [...html.matchAll(/<input\b[^>]*>/gi)]
      .map((m) => {
        const tag = m[0];
        const name = /\bname\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
        const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? 'text';
        return name ? `${name}:${type}` : null;
      })
      .filter(Boolean)
      .slice(0, 50);
    const buttons = [...html.matchAll(/<(?:button|a)\b[^>]*>(?:[\s\S]{0,40}?)<\/(?:button|a)>/gi)]
      .map((m) => {
        const tag = m[0];
        const name = /\bname\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
        const label = tag.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return /vyhlad|hlad|zobraz|export|excel|filtr|najst|vyhľad/i.test(label) ? `${name}="${label}"` : null;
      })
      .filter(Boolean)
      .slice(0, 20);
    const count = (re: RegExp) => (html.match(re) ?? []).length;
    const counts = `wicketAjaxGet=${count(/wicketAjaxGet/g)} Wicket.Ajax=${count(/Wicket\.Ajax/g)} IFormSubmitListener=${count(/IFormSubmitListener/g)} IBehaviorListener=${count(/IBehaviorListener/g)} IResourceListener=${count(/IResourceListener/g)}`;
    const exportLinks = [...html.matchAll(/\bhref\s*=\s*["']([^"']*)["']/gi)]
      .map((m) => m[1] ?? '')
      .filter((h) => /export|excel|csv|xls|IResourceListener/i.test(h))
      .slice(0, 10);

    this.logger.warn(`ISSF form@${url}: forms=${forms.join(' ')}`);
    this.logger.warn(`ISSF form inputs: ${inputs.join(' , ')}`);
    this.logger.warn(`ISSF form buttons: ${buttons.join(' , ')}`);
    this.logger.warn(`ISSF form counts: ${counts}`);
    this.logger.warn(`ISSF export links: ${exportLinks.join(' , ') || '—'}`);
    const formIdx = html.search(/<form\b/i);
    if (formIdx >= 0) {
      const snippet = html.slice(formIdx, formIdx + 2500).replace(/\s+/g, ' ');
      this.logger.warn(`ISSF form snippet: ${snippet}`);
    }
  }
}
