import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { coachBlockedFromTeam } from '../../auth/scope';
import type { AuthUser } from '../../auth/current-user.decorator';
import { toBratislavaWallClock } from './futbalnet.service';
import { parseSportnetMatch, parseSportnetMatchUrl } from './sportnet-match.parser';
import { normalizeName, planMatchSync } from './match-sync.plan';

const MATCH_URL = (appSpace: string, id: string) => `https://sportnet.sme.sk/futbalnet/z/${appSpace}/zapas/${id}/`;

export type SyncStatus = 'UPDATED' | 'NO_CHANGE' | 'NO_RESULT' | 'ERROR';

/**
 * Kontrola odohraných zápasov proti futbalnetu: každý večer o 20:00 sa pre zápasy
 * dňa načíta výsledok a strelci, porovnajú sa so zapísanými, rozdiely sa opravia
 * a každá úprava sa zaznamená (MatchSyncLog).
 */
@Injectable()
export class MatchSyncService {
  private readonly logger = new Logger(MatchSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 20 * * *', { timeZone: 'Europe/Bratislava' })
  async syncToday() {
    const w = toBratislavaWallClock(new Date());
    const from = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
    const to = new Date(from.getTime() + 24 * 3600_000);
    const matches = await this.prisma.match.findMany({
      where: {
        state: { not: 'CANCELLED' },
        event: { startAt: { gte: from, lt: to }, OR: [{ futbalnetId: { startsWith: 'sn:' } }] },
      },
      select: { id: true },
    });
    const withUrl = await this.prisma.match.findMany({
      where: { state: { not: 'CANCELLED' }, sportnetUrl: { not: null }, event: { startAt: { gte: from, lt: to } } },
      select: { id: true },
    });
    const ids = [...new Set([...matches, ...withUrl].map((m) => m.id))];
    for (const id of ids) {
      try {
        await this.syncMatch(id, 'CRON');
      } catch (error) {
        this.logger.warn(`Sync zápasu ${id} zlyhal: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { checked: ids.length };
  }

  /** Ručné spustenie z detailu zápasu; voliteľne s odkazom na zápas (nalinkuje ho). */
  async syncManual(matchId: string, user: AuthUser, url?: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, select: { event: { select: { teamId: true } } } });
    if (!match) throw new NotFoundException('Zápas neexistuje');
    if (coachBlockedFromTeam(user, match.event.teamId)) throw new ForbiddenException('Zápas môžete synchronizovať len pre svoje družstvo');
    if (url) {
      const ref = parseSportnetMatchUrl(url);
      if (!ref) throw new BadRequestException('Neplatný odkaz na zápas (očakáva sa …/futbalnet/z/<súťaž>/zapas/<id>/)');
      await this.prisma.match.update({ where: { id: matchId }, data: { sportnetUrl: MATCH_URL(ref.appSpace, ref.id) } });
    }
    return this.syncMatch(matchId, 'MANUAL');
  }

  private async resolveUrl(match: { sportnetUrl: string | null; event: { futbalnetId: string | null; team: { sportnetProgramUrl: string | null } | null } }) {
    if (match.sportnetUrl) return match.sportnetUrl;
    const id = match.event.futbalnetId?.startsWith('sn:') ? match.event.futbalnetId.slice(3) : null;
    if (!id) return null;
    const appSpace = /\/futbalnet\/[a-z]\/([^/]+)\//.exec(match.event.team?.sportnetProgramUrl ?? '')?.[1] ?? 'vsfz';
    return MATCH_URL(appSpace, id);
  }

  async syncMatch(matchId: string, source: 'CRON' | 'MANUAL'): Promise<{ status: SyncStatus; changes: string[] }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        events: true,
        nominations: { include: { member: { select: { id: true, firstName: true, lastName: true } } } },
        event: { include: { team: true } },
      },
    });
    if (!match) throw new NotFoundException('Zápas neexistuje');
    const log = async (status: SyncStatus, changes: string[]) => {
      if (source === 'CRON' && status === 'NO_CHANGE') return;
      await this.prisma.matchSyncLog.create({ data: { matchId, source, status, changes } });
    };

    const url = await this.resolveUrl(match);
    if (!url) {
      if (source === 'MANUAL') throw new BadRequestException('Zápas nie je prepojený s futbalnetom — zadajte odkaz na zápas.');
      return { status: 'NO_RESULT', changes: [] };
    }

    let html: string;
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fkknv.sk portal)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      html = await response.text();
    } catch (error) {
      const msg = `Stránku zápasu sa nepodarilo načítať (${error instanceof Error ? error.message : error})`;
      await log('ERROR', [msg]);
      if (source === 'MANUAL') throw new BadRequestException(msg);
      return { status: 'ERROR', changes: [msg] };
    }
    const parsed = parseSportnetMatch(html);
    if (!parsed) {
      const msg = 'Na stránke zápasu sa nenašli údaje (zmenila sa štruktúra futbalnetu?)';
      await log('ERROR', [msg]);
      if (source === 'MANUAL') throw new BadRequestException(msg);
      return { status: 'ERROR', changes: [msg] };
    }
    // ručne zadaný odkaz: over, že ide o náš zápas (súper musí sedieť)
    const opp = normalizeName(match.opponent);
    const sides = [normalizeName(parsed.homeName), normalizeName(parsed.awayName)];
    if (source === 'MANUAL' && !sides.some((s) => s.includes(opp) || opp.includes(s))) {
      throw new BadRequestException(`Zápas na futbalnete (${parsed.homeName} – ${parsed.awayName}) nesedí so súperom „${match.opponent}".`);
    }

    const roster = new Map<string, { id: string; firstName: string; lastName: string }>();
    for (const n of match.nominations) roster.set(n.member.id, n.member);
    if (match.event.teamId) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { teamId: match.event.teamId, seasonId: match.event.seasonId, leftAt: null },
        select: { member: { select: { id: true, firstName: true, lastName: true } } },
      });
      for (const m of memberships) roster.set(m.member.id, m.member);
    }
    const label = (id: string) => {
      const m = roster.get(id);
      return m ? `${m.firstName} ${m.lastName}` : 'hráč';
    };

    const plan = planMatchSync({ isHome: match.isHome, parsed, recorded: match.events, roster: [...roster.values()], memberLabel: label });
    if (!plan) {
      await log('NO_RESULT', ['Výsledok zápasu zatiaľ nie je na futbalnete.']);
      return { status: 'NO_RESULT', changes: ['Výsledok zápasu zatiaľ nie je na futbalnete.'] };
    }

    const changes = [...plan.changes];
    await this.prisma.$transaction(async (tx) => {
      if (plan.remove.length) await tx.matchEvent.deleteMany({ where: { id: { in: plan.remove.map((r) => r.id) } } });
      for (const a of plan.add) {
        await tx.matchEvent.create({
          data: { clientId: `sync-${randomUUID()}`, matchId, minute: a.minute, type: a.type, memberId: a.memberId, note: a.note },
        });
      }
      if (match.scoreUs !== plan.scoreUs || match.scoreThem !== plan.scoreThem) {
        changes.unshift(`Skóre: ${match.scoreUs ?? 0}:${match.scoreThem ?? 0} → ${plan.scoreUs}:${plan.scoreThem} (z pohľadu FK KNV)`);
      }
      const data: { scoreUs: number; scoreThem: number; state?: 'FINISHED' } = { scoreUs: plan.scoreUs, scoreThem: plan.scoreThem };
      if (match.state !== 'FINISHED') {
        data.state = 'FINISHED';
        changes.push('Zápas označený ako ukončený');
      }
      await tx.match.update({ where: { id: matchId }, data });
    });

    const status: SyncStatus = changes.length ? 'UPDATED' : 'NO_CHANGE';
    await log(status, changes.length ? changes : ['Bez rozdielov — zapísané údaje sedia s futbalnetom.']);
    return { status, changes };
  }
}
