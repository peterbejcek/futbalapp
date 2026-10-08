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

    const rows = parseIssfPlayers(pageInfos.map((p) => p.body));
    this.logger.log(`ISSF: načítaných ${pageInfos.length} stránok, ${rows.length} hráčov.`);
    if (!rows.length) {
      pageInfos.forEach((p, i) => this.diagnose(p.body, p.url, i));
      throw new BadRequestException(
        'ISSF: nenašli sa žiadni hráči (zmenená štruktúra stránky alebo prihlásenie — pozri logy).',
      );
    }
    return rows;
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
}
