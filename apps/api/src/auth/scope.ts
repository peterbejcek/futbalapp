import type { AuthUser } from './current-user.decorator';

/** Vedenie klubu — vidí a spravuje celý klub. */
export function isStaff(user: AuthUser): boolean {
  return user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
}

/** Družstvá, ktoré používateľ trénuje (COACH scope). */
export function coachTeamIds(user: AuthUser): string[] {
  return user.roles.filter((r) => r.role === 'COACH' && r.teamId).map((r) => r.teamId as string);
}

/** Môže používateľ spravovať (editovať) dané družstvo? Vedenie áno, tréner len svoje. */
export function canManageTeam(user: AuthUser, teamId: string | null | undefined): boolean {
  if (isStaff(user)) return true;
  if (!teamId) return false;
  return coachTeamIds(user).includes(teamId);
}
