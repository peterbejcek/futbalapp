import { describe, expect, it } from 'vitest';
import { categoryForBirthDate, defaultCategoryRules, seasonForDate, seasonFromStartYear } from './season';

describe('seasonForDate', () => {
  it('júl 2026 patrí do sezóny 2026/2027', () => {
    expect(seasonForDate(new Date(Date.UTC(2026, 6, 1))).name).toBe('2026/2027');
  });
  it('jún 2026 patrí ešte do sezóny 2025/2026', () => {
    expect(seasonForDate(new Date(Date.UTC(2026, 5, 30))).name).toBe('2025/2026');
  });
  it('sezóna 2026/2027 beží 1.7.2026 – 30.6.2027', () => {
    const s = seasonFromStartYear(2026);
    expect(s.startDate.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(s.endDate.toISOString().slice(0, 10)).toBe('2027-06-30');
  });
});

describe('defaultCategoryRules + categoryForBirthDate (sezóna 2026/2027, ref. rok 2027)', () => {
  const rules = defaultCategoryRules(2026);

  const cases: Array<[string, string]> = [
    ['2020-05-10', 'U8'], // 7-ročný → najmladšia kategória
    ['2019-01-01', 'U8'],
    ['2018-12-31', 'U9'],
    ['2017-06-15', 'U10'],
    ['2016-02-02', 'U11'],
    ['2015-09-09', 'U13'], // U12 klub nemá → spadá do U13
    ['2014-03-03', 'U13'],
    ['2013-01-01', 'U15'],
    ['2012-12-31', 'U15'],
    ['2011-07-07', 'U17'],
    ['2010-01-01', 'U17'],
    ['2009-05-05', 'U19'],
    ['2008-01-01', 'U19'],
    ['2007-12-31', 'MUZI'],
    ['1990-01-01', 'MUZI'],
  ];

  it.each(cases)('narodený %s → %s', (birth, expected) => {
    expect(categoryForBirthDate(new Date(birth), rules)).toBe(expected);
  });

  it('pravidlá na seba nadväzujú bez dier', () => {
    for (let year = 1980; year <= 2022; year++) {
      const cat = categoryForBirthDate(new Date(Date.UTC(year, 0, 1)), rules);
      expect(cat, `ročník ${year} nemá kategóriu`).not.toBeNull();
    }
  });
});
