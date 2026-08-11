import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ROLES, type Role } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './current-user.decorator';

/** Roly, ktoré smie prideľovať len ADMIN (nie MANAGER). */
const ADMIN_ONLY_ROLES: Role[] = ['ADMIN', 'MANAGER'];

/** Ľahko diktovateľné dočasné heslo, napr. "FKKNV-7K3P9Q". */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez podobných znakov (0/O, 1/I)
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FKKNV-${s}`;
}

export interface EnsureAccountInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: Role[];
  /** scope pre COACH rolu — družstvá, ktoré tréner trénuje */
  coachTeamIds?: string[];
  /** roly, ktoré smie aktér spravovať (mimo nich sa nič nemení) */
  allowedRoles?: Role[];
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Overí, či prihlásený používateľ smie prideliť dané roly. */
  assertCanGrant(actor: AuthUser, roles: Role[]) {
    const actorIsAdmin = actor.roles.some((r) => r.role === 'ADMIN');
    if (actorIsAdmin) return;
    const elevated = roles.filter((r) => ADMIN_ONLY_ROLES.includes(r));
    if (elevated.length > 0) {
      throw new ForbiddenException('Roly Admin a Vedúci klubu môže prideliť len administrátor');
    }
  }

  /**
   * Vytvorí konto (ak email ešte neexistuje) s dočasným heslom a rolami,
   * alebo doplní roly existujúcemu kontu. Vráti dočasné heslo len pri
   * novovytvorenom konte (existujúcemu heslo nemeníme).
   */
  async ensureAccount(
    input: EnsureAccountInput,
  ): Promise<{ userId: string; email: string; tempPassword: string | null; created: boolean }> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Chýba e-mail pre konto');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      await this.syncRoles(existing.id, input.roles, input.coachTeamIds, input.allowedRoles);
      return { userId: existing.id, email, tempPassword: null, created: false };
    }

    const tempPassword = generateTempPassword();
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: await bcrypt.hash(tempPassword, 10),
      },
    });
    await this.syncRoles(user.id, input.roles, input.coachTeamIds, input.allowedRoles);
    return { userId: user.id, email, tempPassword, created: true };
  }

  /**
   * Nastaví roly používateľa (idempotentne pridá chýbajúce). Pri COACH sa
   * vytvorí rola pre každé trénované družstvo (scope); ak nie je zadané žiadne,
   * COACH bez scope-u (null).
   */
  async syncRoles(userId: string, roles: Role[], coachTeamIds?: string[], allowedRoles?: Role[]) {
    // Roly, ktoré smie táto operácia meniť. Mimo nich sa nič neodstraňuje ani
    // nepridáva (napr. vedúci nezmaže členovi rolu ADMIN, ktorú nevidí).
    const manage = allowedRoles ?? ([...ROLES] as Role[]);
    const desired = new Set(roles.filter((r) => manage.includes(r)));

    // Ne-trénerské roly: nastav presne na želaný stav (pridaj/odober).
    for (const role of manage) {
      if (role === 'COACH') continue;
      const existing = await this.prisma.userRole.findFirst({ where: { userId, role, teamId: null } });
      if (desired.has(role) && !existing) {
        await this.prisma.userRole.create({ data: { userId, role, teamId: null } });
      } else if (!desired.has(role) && existing) {
        await this.prisma.userRole.deleteMany({ where: { userId, role } });
      }
    }

    // COACH: scope na družstvá — nastav presne na coachTeamIds (alebo prázdno).
    if (manage.includes('COACH')) {
      const wantTeamIds: Array<string | null> = desired.has('COACH')
        ? coachTeamIds?.length
          ? coachTeamIds
          : [null]
        : [];
      const existingCoach = await this.prisma.userRole.findMany({ where: { userId, role: 'COACH' } });
      for (const ec of existingCoach) {
        if (!wantTeamIds.some((t) => (t ?? null) === (ec.teamId ?? null))) {
          await this.prisma.userRole.delete({ where: { id: ec.id } });
        }
      }
      for (const teamId of wantTeamIds) {
        if (!existingCoach.some((ec) => (ec.teamId ?? null) === (teamId ?? null))) {
          await this.prisma.userRole.create({ data: { userId, role: 'COACH', teamId: teamId ?? null } });
        }
      }
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException('Nové heslo musí mať aspoň 8 znakov');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Súčasné heslo nesedí');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { changed: true };
  }
}
