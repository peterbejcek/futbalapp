import type { CategoryCode } from './enums';
import type { EventType } from './enums';

export interface ColorPair {
  bg: string; // veľmi svetlé pozadie
  text: string; // tmavší text pre kontrast
}

/**
 * Výrazné pastelové, navzájom dobre odlíšiteľné farby pre vekové kategórie. Používajú sa všade,
 * kde sa kategória spomína (karty, štítky). Hodnoty sú hex (inline štýl), aby
 * neboli závislé od generovania Tailwind tried.
 */
export const CATEGORY_COLORS: Record<CategoryCode, ColorPair> = {
  U8: { bg: '#7dd3fc', text: '#0369a1' }, // nebeská modrá
  U9: { bg: '#f9a8d4', text: '#9d174d' }, // ružová
  U10: { bg: '#5eead4', text: '#0f766e' }, // tyrkysová
  U11: { bg: '#fcd34d', text: '#92400e' }, // jantárová
  U13: { bg: '#c4b5fd', text: '#5b21b6' }, // fialová
  U15: { bg: '#bef264', text: '#3f6212' }, // limetková
  U17: { bg: '#fdba74', text: '#9a3412' }, // oranžová
  U19: { bg: '#fca5a5', text: '#991b1b' }, // koralová červená
  MUZI: { bg: '#a5b4fc', text: '#3730a3' }, // indigo
};

const NEUTRAL: ColorPair = { bg: '#f1f5f9', text: '#475569' };

/** Farba kategórie podľa kódu (napr. 'U17'); neutrálna pre neznámu. */
export function categoryColor(code: string | null | undefined): ColorPair {
  if (code && code in CATEGORY_COLORS) return CATEGORY_COLORS[code as CategoryCode];
  return NEUTRAL;
}

/** Farby podľa typu udalosti — pre kalendár (tréning vs zápas). */
export const EVENT_TYPE_COLORS: Record<EventType, ColorPair> = {
  TRAINING: { bg: '#e2e8f0', text: '#334155' }, // bridlicová (neutrálna, nekoliduje so žiadnou kategóriou)
  MATCH: { bg: '#dbeafe', text: '#1e40af' }, // modrá
  TOURNAMENT: { bg: '#fef3c7', text: '#92400e' }, // jantárová
  CLUB_EVENT: { bg: '#f3e8ff', text: '#6b21a8' }, // fialová
  PARENT_MEETING: { bg: '#ffe4e6', text: '#9f1239' }, // ružová
};

export function eventTypeColor(type: string | null | undefined): ColorPair {
  if (type && type in EVENT_TYPE_COLORS) return EVENT_TYPE_COLORS[type as EventType];
  return NEUTRAL;
}
