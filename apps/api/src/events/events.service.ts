import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  generateOccurrences,
  type CreateEventInput,
  type CreateRecurringTrainingInput,
  type MarkAttendanceInput,
} from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ClubsService } from '../clubs/clubs.service';
import { canManageTeam, coachBlockedFromTeam, coachTeamIds, isStaff } from '../auth/scope';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clubs: ClubsService,
  ) {}

  list(params: { categoryCode?: string; teamId?: string; from?: Date; to?: Date; type?: string }) {
    return this.prisma.event.findMany({
      where: {
        team: {
          id: params.teamId ? params.teamId : undefined,
          teamCategory: params.categoryCode ? { code: params.categoryCode } : undefined,
        },
        type: params.type ? (params.type as never) : undefined,
        startAt: { gte: params.from, lte: params.to },
      },
      include: { team: { include: { teamCategory: true } }, match: true },
      orderBy: { startAt: 'asc' },
    });
  }

  /** Družstvá relevantné pre používateľa: trénerske + jeho vlastné (hráč) + jeho detí (rodič). */
  private async relevantTeamIds(user: AuthUser): Promise<string[]> {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    const ids = new Set<string>(coachTeamIds(user));
    if (season) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: {
          seasonId: season.id,
          leftAt: null,
          member: {
            OR: [{ userId: user.id }, { guardians: { some: { userId: user.id } } }],
          },
        },
        select: { teamId: true },
      });
      for (const m of memberships) ids.add(m.teamId);
    }
    return [...ids];
  }

  /** Udalosti relevantné pre používateľa: vedenie vidí všetko; ostatní svoje družstvá + celoklubové. */
  async listForUser(params: { from?: Date; to?: Date; type?: string }, user: AuthUser) {
    if (isStaff(user)) return this.list(params);
    const teamIds = await this.relevantTeamIds(user);
    return this.prisma.event.findMany({
      where: {
        OR: [{ teamId: { in: teamIds } }, { teamId: null }],
        type: params.type ? (params.type as never) : undefined,
        startAt: { gte: params.from, lte: params.to },
      },
      include: { team: { include: { teamCategory: true } }, match: true },
      orderBy: { startAt: 'asc' },
    });
  }

  /** Zoznam doteraz použitých miest (ihrísk) pre našepkávač — bez duplicít. */
  async locations(): Promise<string[]> {
    const rows = await this.prisma.event.findMany({
      where: { location: { not: null } },
      distinct: ['location'],
      select: { location: true },
      orderBy: { location: 'asc' },
    });
    return rows.map((r) => r.location).filter((l): l is string => !!l && l.trim().length > 0);
  }

  private async resolveTeam(teamId?: string) {
    if (!teamId) return null;
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new BadRequestException('Družstvo neexistuje');
    return team;
  }

  /** Predpripraví dochádzku pre všetkých hráčov družstva (vedenie/tréner/rodič sa nezahŕňa). */
  private async prepareAttendance(eventId: string, teamId: string, seasonId: string) {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        seasonId,
        teamId,
        leftAt: null,
        member: { NOT: { user: { roles: { some: { role: { in: ['ADMIN', 'MANAGER', 'COACH', 'PARENT'] as never } } } } } },
      },
    });
    if (memberships.length > 0) {
      await this.prisma.attendance.createMany({
        data: memberships.map((m) => ({ eventId, memberId: m.memberId })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * Vytvorí jednu udalosť; pri TRAINING predpripraví dochádzku družstva,
   * pri MATCH/TOURNAMENT vytvorí Match záznam.
   */
  async create(input: CreateEventInput, createdById: string) {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');
    const team = await this.resolveTeam(input.teamId);
    const isMatch = input.type === 'MATCH' || input.type === 'TOURNAMENT';

    // logo súpera z registra klubov + doplnenie nového súpera do registra
    let opponentLogo: string | null = null;
    if (isMatch && input.opponent) {
      opponentLogo = await this.clubs.logoForName(input.opponent);
      await this.clubs.ensure(input.opponent);
    }

    const event = await this.prisma.event.create({
      data: {
        type: input.type,
        seasonId: season.id,
        teamId: team?.id,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        surface: input.surface,
        createdById,
        match: isMatch
          ? { create: { opponent: input.opponent ?? 'Neznámy súper', isHome: input.isHome ?? true, opponentLogo } }
          : undefined,
      },
      include: { match: true },
    });

    if (input.type === 'TRAINING' && team) {
      await this.prepareAttendance(event.id, team.id, season.id);
    }
    return event;
  }

  /**
   * Vytvorí sériu opakovaných tréningov (napr. utorky+piatky 16:00–17:00)
   * ako samostatné udalosti so spoločným recurrenceGroupId.
   */
  async createRecurring(input: CreateRecurringTrainingInput, createdById: string) {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');
    const team = await this.resolveTeam(input.teamId);
    if (!team) throw new BadRequestException('Vyberte družstvo');

    const occurrences = generateOccurrences({
      weekdays: input.weekdays,
      startTime: input.startTime,
      endTime: input.endTime,
      from: input.from,
      until: input.until,
    });
    if (occurrences.length === 0) {
      throw new BadRequestException('V zadanom období nevznikol žiadny tréning');
    }
    const recurrenceGroupId = randomUUID();

    for (const occ of occurrences) {
      const event = await this.prisma.event.create({
        data: {
          type: 'TRAINING',
          seasonId: season.id,
          teamId: team.id,
          title: input.title,
          startAt: occ.startAt,
          endAt: occ.endAt,
          location: input.location,
          surface: input.surface,
          recurrenceGroupId,
          createdById,
        },
      });
      await this.prepareAttendance(event.id, team.id, season.id);
    }
    return { recurrenceGroupId, created: occurrences.length };
  }

  async update(eventId: string, input: Partial<CreateEventInput>, user: AuthUser) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Udalosť neexistuje');
    if (!canManageTeam(user, event.teamId)) throw new ForbiddenException('Túto udalosť nemôžete upravovať');
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        surface: input.surface,
      },
    });
  }

  /** Zmaže udalosť; pre opakovaný tréning voliteľne celú budúcu sériu. */
  async remove(eventId: string, scope: 'one' | 'future', user: AuthUser) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Udalosť neexistuje');
    if (!canManageTeam(user, event.teamId)) throw new ForbiddenException('Túto udalosť nemôžete odstrániť');
    if (scope === 'future' && event.recurrenceGroupId) {
      const res = await this.prisma.event.deleteMany({
        where: { recurrenceGroupId: event.recurrenceGroupId, startAt: { gte: event.startAt } },
      });
      return { deleted: res.count };
    }
    await this.prisma.event.delete({ where: { id: eventId } });
    return { deleted: 1 };
  }

  async attendance(eventId: string, user: AuthUser) {
    // Aktuálny zoznam hráčov: doplní do dochádzky členov, ktorí pribudli do
    // družstva po vytvorení udalosti (chýbajúce riadky sa pridajú, existujúce
    // ostanú aj s už zaznamenaným stavom). Nikoho neodstraňuje.
    const base = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, teamId: true, seasonId: true },
    });
    if (!base) throw new NotFoundException('Udalosť neexistuje');
    // Detail tréningu (dochádzku) smie otvoriť len vedenie klubu a tréner daného
    // družstva — rodič/hráč nemá vidieť dochádzku iných detí.
    if (!canManageTeam(user, base.teamId)) throw new ForbiddenException('Dochádzka je len pre tréner družstva a vedenie');
    if (base.teamId) await this.prepareAttendance(base.id, base.teamId, base.seasonId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        team: { include: { teamCategory: true } },
        attendances: {
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { member: { lastName: 'asc' } },
        },
      },
    });
    if (!event) throw new NotFoundException('Udalosť neexistuje');
    return event;
  }

  async markAttendance(eventId: string, input: MarkAttendanceInput, user: AuthUser) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { teamId: true } });
    if (!event) throw new NotFoundException('Udalosť neexistuje');
    if (coachBlockedFromTeam(user, event.teamId)) throw new ForbiddenException('Dochádzku môžete zapisovať len svojmu družstvu');
    return this.prisma.attendance.upsert({
      where: { eventId_memberId: { eventId, memberId: input.memberId } },
      create: { eventId, memberId: input.memberId, status: input.status, markedById: user.id, markedAt: new Date() },
      update: { status: input.status, markedById: user.id, markedAt: new Date() },
    });
  }

  /** Dochádzková štatistika hráča v družstve (počet a % prítomnosti na tréningoch). */
  async teamAttendanceStats(teamId: string) {
    const events = await this.prisma.event.findMany({
      where: { teamId, type: 'TRAINING' },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);
    if (eventIds.length === 0) return [];
    const attendances = await this.prisma.attendance.findMany({
      where: { eventId: { in: eventIds } },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    });
    const byMember = new Map<string, { name: string; present: number; counted: number }>();
    for (const a of attendances) {
      const entry = byMember.get(a.memberId) ?? {
        name: `${a.member.lastName} ${a.member.firstName}`,
        present: 0,
        counted: 0,
      };
      if (a.status !== 'UNKNOWN') {
        entry.counted++;
        if (a.status === 'PRESENT') entry.present++;
      }
      byMember.set(a.memberId, entry);
    }
    return [...byMember.entries()]
      .map(([memberId, s]) => ({
        memberId,
        name: s.name,
        present: s.present,
        counted: s.counted,
        pct: s.counted > 0 ? Math.round((s.present / s.counted) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }

  /**
   * Dochádzkový list družstva za zvolený mesiac: stĺpce = tréningy (dátumy),
   * riadky = hráči, bunka = stav na tréningu; posledný stĺpec = súhrn počtov.
   * `month` je vo formáte "YYYY-MM"; čas tréningov je vedený ako UTC wall-clock.
   */
  async attendanceSheet(teamId: string, month: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) throw new BadRequestException('Neplatný mesiac (očakáva YYYY-MM)');
    const year = Number(match[1]);
    const mon = Number(match[2]); // 1-12
    const from = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, mon, 1, 0, 0, 0)); // začiatok ďalšieho mesiaca

    const trainings = await this.prisma.event.findMany({
      where: { teamId, type: 'TRAINING', startAt: { gte: from, lt: to } },
      select: { id: true, startAt: true },
      orderBy: { startAt: 'asc' },
    });

    const eventIds = trainings.map((t) => t.id);
    const attendances = eventIds.length
      ? await this.prisma.attendance.findMany({
          where: { eventId: { in: eventIds } },
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
        })
      : [];

    const STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED', 'INJURED', 'SICK'] as const;
    const members = new Map<
      string,
      { id: string; firstName: string; lastName: string; cells: Record<string, string>; summary: Record<string, number> }
    >();
    for (const a of attendances) {
      let m = members.get(a.memberId);
      if (!m) {
        m = {
          id: a.member.id,
          firstName: a.member.firstName,
          lastName: a.member.lastName,
          cells: {},
          summary: Object.fromEntries(STATUSES.map((s) => [s, 0])),
        };
        members.set(a.memberId, m);
      }
      m.cells[a.eventId] = a.status;
      if (a.status !== 'UNKNOWN' && a.status in m.summary) m.summary[a.status]!++;
    }

    const rows = [...members.values()].sort((x, y) =>
      `${x.lastName} ${x.firstName}`.localeCompare(`${y.lastName} ${y.firstName}`, 'sk'),
    );
    return { trainings, rows };
  }
}
