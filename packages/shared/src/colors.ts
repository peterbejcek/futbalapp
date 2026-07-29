import type { CategoryCode } from './enums';
import type { EventType } from './enums';

export interface ColorPair {
  bg: string; // veľmi svetlé pozadie
  text: string; // tmavší text pre kontrast
}

/**
 * Veľmi svetlé, navzájom ladiace farby pre vekové kategórie. Používajú sa všade,
 * kde sa kategória spomína (karty, štítky). Hodnoty sú hex (inline štýl), aby
 * neboli závislé od generovania Tailwind tried.
 */
export const CATEGORY_COLORS: Record<CategoryCode, ColorPair> = {
  U8: { bg: '#e0f2fe', text: '#075985' }, // sky
  U9: { bg: '#cffafe', text: '#155e75' }, // cyan
  U10: { bg: '#ccfbf1', text: '#115e59' }, // teal
  U11: { bg: '#dcfce7', text: '#166534' }, // green
  U13: { bg: '#ecfccb', text: '#3f6212' }, // lime
  U15: { bg: '#fef9c3', text: '#854d0e' }, // yellow
  U17: { bg: '#ffedd5', text: '#9a3412' }, // orange
  U19: { bg: '#ffe4e6', text: '#9f1239' }, // rose
  MUZI: { bg: '#e0e7ff', text: '#3730a3' }, // indigo
};

const NEUTRAL: ColorPair = { bg: '#f1f5f9', text: '#475569' };

/** Farba kategórie podľa kódu (napr. 'U17'); neutrálna pre neznámu. */
export function categoryColor(code: string | null | undefined): ColorPair {
  if (code && code in CATEGORY_COLORS) return CATEGORY_COLORS[code as CategoryCode];
  return NEUTRAL;
}

/** Farby podľa typu udalosti — pre kalendár (tréning vs zápas). */
export const EVENT_TYPE_COLORS: Record<EventType, ColorPair> = {
  TRAINING: { bg: '#dcfce7', text: '#166534' }, // zelená
  MATCH: { bg: '#dbeafe', text: '#1e40af' }, // modrá
  TOURNAMENT: { bg: '#fef3c7', text: '#92400e' }, // jantárová
  CLUB_EVENT: { bg: '#f3e8ff', text: '#6b21a8' }, // fialová
};

export function eventTypeColor(type: string | null | undefined): ColorPair {
  if (type && type in EVENT_TYPE_COLORS) return EVENT_TYPE_COLORS[type as EventType];
  return NEUTRAL;
}
