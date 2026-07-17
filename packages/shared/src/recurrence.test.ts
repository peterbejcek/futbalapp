import { describe, expect, it } from 'vitest';
import { generateOccurrences } from './recurrence';

describe('generateOccurrences', () => {
  it('utorky a piatky 16:00-17:00 v septembri 2026', () => {
    // september 2026: utorky 1,8,15,22,29 ; piatky 4,11,18,25
    const occ = generateOccurrences({
      weekdays: [2, 5],
      startTime: '16:00',
      endTime: '17:00',
      from: new Date(Date.UTC(2026, 8, 1)),
      until: new Date(Date.UTC(2026, 8, 30)),
    });
    expect(occ).toHaveLength(9);
    expect(occ[0]!.startAt.toISOString()).toBe('2026-09-01T16:00:00.000Z');
    expect(occ[0]!.endAt!.toISOString()).toBe('2026-09-01T17:00:00.000Z');
    // všetky sú utorok(2) alebo piatok(5)
    for (const o of occ) expect([2, 5]).toContain(o.startAt.getUTCDay());
  });

  it('bez endTime nechá endAt null', () => {
    const occ = generateOccurrences({
      weekdays: [1],
      startTime: '18:30',
      from: new Date(Date.UTC(2026, 8, 1)),
      until: new Date(Date.UTC(2026, 8, 14)),
    });
    expect(occ).toHaveLength(2); // pondelky 7, 14
    expect(occ[0]!.endAt).toBeNull();
    expect(occ[0]!.startAt.getUTCHours()).toBe(18);
    expect(occ[0]!.startAt.getUTCMinutes()).toBe(30);
  });

  it('odmietne prázdne dni a neplatný čas', () => {
    const base = { weekdays: [2], startTime: '16:00', from: new Date(), until: new Date() };
    expect(() => generateOccurrences({ ...base, weekdays: [] })).toThrow();
    expect(() => generateOccurrences({ ...base, startTime: '25:00' })).toThrow();
  });
});
