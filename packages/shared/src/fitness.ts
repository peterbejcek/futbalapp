/** Previerky výkonnosti hráčov — spoločné disciplíny a porovnávanie s predchádzajúcou previerkou (web + mobil). */

export type FitnessDisciplineKey =
  | 'run10m'
  | 'run30m'
  | 'shuttleRun'
  | 'dribbleSlalom'
  | 'enduranceRun'
  | 'standingJump'
  | 'pullUpHang'
  | 'shuttleEndurance'
  | 'sitUps30'
  | 'medicineBallThrow'
  | 'juggling'
  | 'passesRunning'
  | 'shooting';

export type FitnessCategory = 'SILOVE' | 'VYTRVALOSTNE' | 'TECHNICKE';

export const FITNESS_CATEGORIES: Array<{ key: FitnessCategory; label: string }> = [
  { key: 'SILOVE', label: 'Silové' },
  { key: 'VYTRVALOSTNE', label: 'Vytrvalostné' },
  { key: 'TECHNICKE', label: 'Technické' },
];

export interface FitnessDiscipline {
  key: FitnessDisciplineKey;
  label: string;
  unit: string;
  category: FitnessCategory;
  /** čím nižšia hodnota, tým lepšie (časy); pri počtoch/vzdialenostiach je to opačne */
  lowerIsBetter: boolean;
  step: string;
  decimals: number;
  /** hodnota je celé číslo (počty, metre, cm) */
  integer: boolean;
  /** najvyššia prípustná hodnota (validácia v API) */
  max: number;
}

const time = (key: FitnessDisciplineKey, label: string, category: FitnessCategory, max = 600): FitnessDiscipline => ({
  key, label, unit: 's', category, lowerIsBetter: true, step: '0.01', decimals: 2, integer: false, max,
});
const count = (
  key: FitnessDisciplineKey, label: string, unit: string, category: FitnessCategory, max: number,
): FitnessDiscipline => ({ key, label, unit, category, lowerIsBetter: false, step: '1', decimals: 0, integer: true, max });
const decimal = (
  key: FitnessDisciplineKey, label: string, unit: string, category: FitnessCategory, max: number,
): FitnessDiscipline => ({ key, label, unit, category, lowerIsBetter: false, step: '0.1', decimals: 1, integer: false, max });

export const FITNESS_DISCIPLINES: FitnessDiscipline[] = [
  time('run10m', 'Beh 10 m', 'SILOVE'),
  time('run30m', 'Beh 30 m', 'SILOVE'),
  count('standingJump', 'Skok do diaľky z miesta', 'cm', 'SILOVE', 600),
  decimal('pullUpHang', 'Výdrž v zhybe nadhmatom', 's', 'SILOVE', 600),
  count('sitUps30', 'Ľah-sed za 30 s', 'počet', 'SILOVE', 100),
  decimal('medicineBallThrow', 'Hod 2 kg plnou loptou vpred', 'm', 'SILOVE', 30),
  count('enduranceRun', 'Vytrvalostný beh', 'm', 'VYTRVALOSTNE', 10000),
  count('shuttleEndurance', 'Vytrvalostný člnkový beh', 'úsekov', 'VYTRVALOSTNE', 500),
  time('shuttleRun', 'Člnkový beh', 'VYTRVALOSTNE'),
  time('dribbleSlalom', 'Slalom dribling', 'TECHNICKE'),
  count('juggling', 'Juggling – nožičky', 'dotykov', 'TECHNICKE', 5000),
  count('passesRunning', 'Prihrávky v behu', 'úspešných', 'TECHNICKE', 200),
  count('shooting', 'Strelba (presnosť)', 'zásahov', 'TECHNICKE', 100),
];

export const FITNESS_DISCIPLINE_KEYS = FITNESS_DISCIPLINES.map((d) => d.key);

export interface FitnessTestLike {
  id: string;
  memberId: string;
  testedAt: string; // YYYY-MM-DD
  run10m: number | null;
  run30m: number | null;
  shuttleRun: number | null;
  dribbleSlalom: number | null;
  enduranceRun: number | null;
  /** dĺžka vytrvalostného behu v minútach (podľa vekovej kategórie družstva) */
  enduranceMinutes: number | null;
  standingJump: number | null;
  pullUpHang: number | null;
  shuttleEndurance: number | null;
  sitUps30: number | null;
  medicineBallThrow: number | null;
  juggling: number | null;
  passesRunning: number | null;
  shooting: number | null;
}

/** Overí hodnotu disciplíny; vráti text chyby alebo null, ak je v poriadku. */
export function validateFitnessValue(d: FitnessDiscipline, v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > d.max) {
    return `Neplatná hodnota (${d.label})`;
  }
  if (d.integer && !Number.isInteger(v)) return `${d.label}: zadajte celé číslo`;
  return null;
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

export function enduranceMinutesFor(
  categoryCode: string | null | undefined,
  categoryName?: string | null,
): number | null {
  const byCode = categoryCode ? FITNESS_ENDURANCE_MINUTES[categoryCode] : undefined;
  if (byCode) return byCode;
  // záloha podľa názvu kategórie („Mladší žiaci …“ / „Starší žiaci …“)
  const name = (categoryName ?? '').toLowerCase();
  if (/mladš\S*\s+žiac/.test(name)) return 6;
  if (/starš\S*\s+žiac/.test(name)) return 12;
  return null;
}

/** Názov disciplíny; pri vytrvalostnom behu aj s dĺžkou („Vytrvalostný beh – 6 min“). */
export function fitnessDisciplineLabel(d: FitnessDiscipline, enduranceMinutes?: number | null): string {
  return d.key === 'enduranceRun' && enduranceMinutes ? `${d.label} – ${enduranceMinutes} min` : d.label;
}
