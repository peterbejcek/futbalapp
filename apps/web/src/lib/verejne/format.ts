import type { PublicDocumentCategory, PublicEventDto, PublicEventState, PublicTeamDto } from '@fkknv/shared';

/** Záložné pásmo, ak odpoveď API neobsahuje club.timezone. */
export const DEFAULT_TZ = 'Europe/Bratislava';

const tzOf = (tz?: string | null) => tz || DEFAULT_TZ;
const dt = (iso: string, opts: Intl.DateTimeFormatOptions, tz?: string | null) =>
  new Intl.DateTimeFormat('sk-SK', { ...opts, timeZone: tzOf(tz) }).format(new Date(iso));

export const fmtDay = (iso: string, tz?: string | null) => dt(iso, { day: 'numeric' }, tz);
export const fmtMonthShort = (iso: string, tz?: string | null) => dt(iso, { month: 'short', year: 'numeric' }, tz).toUpperCase();
export const fmtMonthOnly = (iso: string, tz?: string | null) => dt(iso, { month: 'short' }, tz).replace('.', '').toUpperCase();
export const fmtTime = (iso: string, tz?: string | null) => dt(iso, { hour: '2-digit', minute: '2-digit' }, tz);
export const fmtDate = (iso: string, tz?: string | null) => dt(iso, { day: 'numeric', month: 'long', year: 'numeric' }, tz);

export const isMatchType = (t: string) => t === 'MATCH' || t === 'TOURNAMENT';

/** Kalendárny dátum YYYY-MM-DD v danom pásme. */
export function dateKey(d: Date, tz?: string | null): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tzOf(tz) }).format(d);
}

/** Mesiac YYYY-MM v danom pásme. */
export const monthKeyOf = (d: Date, tz?: string | null) => dateKey(d, tz).slice(0, 7);

/** Posun dátumu YYYY-MM-DD o `days` dní (čisto kalendárne, bez pásma). */
export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Názov zápasu „Domáci — Hostia“, inak názov udalosti. */
export function eventHeading(e: PublicEventDto): string {
  return isMatchType(e.type) && e.match ? `${e.match.homeName} — ${e.match.awayName}` : e.title;
}

/** Skóre „domáci:hostia“ iba ak je zadané. */
export function eventScore(e: PublicEventDto): string | null {
  const m = e.match;
  return m && m.homeScore != null && m.awayScore != null ? `${m.homeScore}:${m.awayScore}` : null;
}

export const STATE_LABEL: Partial<Record<PublicEventState, string>> = { CANCELLED: 'Zrušený', LIVE: 'Prebieha', FINISHED: 'Odohraný' };

/** Kategórie odvodené z dát (poradie podľa najnižšieho sortOrder družstva). */
export function groupByCategory(teams: PublicTeamDto[]) {
  const map = new Map<string, { code: string; name: string; order: number; teams: PublicTeamDto[] }>();
  for (const t of teams) {
    const g = map.get(t.categoryCode) ?? { code: t.categoryCode, name: t.categoryName, order: t.sortOrder, teams: [] };
    g.order = Math.min(g.order, t.sortOrder);
    g.teams.push(t);
    map.set(t.categoryCode, g);
  }
  const out = [...map.values()].sort((a, b) => a.order - b.order);
  for (const g of out) g.teams.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'sk'));
  return out;
}

/** Dátum YYYY-MM-DD (bez pásma) ako „1. mája 2024“. */
export const fmtPlainDate = (ymd: string) =>
  new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd.slice(0, 10)}T00:00:00Z`));

export function fmtBytes(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'text/plain': 'txt', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Názov súboru na stiahnutie z titulu dokumentu (bez diakritiky) + prípona podľa mimeType. */
export function downloadName(title: string, mimeType: string | null): string {
  const base = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'dokument';
  const ext = mimeType ? EXT[mimeType.toLowerCase()] : undefined;
  return ext ? `${base}.${ext}` : base;
}

export const DOC_CATEGORY_ORDER: PublicDocumentCategory[] = ['CONTRACT', 'SUBSIDY', 'TAX_FORM', 'ANNOUNCEMENT', 'OTHER'];
export const DOC_CATEGORY_LABEL: Record<PublicDocumentCategory, string> = {
  CONTRACT: 'Zmluvy',
  SUBSIDY: 'Dotácie a financovanie',
  TAX_FORM: 'Daňové tlačivá',
  ANNOUNCEMENT: 'Oznamy',
  OTHER: 'Ostatné dokumenty',
};
