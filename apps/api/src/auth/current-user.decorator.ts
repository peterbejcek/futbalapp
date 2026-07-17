import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@fkknv/shared';

export interface AuthUser {
  id: string;
  email: string;
  /** teamId = scope pre COACH (družstvo); null pre ADMIN/MANAGER/PLAYER/PARENT */
  roles: Array<{ role: Role; teamId: string | null }>;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as AuthUser;
});
