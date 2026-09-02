import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { ROLES, type Role } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

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
    // nové konto → pošli prihlasovacie údaje (dočasné heslo) na registrovaný e-mail
    await this.sendCredentialsEmail(email, input.firstName, tempPassword);
    return { userId: user.id, email, tempPassword, created: true };
  }

  /** Odošle novému kontu prihlasovacie údaje s dočasným heslom. */
  private async sendCredentialsEmail(email: string, firstName: string, tempPassword: string) {
    const link = 'https://fkknv.sk/prihlasenie';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#16223c">
        <h2 style="color:#1a2848">Vitajte v portáli FK Košická Nová Ves</h2>
        <p>Dobrý deň${firstName ? ` ${firstName}` : ''},</p>
        <p>bolo vám vytvorené konto do klubového portálu. Prihláste sa týmito údajmi:</p>
        <table style="margin:12px 0;font-size:15px">
          <tr><td style="color:#6b7280;padding:2px 8px 2px 0">Prihlasovací e-mail:</td><td><strong>${email}</strong></td></tr>
          <tr><td style="color:#6b7280;padding:2px 8px 2px 0">Dočasné heslo:</td><td><strong style="letter-spacing:1px">${tempPassword}</strong></td></tr>
        </table>
        <p><a href="${link}" style="display:inline-block;background:#2b4278;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Prihlásiť sa</a></p>
        <p style="color:#6b7280;font-size:13px">Po prihlásení si heslo, prosím, zmeňte v nastaveniach. Ak ste o konto nežiadali, tento e-mail ignorujte.</p>
      </div>`;
    await this.email.send([email], 'Prihlasovacie údaje — FK Košická Nová Ves', html);
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

  /** Admin: vygeneruje nové jednorazové heslo pre používateľa (na odovzdanie). */
  async resetPassword(userId: string): Promise<{ tempPassword: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Konto neexistuje');
    const tempPassword = generateTempPassword();
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(tempPassword, 10) },
    });
    return { tempPassword };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Požiadavka o obnovenie hesla: ak e-mail existuje, pošle odkaz s tokenom.
   * Vždy vráti rovnakú odpoveď (neprezradzuje, či e-mail v systéme je).
   */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (user?.passwordHash) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hodina
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

      const link = `https://fkknv.sk/reset-hesla?token=${token}`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#16223c">
          <h2 style="color:#1a2848">Obnovenie hesla</h2>
          <p>Dostali sme žiadosť o obnovenie hesla k vášmu kontu v portáli FK Košická Nová Ves.</p>
          <p><a href="${link}" style="display:inline-block;background:#2b4278;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Nastaviť nové heslo</a></p>
          <p style="color:#6b7280;font-size:13px">Odkaz je platný 1 hodinu. Ak ste o obnovenie nežiadali, tento e-mail ignorujte.</p>
        </div>`;
      await this.email.send([user.email], 'Obnovenie hesla — FK Košická Nová Ves', html);
    }
    return { ok: true };
  }

  /** Nastaví nové heslo podľa platného tokenu z e-mailu. */
  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: true }> {
    if (newPassword.length < 8) throw new BadRequestException('Heslo musí mať aspoň 8 znakov');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Odkaz je neplatný alebo mu vypršala platnosť. Požiadajte o nový.');
    }
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    return { ok: true };
  }
}
