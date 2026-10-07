import type { MemberStatus } from '@fkknv/shared';
import type { RosterRow } from '../../members/roster-import';

/**
 * Parser zoznamu hráčov klubu z ISSF (issf.futbalsfz.sk, Wicket HTML).
 *
 * ISSF nemá verejné API — stránka renderuje hráčov v HTML tabuľke. Parser nájde
 * tabuľku, ktorá má v hlavičke rozpoznateľné stĺpce (Meno, Priezvisko, …) a
 * z jej riadkov poskladá RosterRow[] (rovnaký tvar ako Excel import, takže
 * downstream logika — párovanie, diff, vytvorenie — je zdieľaná).
 *
 * Ak sa štruktúra ISSF zmení, upravuje sa len tento súbor.
 */

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mapovanie normalizovanej hlavičky stĺpca na pole (vrátane ISSF variantov). */
const HEADER_MAP: Record<string, keyof RosterRow> = {
  meno: 'firstName',
  'krstne meno': 'firstName',
  priezvisko: 'lastName',
  'matersky klub': 'homeClub',
  'hostujuci klub': 'guestClub',
  'klubova prislusnost': 'clubAffiliation',
  'registracne cislo': 'registrationNumber',
  'reg. cislo': 'registrationNumber',
  'registr. cislo': 'registrationNumber',
  'datum narodenia': 'birthDate',
  'nar.': 'birthDate',
  'platnost registracneho preukazu do': 'registrationValidUntil',
  'platnost do': 'registrationValidUntil',
  'reg. preukaz do': 'registrationValidUntil',
  stav: 'status',
  'datum registracie': 'registeredAt',
  'registracia': 'registeredAt',
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const s = value.trim();
  // formáty: 1.2.2015 / 01. 02. 2015 / 2015-02-01 / 1/2/2015
  let m = /(\d{1,2})\s*[.\/]\s*(\d{1,2})\s*[.\/]\s*(\d{4})/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseStatus(value: string | null): MemberStatus {
  const s = norm(value ?? '');
  if (s.startsWith('host')) return 'GUEST';
  if (s.startsWith('aktiv')) return 'ACTIVE';
  if (!s) return 'ACTIVE';
  if (s.startsWith('neaktiv') || s.startsWith('ukonc') || s.startsWith('zrus')) return 'INACTIVE';
  return 'ACTIVE';
}

/** Rozdelí blok HTML tabuľky na riadky a bunky. */
function rows(tableHtml: string): string[][] {
  const trs = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return trs.map((tr) => {
    const cells = tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? [];
    return cells.map((c) => stripTags(c));
  });
}

/**
 * Vytiahne hráčov zo všetkých HTML stránok zoznamu klubu.
 * @param pages HTML jednotlivých stránok (ISSF stránkuje)
 */
export function parseIssfPlayers(pages: string[]): RosterRow[] {
  const out: RosterRow[] = [];
  const seen = new Set<string>();

  for (const html of pages) {
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    for (const table of tables) {
      const trs = rows(table);
      if (trs.length < 2) continue;

      // nájdi hlavičkový riadok (prvý, ktorý namapuje aspoň meno+priezvisko)
      let headerIdx = -1;
      let colToField = new Map<number, keyof RosterRow>();
      for (let i = 0; i < Math.min(trs.length, 3); i++) {
        const headerCells = trs[i];
        if (!headerCells) continue;
        const map = new Map<number, keyof RosterRow>();
        headerCells.forEach((cell, idx) => {
          const field = HEADER_MAP[norm(cell)];
          if (field) map.set(idx, field);
        });
        const fields = new Set(map.values());
        if (fields.has('firstName') && fields.has('lastName')) {
          headerIdx = i;
          colToField = map;
          break;
        }
      }
      if (headerIdx < 0) continue;

      for (let r = headerIdx + 1; r < trs.length; r++) {
        const cells = trs[r];
        if (!cells) continue;
        const raw: Partial<Record<keyof RosterRow, string>> = {};
        for (const [col, field] of colToField) raw[field] = cells[col] ?? '';

        const firstName = raw.firstName?.trim();
        const lastName = raw.lastName?.trim();
        if (!firstName || !lastName) continue;

        const regNum = raw.registrationNumber?.trim() || null;
        const key = regNum ?? `${norm(lastName)}|${norm(firstName)}|${raw.birthDate ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          firstName,
          lastName,
          birthDate: parseDate(raw.birthDate ?? null),
          homeClub: raw.homeClub?.trim() || null,
          guestClub: raw.guestClub?.trim() || null,
          clubAffiliation: raw.clubAffiliation?.trim() || null,
          registrationNumber: regNum,
          registrationValidUntil: parseDate(raw.registrationValidUntil ?? null),
          registeredAt: parseDate(raw.registeredAt ?? null),
          status: parseStatus(raw.status ?? null),
        });
      }
    }
  }

  return out;
}
