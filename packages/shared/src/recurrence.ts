/**
 * Opakované tréningy: napr. každý utorok a piatok 16:00–17:00.
 * weekday: 0 = nedeľa ... 6 = sobota (JS getUTCDay).
 */
export interface RecurrenceInput {
  weekdays: number[]; // napr. [2, 5] = utorok, piatok
  startTime: string; // "16:00"
  endTime?: string; // "17:00"
  from: Date; // odkedy (vrátane)
  until: Date; // dokedy (vrátane) — zvyčajne koniec sezóny
}

export interface Occurrence {
  startAt: Date;
  endAt: Date | null;
}

function parseHhmm(time: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) throw new Error(`Neplatný čas (očakáva HH:MM): ${time}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Neplatný čas: ${time}`);
  return { h, m };
}

/**
 * Vygeneruje konkrétne výskyty tréningu v zadanom rozsahu.
 * Časy sa interpretujú v lokálnom čase klubu (Europe/Bratislava) a ukladajú
 * ako UTC posun +podľa dátumu; pre jednoduchosť tu skladáme UTC z komponentov
 * — server aj klient používajú rovnakú konvenciu pri zobrazovaní.
 */
export function generateOccurrences(input: RecurrenceInput): Occurrence[] {
  if (input.weekdays.length === 0) throw new Error('Vyberte aspoň jeden deň v týždni');
  const start = parseHhmm(input.startTime);
  const end = input.endTime ? parseHhmm(input.endTime) : null;
  const wanted = new Set(input.weekdays);

  const occurrences: Occurrence[] = [];
  const cursor = new Date(Date.UTC(input.from.getUTCFullYear(), input.from.getUTCMonth(), input.from.getUTCDate()));
  const last = new Date(Date.UTC(input.until.getUTCFullYear(), input.until.getUTCMonth(), input.until.getUTCDate()));

  let guard = 0;
  while (cursor <= last && guard < 1000) {
    guard++;
    if (wanted.has(cursor.getUTCDay())) {
      const startAt = new Date(cursor);
      startAt.setUTCHours(start.h, start.m, 0, 0);
      let endAt: Date | null = null;
      if (end) {
        endAt = new Date(cursor);
        endAt.setUTCHours(end.h, end.m, 0, 0);
      }
      occurrences.push({ startAt, endAt });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return occurrences;
}

export const WEEKDAY_LABELS_SK = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
export const WEEKDAY_SHORT_SK = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

/** Predvolená dĺžka udalosti v minútach (tréning 90, zápas podľa kategórie, inak 90). */
export function defaultEventMinutes(type: 'TRAINING' | 'MATCH' | 'TOURNAMENT' | string, categoryCode?: string | null): number {
  if (type === 'TRAINING') return 90;
  if (type === 'TOURNAMENT') return 180;
  switch (categoryCode) {
    case 'U8':
    case 'U9':
      return 60;
    case 'U10':
    case 'U11':
      return 70;
    case 'U13':
      return 80;
    default:
      return 90;
  }
}

/** „HH:MM" + minúty → „HH:MM" (v rámci dňa, max 23:59). */
export function addMinutesToHhmm(time: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return time;
  const total = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
