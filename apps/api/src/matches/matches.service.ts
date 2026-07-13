import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MatchEventInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        event: { include: { teamCategory: true } },
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

  /** Pridanie hráča do nominácie (aj tesne pred zápasom). */
  nominate(matchId: string, memberId: string) {
    return this.prisma.matchNomination.upsert({
      where: { matchId_memberId: { matchId, memberId } },
      create: { matchId, memberId },
      update: { status: 'NOMINATED' },
    });
  }

  /** Odobratie hráča z nominácie — záznam ostáva pre históriu so statusom REMOVED. */
  removeNomination(matchId: string, memberId: string) {
    return this.prisma.matchNomination.update({
      where: { matchId_memberId: { matchId, memberId } },
      data: { status: 'REMOVED' },
    });
  }

  async setState(matchId: string, state: 'PLANNED' | 'LIVE' | 'FINISHED' | 'CANCELLED') {
    const match = await this.prisma.match.update({ where: { id: matchId }, data: { state } });
    if (state === 'FINISHED') {
      await this.recomputeScore(matchId);
    }
    return match;
  }

  /**
   * Živý zápis udalosti (gól, striedanie, karta...) s minutážou.
   * clientId zaručuje idempotenciu pri offline synchronizácii —
   * opakované odoslanie tej istej udalosti nevytvorí duplikát.
   */
  async addMatchEvent(matchId: string, input: MatchEventInput, createdById: string) {
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
        type: input.type,
        memberId: input.memberId,
        relatedMemberId: input.relatedMemberId,
        note: input.note,
        createdById,
      },
    });

    if (input.type === 'GOAL' || input.type === 'GOAL_CONCEDED') {
      await this.recomputeScore(matchId);
    }
    return event;
  }

  async deleteMatchEvent(matchId: string, matchEventId: string) {
    const event = await this.prisma.matchEvent.findUnique({ where: { id: matchEventId } });
    if (!event || event.matchId !== matchId) throw new NotFoundException('Udalosť neexistuje');
    await this.prisma.matchEvent.delete({ where: { id: matchEventId } });
    await this.recomputeScore(matchId);
    return { deleted: true };
  }

  /** Skóre sa vždy dopočítava z append-only logu udalostí. */
  private async recomputeScore(matchId: string) {
    const [scoreUs, scoreThem] = await Promise.all([
      this.prisma.matchEvent.count({ where: { matchId, type: 'GOAL' } }),
      this.prisma.matchEvent.count({ where: { matchId, type: 'GOAL_CONCEDED' } }),
    ]);
    await this.prisma.match.update({ where: { id: matchId }, data: { scoreUs, scoreThem } });
  }

  /** Štatistiky hráčov kategórie: góly, asistencie, účasť na zápasoch. */
  async playerStats(categoryCode: string) {
    const goals = await this.prisma.matchEvent.groupBy({
      by: ['memberId'],
      where: {
        type: 'GOAL',
        memberId: { not: null },
        match: { event: { teamCategory: { code: categoryCode } } },
      },
      _count: { _all: true },
    });
    const members = await this.prisma.member.findMany({
      where: { id: { in: goals.map((g) => g.memberId!).filter(Boolean) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
    return goals
      .map((g) => ({ memberId: g.memberId, name: nameById.get(g.memberId!) ?? '?', goals: g._count._all }))
      .sort((a, b) => b.goals - a.goals);
  }
}
