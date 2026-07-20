import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberInput, MemberStatus, Role } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../auth/accounts.service';

const activeMembership = {
  where: { leftAt: null, season: { isActive: true } },
  include: { team: { include: { teamCategory: true } } },
} as const;

const accountInclude = {
  user: { select: { id: true, email: true, roles: { select: { role: true, teamId: true } } } },
} as const;

export interface AccountResult {
  email: string;
  tempPassword: string | null;
  created: boolean;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  list(params: {
    categoryCode?: string;
    teamId?: string;
    teamIds?: string[]; // scope pre trénera (jeho družstvá)
    seasonId?: string;
    status?: string;
  }) {
    const hasScope = params.categoryCode || params.teamId || params.teamIds || params.seasonId;
    return this.prisma.member.findMany({
      where: {
        status: params.status ? (params.status as MemberStatus) : undefined,
        memberships: hasScope
          ? {
              some: {
                leftAt: null,
                season: params.seasonId ? { id: params.seasonId } : { isActive: true },
                team: {
                  id: params.teamId ? params.teamId : params.teamIds ? { in: params.teamIds } : undefined,
                  teamCategory: params.categoryCode ? { code: params.categoryCode } : undefined,
                },
              },
            }
          : undefined,
      },
      include: {
        memberships: activeMembership,
        ...accountInclude,
        guardians: {
          include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async get(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { team: { include: { teamCategory: true } }, season: true },
          orderBy: { joinedAt: 'desc' },
        },
        ...accountInclude,
        guardians: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
        },
        paymentObligations: { orderBy: { dueDate: 'desc' }, take: 24 },
      },
    });
    if (!member) throw new NotFoundException('Člen neexistuje');
    return member;
  }

  /** Priradí/prepíše zaradenie člena do družstva v aktívnej sezóne (manuálna výnimka). */
  private async assignTeam(memberId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Družstvo neexistuje');
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');
    await this.prisma.teamMembership.upsert({
      where: { memberId_seasonId: { memberId, seasonId: season.id } },
      create: { memberId, seasonId: season.id, teamId, isException: true },
      update: { teamId, isException: true },
    });
  }

  /** Vytvorí/prepojí konto člena a nastaví roly. Vráti dočasné heslo pri novom konte. */
  private async applyAccount(
    member: { id: string; firstName: string; lastName: string; userId: string | null },
    input: CreateMemberInput,
  ): Promise<AccountResult | null> {
    const roles = (input.roles ?? []) as Role[];
    // konto sa vytvára len ak je zadaný e-mail
    if (!input.account?.email) {
      // ak už konto existuje a menia sa roly, dopočítaj ich
      if (member.userId && roles.length) await this.accounts.syncRoles(member.userId, roles, input.teamId);
      return null;
    }
    const result = await this.accounts.ensureAccount({
      email: input.account.email,
      phone: input.account.phone,
      firstName: member.firstName,
      lastName: member.lastName,
      roles: roles.length ? roles : ['PLAYER'],
      coachTeamId: input.teamId,
    });
    // prepoj člena s kontom (ak ešte nie je a konto nie je použité iným členom)
    if (!member.userId) {
      const linkedElsewhere = await this.prisma.member.findFirst({
        where: { userId: result.userId, id: { not: member.id } },
      });
      if (!linkedElsewhere) {
        await this.prisma.member.update({ where: { id: member.id }, data: { userId: result.userId } });
      }
    }
    return { email: result.email, tempPassword: result.tempPassword, created: result.created };
  }

  async create(input: CreateMemberInput, actorRoles: Role[]) {
    if (input.roles?.length) this.assertGrant(actorRoles, input.roles);
    const member = await this.prisma.member.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        status: input.status,
        futbalnetId: input.futbalnetId,
        healthNotes: input.healthNotes,
      },
    });
    if (input.teamId) await this.assignTeam(member.id, input.teamId);
    const account = await this.applyAccount({ ...member, userId: null }, input);
    return { member: await this.get(member.id), account };
  }

  async update(id: string, input: Partial<CreateMemberInput>, actorRoles: Role[]) {
    const existing = await this.get(id);
    if (input.roles?.length) this.assertGrant(actorRoles, input.roles as Role[]);
    await this.prisma.member.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        status: input.status,
        futbalnetId: input.futbalnetId,
        healthNotes: input.healthNotes,
      },
    });
    if (input.teamId) await this.assignTeam(id, input.teamId);
    const account = await this.applyAccount(
      { id, firstName: input.firstName ?? existing.firstName, lastName: input.lastName ?? existing.lastName, userId: existing.userId },
      input as CreateMemberInput,
    );
    return { member: await this.get(id), account };
  }

  private assertGrant(actorRoles: Role[], roles: Role[]) {
    this.accounts.assertCanGrant({ id: '', email: '', roles: actorRoles.map((role) => ({ role, teamId: null })) }, roles);
  }

  /** Je člen v niektorom z uvedených družstiev v aktívnej sezóne? (scope trénera) */
  async memberInTeams(memberId: string, teamIds: string[]): Promise<boolean> {
    if (teamIds.length === 0) return false;
    const count = await this.prisma.teamMembership.count({
      where: { memberId, leftAt: null, season: { isActive: true }, teamId: { in: teamIds } },
    });
    return count > 0;
  }
}
