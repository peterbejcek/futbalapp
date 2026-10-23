import { describe, expect, it } from 'vitest';
import { matchPitch, planPitchAssignment, type PlanEvent } from './pitch-assign.plan';

const pitches = [
  { id: 'p1', name: 'Ihrisko KNV – hlavné' },
  { id: 'p2', name: 'Umelka Šaca' },
];
const d = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 3, h, m));
const ev = (id: string, over: Partial<PlanEvent>): PlanEvent => ({
  id, type: 'TRAINING', title: id, startAt: d(16), endAt: d(17), location: 'Ihrisko KNV – hlavné', pitchId: null, isHome: null, ...over,
});
const now = new Date(Date.UTC(2026, 9, 1));

describe('matchPitch', () => {
  it('presná zhoda bez diakritiky a veľkosti písmen, jediná čiastočná zhoda, mapovanie', () => {
    expect(matchPitch('umelka saca', pitches)?.id).toBe('p2');
    expect(matchPitch('Šaca', pitches)?.id).toBe('p2');
    expect(matchPitch('Ihrisko', pitches)?.id).toBe('p1');
    expect(matchPitch('Ihrisko KNV', pitches, { 'Ihrisko KNV': 'Umelka Šaca' })?.id).toBe('p2');
    expect(matchPitch('Neznáme', pitches)).toBeNull();
  });
  it('nejednoznačná čiastočná zhoda sa nepriradí', () => {
    expect(matchPitch('KNV', [{ id: 'a', name: 'KNV hore' }, { id: 'b', name: 'KNV dole' }])).toBeNull();
  });
});

describe('planPitchAssignment', () => {
  it('priradí tréning a domáci zápas, preskočí zápas vonku, minulé a demo-bez miesta', () => {
    const plan = planPitchAssignment({
      pitches, reserved: [], now,
      events: [
        ev('t1', {}),
        ev('m1', { type: 'MATCH', isHome: true, startAt: d(10), endAt: null }),
        ev('m2', { type: 'MATCH', isHome: false, startAt: d(12), endAt: null }),
        ev('old', { startAt: new Date(Date.UTC(2026, 8, 1, 16)), endAt: new Date(Date.UTC(2026, 8, 1, 17)) }),
        ev('noloc', { location: null }),
      ],
    });
    expect(plan.assignments.map((a) => a.eventId).sort()).toEqual(['m1', 't1']);
  });
  it('rovnaký čas je povolený, čiastočný prekryv je konflikt, existujúca rezervácia sa rešpektuje', () => {
    const plan = planPitchAssignment({
      pitches, now,
      reserved: [{ title: 'Rezervované', pitchId: 'p1', startAt: d(18), endAt: d(19) }],
      events: [
        ev('a', { title: 'U13A' }),
        ev('b', { title: 'U13B' }), // rovnaký čas ako a → OK
        ev('c', { title: 'U15', startAt: d(16, 30), endAt: d(17, 30) }), // čiastočný prekryv → konflikt
        ev('d', { title: 'U11', startAt: d(18, 30), endAt: d(19, 30) }), // prekryv s existujúcou
      ],
    });
    expect(plan.assignments.map((a) => a.eventId)).toEqual(['a', 'b']);
    expect(plan.conflicts.map((c) => c.eventId)).toEqual(['c', 'd']);
  });
  it('nespárované texty sa spočítajú', () => {
    const plan = planPitchAssignment({ pitches, reserved: [], now, events: [ev('x', { location: 'Iné ihrisko' }), ev('y', { location: 'Iné ihrisko' })] });
    expect(plan.unmatched.get('Iné ihrisko')).toBe(2);
  });
});
