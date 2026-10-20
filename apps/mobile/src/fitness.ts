export interface FitnessTest {
  id: string;
  memberId: string;
  teamId: string | null;
  testedAt: string; // YYYY-MM-DD
  run10m: number | null;
  run30m: number | null;
  shuttleRun: number | null;
  dribbleSlalom: number | null;
  enduranceRun: number | null;
  enduranceMinutes: number | null;
  standingJump: number | null;
  pullUpHang: number | null;
  shuttleEndurance: number | null;
  sitUps30: number | null;
  medicineBallThrow: number | null;
  juggling: number | null;
  passesRunning: number | null;
  shooting: number | null;
  member: { id: string; firstName: string; lastName: string };
  team: { id: string; name: string } | null;
}

export const trendColor = {
  better: '#86e0a0',
  worse: '#ff6b88',
  same: '#f2f5f5',
  none: '#f2f5f5',
} as const;

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
