import type { CategoryCode } from './enums';

/**
 * Sezóna klubu beží od 1. júla do 30. júna (napr. 2026/2027 = 07/2026 – 06/2027).
 */
export interface SeasonBounds {
  /** Kalendárny rok, v ktorom sezóna začína (2026 pre sezónu 2026/2027). */
  startYear: number;
  name: string;
  startDate: Date;
  endDate: Date;
}

export function seasonForDate(date: Date): SeasonBounds {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 6 ? year : year - 1; // júl = index 6
  return seasonFromStartYear(startYear);
}

export function seasonFromStartYear(startYear: number): SeasonBounds {
  return {
    startYear,
    name: `${startYear}/${startYear + 1}`,
    startDate: new Date(Date.UTC(startYear, 6, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59)),
  };
}

/**
 * Pravidlo zaradenia do kategórie: rozsah ročníkov narodenia platný pre danú sezónu.
 */
export interface CategoryRule {
  categoryCode: CategoryCode;
  birthYearFrom: number; // najstarší povolený ročník (menšie číslo)
  birthYearTo: number | null; // najmladší ročník; null = bez obmedzenia (MUZI smerom nadol vekovo)
}

/**
 * Vygeneruje štandardné pravidlá kategórií pre sezónu podľa veku:
 * kategória U{N} = hráči, ktorí v priebehu sezóny dovŕšia najviac N rokov.
 * Vek sa počíta k 1. 1. druhého kalendárneho roka sezóny (bežná prax SFZ:
 * rozhoduje ročník narodenia). U11 → ročníky (startYear+1-11) a mladší až po hranicu ďalšej kategórie.
 */
export function defaultCategoryRules(startYear: number): CategoryRule[] {
  const refYear = startYear + 1;
  // Hranice: kategória U{N} pokrýva ročníky refYear-N až po ročník pred hranicou predchádzajúcej kategórie.
  const bands: Array<{ code: CategoryCode; maxAge: number }> = [
    { code: 'U8', maxAge: 8 },
    { code: 'U9', maxAge: 9 },
    { code: 'U10', maxAge: 10 },
    { code: 'U11', maxAge: 11 },
    { code: 'U13', maxAge: 13 },
    { code: 'U15', maxAge: 15 },
    { code: 'U17', maxAge: 17 },
    { code: 'U19', maxAge: 19 },
  ];
  const rules: CategoryRule[] = [];
  let prevOldestYear = refYear; // U8: ročníky refYear-8 .. refYear-1 (prakticky refYear-8 a mladší)
  for (const band of bands) {
    const oldestYear = refYear - band.maxAge;
    rules.push({
      categoryCode: band.code,
      birthYearFrom: oldestYear,
      birthYearTo: band.code === 'U8' ? null : prevOldestYear - 1,
    });
    prevOldestYear = oldestYear;
  }
  // Muži: starší ako U19
  rules.push({ categoryCode: 'MUZI', birthYearFrom: 0, birthYearTo: refYear - 20 });
  return rules;
}

/**
 * Určí kategóriu hráča podľa dátumu narodenia a pravidiel sezóny.
 * Vráti null, ak hráč nespadá do žiadneho pravidla (napr. príliš mladý).
 */
export function categoryForBirthDate(birthDate: Date, rules: CategoryRule[]): CategoryCode | null {
  const birthYear = birthDate.getUTCFullYear();
  for (const rule of rules) {
    const fromOk = birthYear >= rule.birthYearFrom;
    const toOk = rule.birthYearTo === null || birthYear <= rule.birthYearTo;
    if (fromOk && toOk) return rule.categoryCode;
  }
  // MUZI pravidlo má birthYearFrom 0, takže sem sa dostane len príliš mladý hráč
  return null;
}
