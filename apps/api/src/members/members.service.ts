import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberInput, MemberStatus, Role } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../auth/accounts.service';
import { parseRosterXlsx, type RosterRow } from './roster-import';
import type { AuthUser } from '../auth/current-user.decorator';

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
    role?: string; // filter podľa funkcie: PLAYER | PARENT | COACH | MANAGER | ADMIN
  }) {
    const and: Array<Record<string, unknown>> = [];
    if (params.status) and.push({ status: params.status as MemberStatus });

    // scope na družstvo/kategóriu: hráči v družstve ALEBO rodičia dieťaťa v družstve
    const hasScope = params.categoryCode || params.teamId || params.teamIds;
    const teamFilter = {
      leftAt: null,
      season: params.seasonId ? { id: params.seasonId } : { isActive: true },
      team: {
        id: params.teamId ? params.teamId : params.teamIds ? { in: params.teamIds } : undefined,
        teamCategory: params.categoryCode ? { code: params.categoryCode } : undefined,
      },
    } as const;
    if (hasScope) {
      and.push({
        OR: [
          { memberships: { some: teamFilter } }, // hráč v družstve
          // rodič dieťaťa, ktoré je v družstve
          { user: { guardianOf: { some: { member: { memberships: { some: teamFilter } } } } } },
        ],
      });
    }

    // filter podľa roly/funkcie
    if (params.role === 'PLAYER') {
      and.push({ memberships: { some: { leftAt: null, season: { isActive: true } } } });
    } else if (params.role) {
      and.push({ user: { roles: { some: { role: params.role as never } } } });
    }

    return this.prisma.member.findMany({
      where: and.length ? { AND: and } : undefined,
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

  /** Priradí členovi (rodičovi) existujúce deti — vytvorí väzby Guardian. Vyžaduje konto. */
  private async linkChildren(parentMemberId: string, childMemberIds: string[]) {
    if (childMemberIds.length === 0) return;
    const parent = await this.prisma.member.findUnique({ where: { id: parentMemberId } });
    if (!parent?.userId) {
      throw new BadRequestException('Rodič musí mať prihlasovacie konto, aby sa mu dali priradiť deti');
    }
    for (const childId of childMemberIds) {
      if (childId === parentMemberId) continue;
      await this.prisma.guardian.upsert({
        where: { userId_memberId: { userId: parent.userId, memberId: childId } },
        create: { userId: parent.userId, memberId: childId, relation: 'GUARDIAN' },
        update: {},
      });
    }
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
        registrationNumber: input.registrationNumber,
        homeClub: input.homeClub,
        guestClub: input.guestClub,
        clubAffiliation: input.clubAffiliation,
        registrationValidUntil: input.registrationValidUntil,
        registeredAt: input.registeredAt,
      },
    });
    if (input.teamId) await this.assignTeam(member.id, input.teamId);
    const account = await this.applyAccount({ ...member, userId: null }, input);
    if (input.childMemberIds?.length) await this.linkChildren(member.id, input.childMemberIds);
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
        registrationNumber: input.registrationNumber,
        homeClub: input.homeClub,
        guestClub: input.guestClub,
        clubAffiliation: input.clubAffiliation,
        registrationValidUntil: input.registrationValidUntil,
        registeredAt: input.registeredAt,
      },
    });
    if (input.teamId) await this.assignTeam(id, input.teamId);
    const account = await this.applyAccount(
      { id, firstName: input.firstName ?? existing.firstName, lastName: input.lastName ?? existing.lastName, userId: existing.userId },
      input as CreateMemberInput,
    );
    if (input.childMemberIds?.length) await this.linkChildren(id, input.childMemberIds);
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

  // -------------------------------------------------------------------------
  // Import hráčov z Excelu (idempotentný upsert)
  // -------------------------------------------------------------------------

  /**
   * Naimportuje/aktualizuje hráčov z Excelu (export z futbalnetu).
   *
   * Idempotentné a bez duplikátov: každý riadok sa napáruje na existujúceho
   * člena najprv podľa registračného čísla (unikátne), inak podľa
   * mena + priezviska + dátumu narodenia. Existujúci sa len aktualizuje o
   * údaje z registračného preukazu — konto, roly ani zaradenie do družstva sa
   * nedotýkajú. Nespárovaný riadok vytvorí nového člena (bez konta — účet sa
   * dopĺňa neskôr cez úpravu člena, keď je známy e-mail).
   *
   * Import zámerne nevytvára prihlasovacie kontá: Excel neobsahuje e-maily.
   * Kontá sa vytvárajú cielene (úprava člena / schválenie registrácie), pričom
   * sa napárujú na už naimportovaného člena, takže nevznikajú duplicity.
   */
  async importRoster(buffer: Buffer) {
    const rows = await parseRosterXlsx(buffer);
    let created = 0;
    let updated = 0;
    const items: Array<{ name: string; action: 'created' | 'updated'; registrationValidUntil: Date | null }> = [];

    for (const row of rows) {
      const existing = await this.findRosterMatch(row);
      const data = {
        firstName: row.firstName,
        lastName: row.lastName,
        birthDate: row.birthDate ?? undefined,
        status: row.status,
        registrationNumber: row.registrationNumber ?? undefined,
        homeClub: row.homeClub ?? undefined,
        guestClub: row.guestClub ?? undefined,
        clubAffiliation: row.clubAffiliation ?? undefined,
        registrationValidUntil: row.registrationValidUntil ?? undefined,
        registeredAt: row.registeredAt ?? undefined,
      };

      if (existing) {
        await this.prisma.member.update({ where: { id: existing.id }, data });
        updated++;
        items.push({ name: `${row.firstName} ${row.lastName}`, action: 'updated', registrationValidUntil: row.registrationValidUntil });
      } else {
        await this.prisma.member.create({ data });
        created++;
        items.push({ name: `${row.firstName} ${row.lastName}`, action: 'created', registrationValidUntil: row.registrationValidUntil });
      }
    }

    return { total: rows.length, created, updated, items };
  }

  /** Nájde existujúceho člena pre importný riadok (reg. číslo → meno+priezvisko+dátum). */
  private async findRosterMatch(row: RosterRow) {
    if (row.registrationNumber) {
      const byReg = await this.prisma.member.findUnique({ where: { registrationNumber: row.registrationNumber } });
      if (byReg) return byReg;
    }
    return this.prisma.member.findFirst({
      where: {
        firstName: { equals: row.firstName, mode: 'insensitive' },
        lastName: { equals: row.lastName, mode: 'insensitive' },
        birthDate: row.birthDate ?? undefined,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Platnosť registračných preukazov (dashboard)
  // -------------------------------------------------------------------------

  /**
   * Zoznam registračných preukazov so scope podľa roly:
   *  - ADMIN/MANAGER: všetci hráči s preukazom,
   *  - COACH: hráči z jeho družstiev,
   *  - PLAYER/PARENT: vlastný preukaz + preukazy detí.
   * Zoradené od najskoršej platnosti; po platnosti sú zvýraznené (expired).
   */
  async registrationCards(user: AuthUser) {
    const staff = user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
    const teamIds = user.roles.filter((r) => r.role === 'COACH' && r.teamId).map((r) => r.teamId as string);

    let where: Record<string, unknown> = { registrationValidUntil: { not: null } };
    if (!staff) {
      const or: Array<Record<string, unknown>> = [];
      if (teamIds.length) {
        or.push({ memberships: { some: { leftAt: null, season: { isActive: true }, teamId: { in: teamIds } } } });
      }
      // vlastný člen + deti (rodič)
      or.push({ user: { id: user.id } });
      or.push({ guardians: { some: { userId: user.id } } });
      where = { AND: [{ registrationValidUntil: { not: null } }, { OR: or }] };
    }

    const members = await this.prisma.member.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        registrationNumber: true,
        registrationValidUntil: true,
        memberships: {
          where: { leftAt: null, season: { isActive: true } },
          select: { team: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { registrationValidUntil: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return members.map((m) => {
      const until = m.registrationValidUntil as Date;
      const daysLeft = Math.ceil((until.getTime() - today.getTime()) / 86400000);
      return {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        registrationNumber: m.registrationNumber,
        registrationValidUntil: until,
        team: m.memberships[0]?.team.name ?? null,
        daysLeft,
        expired: daysLeft < 0,
      };
    });
  }
}
