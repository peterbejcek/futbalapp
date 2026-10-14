import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  PublicArticleDto,
  PublicArticleListItemDto,
  PublicEventDetailDto,
  PublicEventDto,
  PublicEventsDto,
  PublicSquadDto,
  PublicTeamDto,
  PublicTeamsDto,
} from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  ARTICLE_DETAIL_SELECT,
  ARTICLE_LIST_SELECT,
  PUBLIC_EVENT_SELECT,
  SEASON_SELECT,
  SQUAD_MEMBER_SELECT,
  TEAM_CATEGORY_SELECT,
  clubConfig,
  decodePhotoDataUrl,
  parseDay,
  toArticleDto,
  toArticleListItem,
  toEventDto,
  toSeasonDto,
  type PublicEventRow,
} from './public.mapper';

export interface PublicEventsQuery {
  categoryCode?: string;
  teamId?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: string;
}

const DEFAULT_EVENT_LIMIT = 200;
const MAX_EVENT_LIMIT = 500;
const DEFAULT_ARTICLE_LIMIT = 50;
const MAX_ARTICLE_LIMIT = 200;

const collator = new Intl.Collator('sk');

type ActiveSeason = { id: string; name: string; startDate: Date; endDate: Date; isActive: boolean };

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aktívna sezóna z DB (pri viacerých aktívnych najnovšia podľa začiatku). */
  async activeSeason(): Promise<ActiveSeason> {
    const season = await this.prisma.season.findFirst({
      where: { isActive: true },
      orderBy: { startDate: 'desc' },
      select: SEASON_SELECT,
    });
    if (!season) throw new ServiceUnavailableException('Nie je nastavená aktívna sezóna');
    return season;
  }

  /** Platné členstvo v družstve v aktívnej sezóne (aktívny, nie demo hráč). */
  private activeMembershipWhere(seasonId: string, now: Date): Prisma.TeamMembershipWhereInput {
    return {
      seasonId,
      OR: [{ leftAt: null }, { leftAt: { gt: now } }],
      member: { status: 'ACTIVE', isDemo: false },
    };
  }

  private toTeamDto(
    t: { id: string; name: string; sortOrder: number; teamCategory: { code: string; name: string; sortOrder: number } },
    rosterSize: number,
  ): PublicTeamDto {
    return {
      id: t.id,
      name: t.name,
      categoryCode: t.teamCategory.code,
      categoryName: t.teamCategory.name,
      sortOrder: t.sortOrder,
      rosterSize,
    };
  }

  async teams(): Promise<PublicTeamsDto> {
    const club = clubConfig();
    const season = await this.activeSeason();
    const now = new Date();
    const teams = await this.prisma.team.findMany({
      where: { isDemo: false },
      orderBy: [{ teamCategory: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        teamCategory: { select: TEAM_CATEGORY_SELECT },
        _count: { select: { memberships: { where: this.activeMembershipWhere(season.id, now) } } },
      },
    });
    return {
      club,
      season: toSeasonDto(season),
      teams: teams.map((t) => this.toTeamDto(t, t._count.memberships)),
    };
  }

  async squad(teamId: string): Promise<PublicSquadDto> {
    const season = await this.activeSeason();
    const now = new Date();
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, isDemo: false },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        teamCategory: { select: TEAM_CATEGORY_SELECT },
        _count: { select: { memberships: { where: this.activeMembershipWhere(season.id, now) } } },
      },
    });
    if (!team) throw new NotFoundException('Družstvo neexistuje');

    const base = this.activeMembershipWhere(season.id, now);
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        ...base,
        teamId: team.id,
        member: { status: 'ACTIVE', isDemo: false, publicProfileConsent: true },
      },
      select: { member: { select: SQUAD_MEMBER_SELECT } },
    });

    const seen = new Set<string>();
    const players = memberships
      .map((m) => m.member)
      .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
      .sort((a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName))
      .map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        photoUrl: m.publicPhotoConsent && m.photo ? `/api/v1/public/players/${m.id}/photo` : null,
      }));

    return { team: this.toTeamDto(team, team._count.memberships), season: toSeasonDto(season), players };
  }

  /** Fotka hráča len pri súhlase so zverejnením profilu aj fotky. null = 404. */
  async playerPhoto(memberId: string): Promise<{ mime: string; buffer: Buffer } | null> {
    const member = await this.prisma.member.findFirst({
      where: {
        id: memberId,
        isDemo: false,
        status: 'ACTIVE',
        publicProfileConsent: true,
        publicPhotoConsent: true,
      },
      select: { photo: { select: { dataUrl: true } } },
    });
    return decodePhotoDataUrl(member?.photo?.dataUrl);
  }

  /** Základná podmienka verejnej udalosti (zápas/turnaj vždy, tréning len isPublic). */
  private publicEventWhere(seasonId: string): Prisma.EventWhereInput {
    return {
      isDemo: false,
      seasonId,
      teamId: { not: null },
      team: { isDemo: false },
      OR: [{ type: { in: ['MATCH', 'TOURNAMENT'] } }, { type: 'TRAINING', isPublic: true }],
    };
  }

  async events(query: PublicEventsQuery): Promise<PublicEventsDto> {
    const and: Prisma.EventWhereInput[] = [];

    if (query.type !== undefined && query.type !== '') {
      if (query.type === 'match') and.push({ type: { in: ['MATCH', 'TOURNAMENT'] } });
      else if (query.type === 'training') and.push({ type: 'TRAINING' });
      else throw new BadRequestException('Neplatný typ (match | training)');
    }
    if (query.teamId) and.push({ teamId: query.teamId });
    if (query.categoryCode) and.push({ team: { teamCategory: { code: query.categoryCode } } });

    // from/to sú kalendárne dni v pásme klubu; časy sú v DB uložené ako nástenný čas
    // v UTC komponentoch, takže hranice dňa sú polnoci v UTC komponentoch.
    if (query.from) {
      const from = parseDay(query.from);
      if (!from) throw new BadRequestException('Neplatný dátum from (YYYY-MM-DD)');
      and.push({ startAt: { gte: from } });
    }
    if (query.to) {
      const to = parseDay(query.to);
      if (!to) throw new BadRequestException('Neplatný dátum to (YYYY-MM-DD)');
      and.push({ startAt: { lt: new Date(to.getTime() + 24 * 3600 * 1000) } });
    }

    let limit = DEFAULT_EVENT_LIMIT;
    if (query.limit !== undefined && query.limit !== '') {
      if (!/^\d+$/.test(query.limit) || Number(query.limit) < 1) throw new BadRequestException('Neplatný limit');
      limit = Math.min(Number(query.limit), MAX_EVENT_LIMIT);
    }

    const club = clubConfig();
    const season = await this.activeSeason();
    const rows = await this.prisma.event.findMany({
      where: { AND: [this.publicEventWhere(season.id), ...and] },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: PUBLIC_EVENT_SELECT,
    });
    const events = (rows as PublicEventRow[])
      .map((r) => toEventDto(r, club))
      .filter((e): e is PublicEventDto => e !== null);
    return { club, season: toSeasonDto(season), events };
  }

  async event(id: string): Promise<PublicEventDetailDto> {
    const club = clubConfig();
    const season = await this.activeSeason();
    const row = await this.prisma.event.findFirst({
      where: { AND: [{ id }, this.publicEventWhere(season.id)] },
      select: PUBLIC_EVENT_SELECT,
    });
    const event = row ? toEventDto(row as PublicEventRow, club) : null;
    if (!event) throw new NotFoundException('Udalosť neexistuje');
    return { club, event };
  }

  async articles(limitRaw?: string): Promise<PublicArticleListItemDto[]> {
    let limit = DEFAULT_ARTICLE_LIMIT;
    if (limitRaw !== undefined && limitRaw !== '') {
      if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1) throw new BadRequestException('Neplatný limit');
      limit = Math.min(Number(limitRaw), MAX_ARTICLE_LIMIT);
    }
    const rows = await this.prisma.article.findMany({
      where: { publishedAt: { not: null, lte: new Date() } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: ARTICLE_LIST_SELECT,
    });
    return rows.map(toArticleListItem);
  }

  async article(slug: string): Promise<PublicArticleDto> {
    const row = await this.prisma.article.findFirst({
      where: { slug, publishedAt: { not: null, lte: new Date() } },
      select: ARTICLE_DETAIL_SELECT,
    });
    if (!row) throw new NotFoundException('Článok neexistuje');
    return toArticleDto(row);
  }
}
