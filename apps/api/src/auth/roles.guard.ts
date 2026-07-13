import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@fkknv/shared';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser } from './current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;
    const userRoles = new Set(user.roles.map((r) => r.role));
    // ADMIN môže všetko
    if (userRoles.has('ADMIN')) return true;
    if (!required.some((r) => userRoles.has(r))) {
      throw new ForbiddenException('Nedostatočné oprávnenia');
    }
    return true;
  }
}
