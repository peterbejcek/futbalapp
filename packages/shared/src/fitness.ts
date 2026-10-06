/** Previerky výkonnosti hráčov — spoločné disciplíny a porovnávanie s predchádzajúcou previerkou (web + mobil). */

export type FitnessDisciplineKey = 'run10m' | 'run20m' | 'run30m' | 'shuttleRun' | 'standingJump';

export interface FitnessDiscipline {
  key: FitnessDisciplineKey;
  label: string;
  unit: string;
  /** čím nižšia hodnota, tým lepšie (časy); skok z miesta je opačne */
  lowerIsBetter: boolean;
  step: string;
  decimals: number;
}

export const FITNESS_DISCIPLINES: FitnessDiscipline[] = [
  { key: 'run10m', label: 'Beh 10 m', unit: 's', lowerIsBetter: true, step: '0.01', decimals: 2 },
  { key: 'run20m', label: 'Beh 20 m', unit: 's', lowerIsBetter: true, step: '0.01', decimals: 2 },
  { key: 'run30m', label: 'Beh 30 m', unit: 's', lowerIsBetter: true, step: '0.01', decimals: 2 },
  { key: 'shuttleRun', label: 'Člnkový beh', unit: 's', lowerIsBetter: true, step: '0.01', decimals: 2 },
  { key: 'standingJump', label: 'Skok do diaľky z miesta', unit: 'cm', lowerIsBetter: false, step: '1', decimals: 0 },
];

export interface FitnessTestLike {
  id: string;
  memberId: string;
  testedAt: string; // YYYY-MM-DD
  run10m: number | null;
  run20m: number | null;
  run30m: number | null;
  shuttleRun: number | null;
  standingJump: number | null;
}

/** Hodnota z predchádzajúcej previerky hráča (ktorá mala v danej disciplíne hodnotu), inak null. */
export function previousFitnessValue(
  all: FitnessTestLike[],
  test: FitnessTestLike,
  key: FitnessDisciplineKey,
): number | null {
  let prev: FitnessTestLike | null = null;
  for (const t of all) {
    if (t.memberId !== test.memberId || t.id === test.id || t[key] == null) continue;
    const before = t.testedAt < test.testedAt || (t.testedAt === test.testedAt && t.id < test.id);
    if (before && (!prev || t.testedAt > prev.testedAt || (t.testedAt === prev.testedAt && t.id > prev.id))) prev = t;
  }
  return prev ? (prev[key] as number) : null;
}

export type FitnessTrend = 'better' | 'worse' | 'same' | 'none';

/** Text hodnoty s rozdielom v zátvorke a trend (zlepšenie / zhoršenie / bez zmeny). */
export function fitnessDelta(
  value: number | null,
  previous: number | null,
  discipline: FitnessDiscipline,
): { text: string; trend: FitnessTrend } {
  if (value == null) return { text: '–', trend: 'none' };
  const shown = value.toFixed(discipline.decimals);
  if (previous == null) return { text: shown, trend: 'none' };
  const diff = Math.round((value - previous) * 100) / 100;
  if (diff === 0) return { text: `${shown} (0)`, trend: 'same' };
  const better = discipline.lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? '+' : '−';
  return { text: `${shown} (${sign}${Math.abs(diff).toFixed(discipline.decimals)})`, trend: better ? 'better' : 'worse' };
}

export function formatFitnessDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}
