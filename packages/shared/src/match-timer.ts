import { z } from 'zod';

/**
 * Časomiera zápasu. Stav sa ukladá na serveri ako časové značky (Match.*At),
 * klient z nich len dopočítava zobrazenie. Pravidlá číslovania minút:
 * - 1. polčas: 1.–N. minúta (N = dĺžka polčasu), potom nadstavenie N+1, N+2…
 * - 2. polčas začína vždy na N+1 (46. minúta pri 45-min. polčase) bez ohľadu
 *   na nadstavenie 1. polčasu; nadstavenie 2. polčasu je 2N+1, 2N+2… (90+1).
 */
export const MATCH_TIMER_PHASES = ['NOT_STARTED', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'FINISHED'] as const;
export type MatchTimerPhase = (typeof MATCH_TIMER_PHASES)[number];

export const MATCH_TIMER_PHASE_LABELS_SK: Record<MatchTimerPhase, string> = {
  NOT_STARTED: 'Pred výkopom',
  FIRST_HALF: '1. polčas',
  HALF_TIME: 'Prestávka',
  SECOND_HALF: '2. polčas',
  FINISHED: 'Koniec zápasu',
};

export const MATCH_TIMER_ACTIONS = ['START_FIRST', 'END_FIRST', 'START_SECOND', 'END_SECOND', 'UNDO', 'RESET'] as const;
export type MatchTimerAction = (typeof MATCH_TIMER_ACTIONS)[number];

export const matchTimerActionSchema = z.object({ action: z.enum(MATCH_TIMER_ACTIONS) });
export type MatchTimerActionInput = z.infer<typeof matchTimerActionSchema>;

export const DEFAULT_HALF_LENGTH_MIN = 45;

export interface MatchTimerState {
  timerPhase: MatchTimerPhase;
  halfLengthMin: number;
  firstHalfStartedAt: string | Date | null;
  firstHalfEndedAt: string | Date | null;
  secondHalfStartedAt: string | Date | null;
  secondHalfEndedAt: string | Date | null;
}

export interface MatchClock {
  phase: MatchTimerPhase;
  /** beží časomiera (1. alebo 2. polčas) */
  running: boolean;
  /** milisekundy od začiatku aktuálneho (alebo naposledy hraného) polčasu */
  halfElapsedMs: number;
  /** minúta do zápisu udalosti (napr. 45 pri 45+2) a nadstavenie (2) */
  minute: number;
  stoppage: number | undefined;
  /** hlavný čas mm:ss (v nadstavení zastavený na konci polčasu, napr. 45:00) */
  clock: string;
  /** čas nadstavenia +mm:ss, ak sa hrá nadstavenie */
  stoppageClock: string | null;
  /** zápis minúty, napr. „23'“, „45+2'“, „90+1'“ */
  label: string;
}

const toMs = (v: string | Date | null | undefined): number | null => (v ? new Date(v).getTime() : null);

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Minúta zápisu pre daný polčas a uplynutý čas v ňom (čistá funkcia).
 * Uplynulých 0:00–0:59 = 1. minúta polčasu.
 */
export function matchMinuteAt(half: 1 | 2, halfElapsedMs: number, halfLengthMin = DEFAULT_HALF_LENGTH_MIN) {
  const len = Math.max(1, Math.trunc(halfLengthMin));
  const inHalf = Math.floor(Math.max(0, halfElapsedMs) / 60_000) + 1;
  const base = half === 1 ? 0 : len;
  if (inHalf <= len) return { minute: base + inHalf, stoppage: undefined as number | undefined };
  return { minute: base + len, stoppage: inHalf - len };
}

export function formatMatchMinute(minute: number, stoppage?: number | null): string {
  return stoppage ? `${minute}+${stoppage}'` : `${minute}'`;
}

/** Stav časomiery v čase `nowMs` (default teraz). */
export function computeMatchClock(t: MatchTimerState, nowMs: number = Date.now()): MatchClock {
  const len = Math.max(1, Math.trunc(t.halfLengthMin || DEFAULT_HALF_LENGTH_MIN));
  const lenMs = len * 60_000;
  const s1 = toMs(t.firstHalfStartedAt);
  const e1 = toMs(t.firstHalfEndedAt);
  const s2 = toMs(t.secondHalfStartedAt);
  const e2 = toMs(t.secondHalfEndedAt);
  const phase = t.timerPhase;

  let half: 1 | 2 | null = null;
  let elapsed = 0;
  if (phase === 'FIRST_HALF' && s1 != null) {
    half = 1;
    elapsed = nowMs - s1;
  } else if (phase === 'HALF_TIME' && s1 != null) {
    half = 1;
    elapsed = (e1 ?? nowMs) - s1;
  } else if (phase === 'SECOND_HALF' && s2 != null) {
    half = 2;
    elapsed = nowMs - s2;
  } else if (phase === 'FINISHED') {
    if (s2 != null) {
      half = 2;
      elapsed = (e2 ?? nowMs) - s2;
    } else if (s1 != null) {
      half = 1;
      elapsed = (e1 ?? nowMs) - s1;
    }
  }
  elapsed = Math.max(0, elapsed);

  if (half == null) {
    return {
      phase,
      running: false,
      halfElapsedMs: 0,
      minute: 0,
      stoppage: undefined,
      clock: '00:00',
      stoppageClock: null,
      label: "0'",
    };
  }

  const { minute, stoppage } = matchMinuteAt(half, elapsed, len);
  const offset = half === 2 ? lenMs : 0;
  const inStoppage = elapsed >= lenMs;
  return {
    phase,
    running: phase === 'FIRST_HALF' || phase === 'SECOND_HALF',
    halfElapsedMs: elapsed,
    minute,
    stoppage,
    clock: mmss(offset + Math.min(elapsed, lenMs)),
    stoppageClock: inStoppage ? `+${mmss(elapsed - lenMs)}` : null,
    label: formatMatchMinute(minute, stoppage),
  };
}
