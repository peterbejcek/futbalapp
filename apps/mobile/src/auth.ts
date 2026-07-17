import { api } from './api';

export interface Me {
  id: string;
  firstName: string;
  lastName: string;
  memberId: string | null;
  roles: Array<{ role: string; team: { id: string; name: string; categoryCode: string } | null }>;
  children: Array<{ id: string; firstName: string; lastName: string }>;
}

export function isStaff(me: Me | null): boolean {
  return !!me?.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
}
export function isCoach(me: Me | null): boolean {
  return !!me?.roles.some((r) => r.role === 'COACH');
}
export function canManage(me: Me | null): boolean {
  return isStaff(me) || isCoach(me);
}
export function coachTeams(me: Me | null): Array<{ id: string; name: string; categoryCode: string }> {
  return (me?.roles ?? []).filter((r) => r.role === 'COACH' && r.team).map((r) => r.team!);
}

export function fetchMe(): Promise<Me> {
  return api<Me>('/auth/me');
}
