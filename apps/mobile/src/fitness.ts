export interface FitnessTest {
  id: string;
  memberId: string;
  teamId: string | null;
  testedAt: string; // YYYY-MM-DD
  run10m: number | null;
  run20m: number | null;
  run30m: number | null;
  shuttleRun: number | null;
  standingJump: number | null;
  member: { id: string; firstName: string; lastName: string };
  team: { id: string; name: string } | null;
}

export const trendColor = {
  better: '#16a34a',
  worse: '#dc2626',
  same: '#000000',
  none: '#16223c',
} as const;

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
