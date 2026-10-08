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

/** Cieľové pole; 'fullName' = zlúčený stĺpec „Hráč" (Priezvisko Meno). */
type Col = keyof RosterRow | 'fullName';

/** Mapovanie normalizovanej hlavičky stĺpca na pole (vrátane ISSF variantov). */
const HEADER_MAP: Record<string, Col> = {
  hrac: 'fullName',
  'meno a priezvisko': 'fullName',
  'priezvisko a meno': 'fullName',
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
  'platnost karty': 'registrationValidUntil',
  'platnost karty do': 'registrationValidUntil',
  'reg. preukaz do': 'registrationValidUntil',
  stav: 'status',
  'datum registracie': 'registeredAt',
  'registracia': 'registeredAt',
};

/** Rozdelí zlúčené meno „Priezvisko Meno" (ISSF) na priezvisko + meno. */
function splitFullName(value: string): { firstName: string; lastName: string } | null {
  const v = value.replace(/\s+/g, ' ').trim();
  if (!v) return null;
  if (v.includes(',')) {
    const [last, first] = v.split(',');
    return { lastName: (last ?? '').trim(), firstName: (first ?? '').trim() };
  }
  const parts = v.split(' ');
  if (parts.length < 2) return { lastName: v, firstName: '' };
  // ISSF uvádza „Meno Priezvisko" — posledné slovo je priezvisko, zvyšok meno
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! };
}

/** Hlavičkové bunky tabuľky — z <thead> (aj bez <tr>), inak z prvého <tr>. */
function headerCells(table: string): string[] {
  const thead = /<thead[\s\S]*?<\/thead>/i.exec(table)?.[0];
  if (thead) {
    const ths = thead.match(/<th[\s\S]*?<\/th>/gi);
    if (ths && ths.length) return ths.map(stripTags);
  }
  const firstTr = /<tr[\s\S]*?<\/tr>/i.exec(table)?.[0] ?? '';
  return (firstTr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(stripTags);
}

/** Dátové riadky tabuľky — z <tbody> (inak celé telo bez hlavičky). */
function bodyRows(table: string): string[][] {
  const hasThead = /<thead[\s\S]*?<\/thead>/i.test(table);
  let scope = table.replace(/<thead[\s\S]*?<\/thead>/i, '');
  const tbody = /<tbody[\s\S]*?<\/tbody>/i.exec(scope)?.[0];
  if (tbody) scope = tbody;
  const trs = scope.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const rowsArr = trs.map((tr) => (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(stripTags));
  // ak hlavička nebola v <thead> ale v prvom <tr>, prvý riadok zahoď
  if (!hasThead && !tbody && rowsArr.length) rowsArr.shift();
  return rowsArr;
}

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
      const headers = headerCells(table);
      if (!headers.length) continue;
      const colToField = new Map<number, Col>();
      headers.forEach((cell, idx) => {
        const field = HEADER_MAP[norm(cell)];
        if (field) colToField.set(idx, field);
      });
      const fields = new Set(colToField.values());
      const hasName = fields.has('fullName') || (fields.has('firstName') && fields.has('lastName'));
      // je to tabuľka hráčov? (meno + aspoň jeden identifikačný stĺpec)
      if (!hasName) continue;

      for (const cells of bodyRows(table)) {
        if (!cells.length) continue;
        const raw: Partial<Record<Col, string>> = {};
        for (const [col, field] of colToField) raw[field] = cells[col] ?? '';

        let firstName = raw.firstName?.trim() ?? '';
        let lastName = raw.lastName?.trim() ?? '';
        if ((!firstName || !lastName) && raw.fullName) {
          const split = splitFullName(raw.fullName);
          if (split) {
            firstName = split.firstName || firstName;
            lastName = split.lastName || lastName;
          }
        }
        if (!lastName) continue; // prázdny/neúplný riadok (napr. „Neboli nájdené…")

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
