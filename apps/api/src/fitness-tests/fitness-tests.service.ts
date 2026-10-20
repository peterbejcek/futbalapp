import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FITNESS_DISCIPLINES, enduranceMinutesFor, validateFitnessValue } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamIds, isStaff } from '../auth/scope';
import type { AuthUser } from '../auth/current-user.decorator';

export interface FitnessTestInput {
  memberId?: string;
  teamId?: string | null;
  testedAt?: string;
  run10m?: number | null;
  run30m?: number | null;
  shuttleRun?: number | null;
  dribbleSlalom?: number | null;
  enduranceRun?: number | null;
  standingJump?: number | null;
  pullUpHang?: number | null;
  shuttleEndurance?: number | null;
  sitUps30?: number | null;
  medicineBallThrow?: number | null;
  juggling?: number | null;
  passesRunning?: number | null;
  shooting?: number | null;
}

const include = {
  member: { select: { id: true, firstName: true, lastName: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.FitnessTestInclude;

@Injectable()
export class FitnessTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, memberId?: string) {
    const where: Prisma.FitnessTestWhereInput = { member: { isDemo: user.isDemo } };
    if (memberId) where.memberId = memberId;
    if (!isStaff(user)) {
      where.member = {
        isDemo: user.isDemo,
        memberships: { some: { leftAt: null, season: { isActive: true }, teamId: { in: coachTeamIds(user) } } },
      };
    }
    const tests = await this.prisma.fitnessTest.findMany({
      where,
      include,
      orderBy: [{ testedAt: 'asc' }, { createdAt: 'asc' }],
    });
    return tests.map((t) => ({ ...t, testedAt: t.testedAt.toISOString().slice(0, 10) }));
  }

  async create(body: FitnessTestInput, user: AuthUser) {
    if (!body.memberId) throw new BadRequestException('Chýba hráč');
    const member = await this.assertMemberAccess(body.memberId, user);
    const data = this.parse(body, true);
    // družstvo: zvolené (musí byť družstvom hráča), inak prvé aktívne družstvo hráča
    if (body.teamId && !member.memberships.some((m) => m.teamId === body.teamId)) {
      throw new BadRequestException('Hráč nie je v zvolenom družstve');
    }
    const teamId = body.teamId || member.memberships[0]?.teamId || null;
    // dĺžka vytrvalostného behu podľa vekovej kategórie družstva (U13 = 6 min, U15 = 12 min)
    const team = teamId
      ? await this.prisma.team.findUnique({ where: { id: teamId }, select: { teamCategory: { select: { code: true, name: true } } } })
      : null;
    const enduranceMinutes = enduranceMinutesFor(team?.teamCategory.code, team?.teamCategory.name);
    return this.prisma.fitnessTest.create({
      data: { ...(data as Prisma.FitnessTestUncheckedCreateInput), memberId: member.id, teamId, enduranceMinutes },
      include,
    });
  }

  async update(id: string, body: FitnessTestInput, user: AuthUser) {
    const existing = await this.prisma.fitnessTest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Previerka neexistuje');
    await this.assertMemberAccess(existing.memberId, user);
    return this.prisma.fitnessTest.update({ where: { id }, data: this.parse(body, false), include });
  }

  async remove(id: string, user: AuthUser) {
    const existing = await this.prisma.fitnessTest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Previerka neexistuje');
    await this.assertMemberAccess(existing.memberId, user);
    await this.prisma.fitnessTest.delete({ where: { id } });
    return { ok: true };
  }

  private async assertMemberAccess(memberId: string, user: AuthUser) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        isDemo: true,
        memberships: { where: { leftAt: null, season: { isActive: true } }, select: { teamId: true } },
      },
    });
    if (!member || member.isDemo !== user.isDemo) throw new NotFoundException('Hráč neexistuje');
    if (!isStaff(user)) {
      const mine = new Set(coachTeamIds(user));
      if (!member.memberships.some((m) => mine.has(m.teamId))) {
        throw new ForbiddenException('Hráč nie je vo vašom družstve');
      }
    }
    return member;
  }

  private parse(body: FitnessTestInput, creating: boolean) {
    const data: Record<string, unknown> = {};
    if (body.testedAt !== undefined || creating) {
      if (!body.testedAt || !/^\d{4}-\d{2}-\d{2}$/.test(body.testedAt) || Number.isNaN(Date.parse(body.testedAt))) {
        throw new BadRequestException('Neplatný dátum previerky');
      }
      data.testedAt = new Date(`${body.testedAt}T00:00:00.000Z`);
    }
    // disciplíny a ich pravidlá (celé čísla, rozsahy) sú definované v @fkknv/shared
    for (const d of FITNESS_DISCIPLINES) {
      const v = (body as Record<string, unknown>)[d.key];
      if (v === undefined) continue;
      const err = validateFitnessValue(d, v);
      if (err) throw new BadRequestException(err);
      data[d.key] = v;
    }
    return data;
  }
}
