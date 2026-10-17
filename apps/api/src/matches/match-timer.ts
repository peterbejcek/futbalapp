import type { MatchTimerAction, MatchTimerPhase } from '@fkknv/shared';

export interface TimerFields {
  timerPhase: MatchTimerPhase;
  firstHalfStartedAt: Date | null;
  firstHalfEndedAt: Date | null;
  secondHalfStartedAt: Date | null;
  secondHalfEndedAt: Date | null;
}

/**
 * Prechod časomiery (čistá funkcia). Vráti nové hodnoty polí alebo chybu,
 * ak akcia v danej fáze nedáva zmysel.
 */
export function applyTimerAction(
  cur: TimerFields,
  action: MatchTimerAction,
  now: Date,
): { ok: true; next: TimerFields } | { ok: false; error: string } {
  const next: TimerFields = { ...cur };
  switch (action) {
    case 'START_FIRST':
      if (cur.timerPhase !== 'NOT_STARTED') return { ok: false, error: 'Časomiera už bola spustená' };
      next.timerPhase = 'FIRST_HALF';
      next.firstHalfStartedAt = now;
      return { ok: true, next };
    case 'END_FIRST':
      if (cur.timerPhase !== 'FIRST_HALF') return { ok: false, error: 'Prestávka je možná len počas 1. polčasu' };
      next.timerPhase = 'HALF_TIME';
      next.firstHalfEndedAt = now;
      return { ok: true, next };
    case 'START_SECOND':
      if (cur.timerPhase !== 'HALF_TIME') return { ok: false, error: '2. polčas možno začať len z prestávky' };
      next.timerPhase = 'SECOND_HALF';
      next.secondHalfStartedAt = now;
      return { ok: true, next };
    case 'END_SECOND':
      if (cur.timerPhase === 'FINISHED') return { ok: false, error: 'Zápas je už ukončený' };
      if (cur.timerPhase === 'NOT_STARTED') return { ok: false, error: 'Časomiera ešte nebola spustená' };
      next.timerPhase = 'FINISHED';
      if (cur.timerPhase === 'FIRST_HALF') next.firstHalfEndedAt = now;
      if (cur.timerPhase === 'SECOND_HALF') next.secondHalfEndedAt = now;
      return { ok: true, next };
    case 'UNDO':
      // vráti posledný krok (napr. omylom kliknutá prestávka)
      switch (cur.timerPhase) {
        case 'NOT_STARTED':
          return { ok: false, error: 'Nie je čo vrátiť' };
        case 'FIRST_HALF':
          return { ok: true, next: { ...next, timerPhase: 'NOT_STARTED', firstHalfStartedAt: null } };
        case 'HALF_TIME':
          return { ok: true, next: { ...next, timerPhase: 'FIRST_HALF', firstHalfEndedAt: null } };
        case 'SECOND_HALF':
          return { ok: true, next: { ...next, timerPhase: 'HALF_TIME', secondHalfStartedAt: null } };
        case 'FINISHED':
          if (cur.secondHalfStartedAt) return { ok: true, next: { ...next, timerPhase: 'SECOND_HALF', secondHalfEndedAt: null } };
          return { ok: true, next: { ...next, timerPhase: 'FIRST_HALF', firstHalfEndedAt: null } };
      }
      return { ok: false, error: 'Neznáma fáza' };
    case 'RESET':
      return {
        ok: true,
        next: {
          timerPhase: 'NOT_STARTED',
          firstHalfStartedAt: null,
          firstHalfEndedAt: null,
          secondHalfStartedAt: null,
          secondHalfEndedAt: null,
        },
      };
  }
  return { ok: false, error: 'Neznáma akcia' };
}
