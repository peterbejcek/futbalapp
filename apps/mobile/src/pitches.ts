import { api } from '@/api';

export interface Pitch {
  id: string;
  name: string;
  surface: string;
}

export interface Occupancy {
  id: string;
  pitchId: string;
  type: string;
  title: string;
  startAt: string;
  endAt: string | null;
  teamName: string | null;
}

export const SURFACE_LABELS: Record<string, string> = {
  PT: 'Prírodná tráva',
  UT: 'Umelá tráva',
  VT: 'Viacúčelový',
  MT: 'Multifunkčný',
  MI: 'Iný',
};

export const fetchPitches = () => api<Pitch[]>('/pitches');

/** Obsadenosť v rozsahu dní (RRRR-MM-DD, vrátane oboch). Časy v API sú „UTC nástenný čas“. */
export const fetchOccupancy = (fromDay: string, toDay: string) =>
  api<Occupancy[]>(`/pitches/occupancy?from=${fromDay}T00:00:00.000Z&to=${toDay}T23:59:59.999Z`);

export const DEFAULT_SLOT_MIN = 90;

export function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToHhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function isHhmm(t: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(t.trim());
}

export function normHhmm(t: string): string {
  const [h, m] = t.trim().split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
export function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

/** Koniec slotu v minútach od polnoci (bez konca sa počíta 90 min, rovnako ako API). */
export function slotRange(o: Occupancy): { s: number; e: number } {
  const s = toMin(hhmm(o.startAt));
  const e = o.endAt && o.endAt.slice(0, 10) === o.startAt.slice(0, 10) ? toMin(hhmm(o.endAt)) : s + DEFAULT_SLOT_MIN;
  return { s, e: Math.min(e, 24 * 60) };
}

/** Voľné okná v rámci [from,to] minút (min. dĺžka 30 min). */
export function freeWindows(items: Occupancy[], from = 8 * 60, to = 22 * 60): Array<{ s: number; e: number }> {
  const busy = items.map(slotRange).sort((a, b) => a.s - b.s);
  const out: Array<{ s: number; e: number }> = [];
  let cur = from;
  for (const b of busy) {
    if (b.s - cur >= 30) out.push({ s: cur, e: Math.min(b.s, to) });
    cur = Math.max(cur, b.e);
  }
  if (to - cur >= 30) out.push({ s: cur, e: to });
  return out;
}
