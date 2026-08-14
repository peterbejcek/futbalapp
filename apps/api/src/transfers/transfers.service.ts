import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamIds, isStaff } from '../auth/scope';
import type { AuthUser } from '../auth/current-user.decorator';

type TransferMode = 'MOVE' | 'ADD';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  private async activeSeason() {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');
    return season;
  }

  private async currentTeamIds(memberId: string, seasonId: string): Promise<string[]> {
    const rows = await this.prisma.teamMembership.findMany({
      where: { memberId, seasonId, leftAt: null },
      select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
  }

  /** Vykoná presun: MOVE odstráni ostatné družstvá v sezóne, ADD len pridá cieľové. */
  private async applyTransfer(memberId: string, toTeamId: string, mode: TransferMode, seasonId: string) {
    if (mode === 'MOVE') {
      await this.prisma.teamMembership.deleteMany({ where: { memberId, seasonId, teamId: { not: toTeamId } } });
    }
    await this.prisma.teamMembership.upsert({
      where: { memberId_seasonId_teamId: { memberId, seasonId, teamId: toTeamId } },
      create: { memberId, seasonId, teamId: toTeamId, isException: true },
      update: { leftAt: null, isException: true },
    });
  }

  /**
   * Požiadavka na presun hráča do družstva. Vedenie a tréner, ktorý spravuje všetky
   * aktuálne družstvá hráča, presunú priamo. Inak vznikne žiadosť na schválenie
   * trénerom aktuálneho družstva (alebo vedením).
   */
  async request(memberId: string, toTeamId: string, mode: TransferMode, user: AuthUser) {
    const season = await this.activeSeason();
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Hráč neexistuje');
    const toTeam = await this.prisma.team.findUnique({ where: { id: toTeamId } });
    if (!toTeam) throw new NotFoundException('Cieľové družstvo neexistuje');

    const myTeams = coachTeamIds(user);
    if (!isStaff(user) && !myTeams.includes(toTeamId)) {
      throw new ForbiddenException('Presun môžete žiadať len do vlastného družstva');
    }

    const current = await this.currentTeamIds(memberId, season.id);
    if (current.includes(toTeamId)) throw new BadRequestException('Hráč už je v tomto družstve');

    const staff = isStaff(user);
    const ownsAllCurrent = current.length > 0 && current.every((t) => myTeams.includes(t));
    if (staff || current.length === 0 || ownsAllCurrent) {
      await this.applyTransfer(memberId, toTeamId, mode, season.id);
      return { applied: true, pending: false };
    }

    // duplicitná otvorená žiadosť?
    const existing = await this.prisma.teamTransferRequest.findFirst({
      where: { memberId, toTeamId, status: 'PENDING' },
    });
    if (existing) return { applied: false, pending: true, requestId: existing.id };

    const req = await this.prisma.teamTransferRequest.create({
      data: { memberId, toTeamId, fromTeamId: current[0] ?? null, mode, requestedById: user.id },
    });
    return { applied: false, pending: true, requestId: req.id };
  }

  /** Žiadosti čakajúce na schválenie, ktoré daný používateľ vidí (vedenie / tréner aktuálneho družstva / žiadateľ). */
  async pending(user: AuthUser) {
    const season = await this.activeSeason();
    const staff = isStaff(user);
    const myTeams = coachTeamIds(user);

    const requests = await this.prisma.teamTransferRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    const visible: Array<{ req: (typeof requests)[number]; canApprove: boolean }> = [];
    for (const req of requests) {
      const current = await this.currentTeamIds(req.memberId, season.id);
      const approver = staff || current.some((t) => myTeams.includes(t));
      if (approver || req.requestedById === user.id) visible.push({ req, canApprove: approver });
    }

    const memberIds = [...new Set(visible.map((v) => v.req.memberId))];
    const teamIds = [
      ...new Set(visible.flatMap((v) => [v.req.toTeamId, v.req.fromTeamId].filter((x): x is string => !!x))),
    ];
    const [members, teams, requesters] = await Promise.all([
      this.prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, firstName: true, lastName: true } }),
      this.prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(visible.map((v) => v.req.requestedById))] } },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);
    const mMap = new Map(members.map((m) => [m.id, m]));
    const tMap = new Map(teams.map((t) => [t.id, t.name]));
    const uMap = new Map(requesters.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return visible.map(({ req, canApprove }) => {
      const m = mMap.get(req.memberId);
      return {
        id: req.id,
        memberName: m ? `${m.lastName} ${m.firstName}` : '—',
        fromTeamName: req.fromTeamId ? tMap.get(req.fromTeamId) ?? null : null,
        toTeamName: tMap.get(req.toTeamId) ?? '—',
        mode: req.mode,
        requestedBy: uMap.get(req.requestedById) ?? '—',
        createdAt: req.createdAt,
        canApprove,
      };
    });
  }

  private async resolve(id: string, user: AuthUser, approve: boolean) {
    const req = await this.prisma.teamTransferRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Žiadosť neexistuje');
    if (req.status !== 'PENDING') throw new BadRequestException('Žiadosť už bola spracovaná');
    const season = await this.activeSeason();
    const current = await this.currentTeamIds(req.memberId, season.id);
    if (!isStaff(user) && !current.some((t) => coachTeamIds(user).includes(t))) {
      throw new ForbiddenException('Túto žiadosť nemôžete schváliť');
    }
    if (approve) {
      await this.applyTransfer(req.memberId, req.toTeamId, req.mode as TransferMode, season.id);
    }
    await this.prisma.teamTransferRequest.update({
      where: { id },
      data: { status: approve ? 'APPROVED' : 'REJECTED', resolvedById: user.id, resolvedAt: new Date() },
    });
    return { status: approve ? 'APPROVED' : 'REJECTED' };
  }

  approve(id: string, user: AuthUser) {
    return this.resolve(id, user, true);
  }
  reject(id: string, user: AuthUser) {
    return this.resolve(id, user, false);
  }
}
