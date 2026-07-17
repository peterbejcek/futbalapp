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
