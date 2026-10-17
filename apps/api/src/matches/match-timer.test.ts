import { describe, expect, it } from 'vitest';
import { computeMatchClock, matchMinuteAt, type MatchTimerState } from '@fkknv/shared';
import { applyTimerAction, type TimerFields } from './match-timer';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 17, 10, 0, 0);

function state(p: Partial<MatchTimerState>): MatchTimerState {
  return {
    timerPhase: 'NOT_STARTED',
    halfLengthMin: 45,
    firstHalfStartedAt: null,
    firstHalfEndedAt: null,
    secondHalfStartedAt: null,
    secondHalfEndedAt: null,
    ...p,
  };
}

describe('matchMinuteAt', () => {
  it('1. polčas: prvá minúta je 1., 44:59 je 45.', () => {
    expect(matchMinuteAt(1, 0)).toEqual({ minute: 1, stoppage: undefined });
    expect(matchMinuteAt(1, 44 * MIN + 59_000)).toEqual({ minute: 45, stoppage: undefined });
  });
  it('1. polčas: nadstavenie 45+N', () => {
    expect(matchMinuteAt(1, 45 * MIN)).toEqual({ minute: 45, stoppage: 1 });
    expect(matchMinuteAt(1, 47 * MIN + 30_000)).toEqual({ minute: 45, stoppage: 3 });
  });
  it('2. polčas začína 46. minútou', () => {
    expect(matchMinuteAt(2, 0)).toEqual({ minute: 46, stoppage: undefined });
    expect(matchMinuteAt(2, 20 * MIN + 5_000)).toEqual({ minute: 66, stoppage: undefined });
  });
  it('2. polčas: nadstavenie 90+N', () => {
    expect(matchMinuteAt(2, 45 * MIN + 10_000)).toEqual({ minute: 90, stoppage: 1 });
  });
  it('kratší polčas (30 min)', () => {
    expect(matchMinuteAt(2, 0, 30)).toEqual({ minute: 31, stoppage: undefined });
    expect(matchMinuteAt(2, 31 * MIN, 30)).toEqual({ minute: 60, stoppage: 2 });
  });
});

describe('computeMatchClock', () => {
  it('2. polčas je 46. minúta aj po dlhom nadstavení 1. polčasu', () => {
    const s = state({
      timerPhase: 'SECOND_HALF',
      firstHalfStartedAt: new Date(T0),
      firstHalfEndedAt: new Date(T0 + 51 * MIN), // 45+6
      secondHalfStartedAt: new Date(T0 + 66 * MIN),
    });
    const c = computeMatchClock(s, T0 + 66 * MIN + 30_000);
    expect(c.minute).toBe(46);
    expect(c.stoppage).toBeUndefined();
    expect(c.clock).toBe('45:30');
    expect(c.label).toBe("46'");
  });
  it('nadstavenie 1. polčasu sa zobrazuje 45:00 +mm:ss', () => {
    const s = state({ timerPhase: 'FIRST_HALF', firstHalfStartedAt: new Date(T0) });
    const c = computeMatchClock(s, T0 + 46 * MIN + 12_000);
    expect(c.clock).toBe('45:00');
    expect(c.stoppageClock).toBe('+01:12');
    expect(c.label).toBe("45+2'");
    expect(c.running).toBe(true);
  });
  it('prestávka drží čas konca 1. polčasu', () => {
    const s = state({
      timerPhase: 'HALF_TIME',
      firstHalfStartedAt: new Date(T0),
      firstHalfEndedAt: new Date(T0 + 47 * MIN),
    });
    const c = computeMatchClock(s, T0 + 60 * MIN);
    expect(c.running).toBe(false);
    expect(c.label).toBe("45+3'");
  });
  it('nadstavenie 2. polčasu 90+N', () => {
    const s = state({
      timerPhase: 'SECOND_HALF',
      firstHalfStartedAt: new Date(T0),
      firstHalfEndedAt: new Date(T0 + 45 * MIN),
      secondHalfStartedAt: new Date(T0 + 60 * MIN),
    });
    const c = computeMatchClock(s, T0 + 60 * MIN + 46 * MIN + 1_000);
    expect(c.clock).toBe('90:00');
    expect(c.label).toBe("90+2'");
  });
  it('pred výkopom je 0', () => {
    expect(computeMatchClock(state({}), T0).minute).toBe(0);
  });
});

describe('applyTimerAction', () => {
  const empty: TimerFields = {
    timerPhase: 'NOT_STARTED',
    firstHalfStartedAt: null,
    firstHalfEndedAt: null,
    secondHalfStartedAt: null,
    secondHalfEndedAt: null,
  };
  it('celý priebeh výkop → prestávka → 2. polčas → koniec', () => {
    let cur = empty;
    for (const [action, phase] of [
      ['START_FIRST', 'FIRST_HALF'],
      ['END_FIRST', 'HALF_TIME'],
      ['START_SECOND', 'SECOND_HALF'],
      ['END_SECOND', 'FINISHED'],
    ] as const) {
      const r = applyTimerAction(cur, action, new Date(T0));
      expect(r.ok).toBe(true);
      if (r.ok) cur = r.next;
      expect(cur.timerPhase).toBe(phase);
    }
    expect(cur.secondHalfEndedAt).not.toBeNull();
  });
  it('neplatný prechod vráti chybu', () => {
    expect(applyTimerAction(empty, 'START_SECOND', new Date(T0)).ok).toBe(false);
    expect(applyTimerAction(empty, 'UNDO', new Date(T0)).ok).toBe(false);
  });
  it('UNDO vráti prestávku späť do 1. polčasu', () => {
    const r = applyTimerAction(
      { ...empty, timerPhase: 'HALF_TIME', firstHalfStartedAt: new Date(T0), firstHalfEndedAt: new Date(T0 + 45 * MIN) },
      'UNDO',
      new Date(T0),
    );
    expect(r.ok && r.next.timerPhase).toBe('FIRST_HALF');
    expect(r.ok && r.next.firstHalfEndedAt).toBeNull();
  });
});
