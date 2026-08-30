import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { MatchEventInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { coachBlockedFromTeam } from '../auth/scope';
import type { AuthUser } from '../auth/current-user.decorator';

/** Kategórie, kde hráč potvrdzuje účasť na zápase. */
const CONFIRM_CATEGORIES = ['U17', 'U19', 'MUZI'];

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /** Tréner smie spravovať zápas len svojho družstva. */
  private async assertMatchTeam(matchId: string, user: AuthUser) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { event: { select: { teamId: true } } },
    });
    if (!match) throw new NotFoundException('Zápas neexistuje');
    if (coachBlockedFromTeam(user, match.event.teamId)) {
      throw new ForbiddenException('Zápas a nomináciu môžete spravovať len pre svoje družstvo');
    }
  }

  async get(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        event: { include: { team: { include: { teamCategory: true } } } },
        nominations: {
          where: { status: { not: 'REMOVED' } },
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
        },
        events: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            relatedMember: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!match) throw new NotFoundException('Zápas neexistuje');
    return match;
  }

  /** Doteraz zadaní súperi (bez duplicít) pre našepkávač pri tvorbe zápasu. */
  async opponents(): Promise<string[]> {
    const rows = await this.prisma.match.findMany({
      distinct: ['opponent'],
      select: { opponent: true },
      orderBy: { opponent: 'asc' },
    });
    return rows.map((r) => r.opponent).filter((o) => !!o && o !== 'Neznámy súper');
  }

  /** Pridanie hráča do nominácie (aj tesne pred zápasom). Notifikuje hráča a rodičov. */
  async nominate(matchId: string, memberId: string, user: AuthUser) {
    await this.assertMatchTeam(matchId, user);
    const nomination = await this.prisma.matchNomination.upsert({
      where: { matchId_memberId: { matchId, memberId } },
      create: { matchId, memberId },
      update: { status: 'NOMINATED' },
    });

    const [match, member] = await Promise.all([
      this.prisma.match.findUnique({ where: { id: matchId }, include: { event: true } }),
      this.prisma.member.findUnique({
        where: { id: memberId },
        include: { guardians: { select: { userId: true } } },
      }),
    ]);
    if (match && member) {
      const recipients = [...member.guardians.map((g) => g.userId)];
      if (member.userId) recipients.push(member.userId);
      const when = match.event.startAt.toLocaleString('sk-SK', {
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Bratislava',
      });
      await this.pushService.notifyUsers(recipients, {
        title: 'Nominácia na zápas',
        body: `${member.firstName} ${member.lastName} je v nominácii: ${match.event.title}, ${when}${match.event.location ? `, ${match.event.location}` : ''}`,
        data: { type: 'nomination', matchId },
      });
    }
    return nomination;
  }

  /** Členovia, ku ktorým má používateľ prístup (vlastný člen + deti). */
  private async myMemberIds(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: { select: { id: true } }, guardianOf: { select: { memberId: true } } },
    });
    const ids = new Set<string>();
    if (user?.member) ids.add(user.member.id);
    for (const g of user?.guardianOf ?? []) ids.add(g.memberId);
    return [...ids];
  }

  /**
   * Nominácie prihláseného hráča (a jeho detí) na nadchádzajúce zápasy v
   * kategóriách U17/U19/MUŽI, ktoré treba potvrdiť. Vráti aj už potvrdené/odmietnuté.
   */
  async myNominations(userId: string) {
    const memberIds = await this.myMemberIds(userId);
    if (memberIds.length === 0) return [];
    const noms = await this.prisma.matchNomination.findMany({
      where: {
        memberId: { in: memberIds },
        status: { not: 'REMOVED' },
        match: {
          event: {
            startAt: { gte: new Date() },
            team: { teamCategory: { code: { in: CONFIRM_CATEGORIES } } },
          },
        },
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        match: { include: { event: { include: { team: { include: { teamCategory: true } } } } } },
      },
      orderBy: { match: { event: { startAt: 'asc' } } },
    });
    return noms.map((n) => ({
      id: n.id,
      status: n.status,
      member: n.member,
      matchId: n.matchId,
      title: n.match.event.title,
      opponent: n.match.opponent,
      isHome: n.match.isHome,
      startAt: n.match.event.startAt,
      location: n.match.event.location,
      team: n.match.event.team?.name ?? null,
      category: n.match.event.team?.teamCategory.code ?? null,
    }));
  }

  /** Hráč (alebo rodič) potvrdí/odmietne vlastnú nomináciu. */
  async respondNomination(nominationId: string, userId: string, status: 'CONFIRMED' | 'DECLINED') {
    const nom = await this.prisma.matchNomination.findUnique({ where: { id: nominationId } });
    if (!nom) throw new NotFoundException('Nominácia neexistuje');
    if (nom.status === 'REMOVED') throw new BadRequestException('Nominácia bola zrušená');
    const memberIds = await this.myMemberIds(userId);
    if (!memberIds.includes(nom.memberId)) {
      throw new ForbiddenException('Môžete potvrdiť len vlastnú nomináciu');
    }
    return this.prisma.matchNomination.update({ where: { id: nominationId }, data: { status } });
  }

  /** Odobratie hráča z nominácie — záznam ostáva pre históriu so statusom REMOVED. */
  async removeNomination(matchId: string, memberId: string, user: AuthUser) {
    await this.assertMatchTeam(matchId, user);
    return this.prisma.matchNomination.update({
      where: { matchId_memberId: { matchId, memberId } },
      data: { status: 'REMOVED' },
    });
  }

  async setState(matchId: string, state: 'PLANNED' | 'LIVE' | 'FINISHED' | 'CANCELLED', user: AuthUser) {
    await this.assertMatchTeam(matchId, user);
    // Skóre sa neprepočítava pri ukončení — môže byť zadané ručne (setScore)
    // aj bez zápisu jednotlivých gólov. Pri živom zápise sa skóre dopĺňa
    // priebežne pri každom góle (addMatchEvent → recomputeScore).
    return this.prisma.match.update({ where: { id: matchId }, data: { state } });
  }

  /** Ručné nastavenie výsledku (napr. bez zápisu jednotlivých gólov). */
  async setScore(matchId: string, scoreUs: number, scoreThem: number, user: AuthUser) {
    await this.assertMatchTeam(matchId, user);
    const clamp = (n: number) => Math.max(0, Math.min(Math.trunc(Number(n) || 0), 99));
    return this.prisma.match.update({
      where: { id: matchId },
      data: { scoreUs: clamp(scoreUs), scoreThem: clamp(scoreThem) },
    });
  }

  /**
   * Živý zápis udalosti (gól, striedanie, karta...) s minutážou.
   * clientId zaručuje idempotenciu pri offline synchronizácii —
   * opakované odoslanie tej istej udalosti nevytvorí duplikát.
   */
  async addMatchEvent(matchId: string, input: MatchEventInput, user: AuthUser) {
    await this.assertMatchTeam(matchId, user);
    const createdById = user.id;
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Zápas neexistuje');
    if (match.state === 'CANCELLED') throw new BadRequestException('Zápas je zrušený');

    const existing = await this.prisma.matchEvent.findUnique({ where: { clientId: input.clientId } });
    if (existing) return existing;

    const event = await this.prisma.matchEvent.create({
      data: {
        clientId: input.clientId,
        matchId,
        minute: input.minute,
        stoppage: input.stoppage,
        type: input.type,
        memberId: input.memberId,
        relatedMemberId: input.relatedMemberId,
        note: input.note,
        createdById,
      },
    });

    if (['GOAL', 'PENALTY_SCORED', 'GOAL_CONCEDED'].includes(input.type)) {
      await this.recomputeScore(matchId);
    }
    return event;
  }

  async deleteMatchEvent(matchId: string, matchEventId: string, user: AuthUser) {
    await this.assertMatchTeam(matchId, user);
    const event = await this.prisma.matchEvent.findUnique({ where: { id: matchEventId } });
    if (!event || event.matchId !== matchId) throw new NotFoundException('Udalosť neexistuje');
    await this.prisma.matchEvent.delete({ where: { id: matchEventId } });
    await this.recomputeScore(matchId);
    return { deleted: true };
  }

  /** Skóre sa vždy dopočítava z append-only logu (gól + premenená penalta). */
  private async recomputeScore(matchId: string) {
    const [scoreUs, scoreThem] = await Promise.all([
      this.prisma.matchEvent.count({ where: { matchId, type: { in: ['GOAL', 'PENALTY_SCORED'] } } }),
      this.prisma.matchEvent.count({ where: { matchId, type: 'GOAL_CONCEDED' } }),
    ]);
    await this.prisma.match.update({ where: { id: matchId }, data: { scoreUs, scoreThem } });
  }

  /** Štatistiky hráčov: góly a asistencie. Filter podľa kategórie alebo družstva. */
  async playerStats(filter: { categoryCode?: string; teamId?: string }) {
    const matchWhere = {
      event: {
        team: {
          id: filter.teamId ? filter.teamId : undefined,
          teamCategory: filter.categoryCode ? { code: filter.categoryCode } : undefined,
        },
      },
    };
    const [goals, assists] = await Promise.all([
      this.prisma.matchEvent.groupBy({
        by: ['memberId'],
        where: { type: { in: ['GOAL', 'PENALTY_SCORED'] }, memberId: { not: null }, match: matchWhere },
        _count: { _all: true },
      }),
      this.prisma.matchEvent.groupBy({
        by: ['memberId'],
        where: { type: 'ASSIST', memberId: { not: null }, match: matchWhere },
        _count: { _all: true },
      }),
    ]);

    const ids = [...new Set([...goals, ...assists].map((g) => g.memberId!).filter(Boolean))];
    const members = await this.prisma.member.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(members.map((m) => [m.id, `${m.lastName} ${m.firstName}`]));
    const assistById = new Map(assists.map((a) => [a.memberId, a._count._all]));
    const goalById = new Map(goals.map((g) => [g.memberId, g._count._all]));

    return ids
      .map((id) => ({
        memberId: id,
        name: nameById.get(id) ?? '?',
        goals: goalById.get(id) ?? 0,
        assists: assistById.get(id) ?? 0,
      }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  }
}
