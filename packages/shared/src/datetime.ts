/**
 * Formátovanie časov udalostí (tréningy, zápasy).
 *
 * Konvencia projektu: čas udalosti sa ukladá ako „nástenný" (wall-clock) čas
 * v UTC komponentoch — t.j. 17:00 zadaných v klube = 17:00Z v databáze
 * (viď recurrence.ts a event-admin-actions). Aby sa zobrazoval rovnaký čas,
 * aký bol zadaný, čítame priamo UTC komponenty (bez konverzie do pásma
 * prehliadača/zariadenia). Funguje rovnako na webe aj v Hermes (mobil),
 * kde je Intl podpora časových pásiem obmedzená.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Čas „HH:MM" udalosti (napr. „17:00"). */
export function formatEventTimeSk(value: string | Date): string {
  const d = new Date(value);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Dátum udalosti v slovenskom tvare „15. 8. 2026". */
export function formatEventDateSk(value: string | Date): string {
  const d = new Date(value);
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

/** Dátum a čas udalosti „15. 8. 2026, 17:00". */
export function formatEventDateTimeSk(value: string | Date): string {
  return `${formatEventDateSk(value)}, ${formatEventTimeSk(value)}`;
}
