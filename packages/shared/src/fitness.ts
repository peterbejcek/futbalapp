/** Previerky výkonnosti hráčov — spoločné disciplíny a porovnávanie s predchádzajúcou previerkou (web + mobil). */

export type FitnessDisciplineKey =
  | 'run10m'
  | 'run20m'
  | 'run30m'
  | 'shuttleRun'
  | 'dribbleSlalom'
  | 'enduranceRun'
  | 'standingJump';

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
  { key: 'dribbleSlalom', label: 'Vedenie lopty – lomený slalom', unit: 's', lowerIsBetter: true, step: '0.01', decimals: 2 },
  { key: 'enduranceRun', label: 'Vytrvalostný beh', unit: 'm', lowerIsBetter: false, step: '1', decimals: 0 },
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
  dribbleSlalom: number | null;
  enduranceRun: number | null;
  /** dĺžka vytrvalostného behu v minútach (podľa vekovej kategórie družstva) */
  enduranceMinutes: number | null;
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
    // vytrvalostný beh je porovnateľný len pri rovnakej dĺžke behu (6 vs 12 minút)
    if (key === 'enduranceRun' && (t.enduranceMinutes ?? null) !== (test.enduranceMinutes ?? null)) continue;
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

/** Dĺžka vytrvalostného behu podľa kategórie družstva: mladší žiaci (U13) 6 min, starší žiaci (U15) 12 min. */
export const FITNESS_ENDURANCE_MINUTES: Record<string, number> = { U13: 6, U15: 12 };

export function enduranceMinutesFor(categoryCode: string | null | undefined): number | null {
  return (categoryCode && FITNESS_ENDURANCE_MINUTES[categoryCode]) || null;
}

/** Názov disciplíny; pri vytrvalostnom behu aj s dĺžkou („Vytrvalostný beh – 6 min“). */
export function fitnessDisciplineLabel(d: FitnessDiscipline, enduranceMinutes?: number | null): string {
  return d.key === 'enduranceRun' && enduranceMinutes ? `${d.label} – ${enduranceMinutes} min` : d.label;
}
