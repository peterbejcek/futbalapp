import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { parseMatchesFromHtml, type NormalizedMatch } from './futbalnet.parser';
import { parseSportnetProgram, sportnetMatchKey } from './sportnet.parser';
import { ClubsService } from '../../clubs/clubs.service';

/** Zápas nášho tímu odvodený z futbalnet dát. */
interface OurMatch extends NormalizedMatch {
  opponent: string;
  isHome: boolean;
}

@Injectable()
export class FutbalnetService {
  private readonly logger = new Logger(FutbalnetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clubs: ClubsService,
  ) {}

  /** Uloží sportnet program URL + názov nášho tímu pre konkrétne družstvo. */
  async setTeamSportnet(teamId: string, programUrl: string | null, teamName: string | null) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Družstvo neexistuje');
    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        sportnetProgramUrl: programUrl?.trim() || null,
        sportnetTeamName: teamName?.trim() || null,
      },
    });
  }

  /**
   * Stiahne program súťaže zo sportnet.sme.sk a vytvorí/aktualizuje zápasy
   * daného družstva (idempotentne podľa stabilného kľúča zápasu).
   */
  async importTeamProgram(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Družstvo neexistuje');
    if (!team.sportnetProgramUrl || !team.sportnetTeamName) {
      throw new BadRequestException('Najprv nastavte odkaz na program a názov tímu na sportnete.');
    }
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');

    const response = await fetch(team.sportnetProgramUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (fkknv.sk portal)' },
    });
    if (!response.ok) {
      throw new BadRequestException(`Stránku sa nepodarilo načítať (HTTP ${response.status}).`);
    }
    const html = await response.text();
    const fixtures = parseSportnetProgram(html);
    const ourName = team.sportnetTeamName.trim().toLowerCase();

    let created = 0;
    let updated = 0;
    let ours = 0;
    for (const f of fixtures) {
      const homeIsUs = f.home.toLowerCase() === ourName;
      const awayIsUs = f.away.toLowerCase() === ourName;
      if (!homeIsUs && !awayIsUs) continue;
      ours++;

      const opponent = homeIsUs ? f.away : f.home;
      const opponentLogo = (homeIsUs ? f.awayLogo : f.homeLogo) ?? null;
      // doplň klub do registra (aj s logom)
      await this.clubs.create({ name: opponent, logoUrl: opponentLogo });

      const title = homeIsUs ? `${team.name} vs ${opponent}` : `${opponent} vs ${team.name}`;
      const externalId = sportnetMatchKey(f);

      const existing = await this.prisma.event.findUnique({
        where: { futbalnetId: externalId },
        include: { match: true },
      });
      if (existing) {
        await this.prisma.event.update({
          where: { id: existing.id },
          data: { startAt: f.startAt, title, teamId: team.id },
        });
        if (existing.match) {
          await this.prisma.match.update({
            where: { id: existing.match.id },
            data: { opponent, isHome: homeIsUs, opponentLogo },
          });
        }
        updated++;
      } else {
        await this.prisma.event.create({
          data: {
            type: 'MATCH',
            seasonId: season.id,
            teamId: team.id,
            title,
            startAt: f.startAt,
            source: 'FUTBALNET',
            futbalnetId: externalId,
            match: { create: { opponent, isHome: homeIsUs, opponentLogo } },
          },
        });
        created++;
      }
    }
    return { total: fixtures.length, ours, created, updated };
  }

  /** Uloží konfiguráciu sync-u pre kategóriu (URL súťaže + názov nášho tímu). */
  async configure(categoryCode: string, url: string | null, teamName: string | null) {
    const category = await this.prisma.teamCategory.findUnique({ where: { code: categoryCode } });
    if (!category) throw new NotFoundException(`Kategória ${categoryCode} neexistuje`);
    return this.prisma.teamCategory.update({
      where: { id: category.id },
      data: { futbalnetCompetitionUrl: url, futbalnetTeamName: teamName },
    });
  }

  /** Nastaví verejnú sportnet.sme.sk URL súťaže pre kategóriu (embed programu/tabuľky). */
  async setSportnetUrl(categoryCode: string, url: string | null) {
    const category = await this.prisma.teamCategory.findUnique({ where: { code: categoryCode } });
    if (!category) throw new NotFoundException(`Kategória ${categoryCode} neexistuje`);
    const clean = url?.trim().replace(/\/+$/, '') || null;
    return this.prisma.teamCategory.update({ where: { id: category.id }, data: { sportnetUrl: clean } });
  }

  /** Týždenný sync všetkých nakonfigurovaných kategórií (pondelok 5:00). */
  @Cron('0 5 * * 1')
  async syncAll() {
    const categories = await this.prisma.teamCategory.findMany({
      where: { futbalnetCompetitionUrl: { not: null } },
    });
    const results: Record<string, unknown> = {};
    for (const category of categories) {
      try {
        results[category.code] = await this.syncCategory(category.code);
      } catch (error) {
        results[category.code] = { error: error instanceof Error ? error.message : String(error) };
        this.logger.warn(`Futbalnet sync ${category.code} zlyhal: ${error}`);
      }
    }
    this.logger.log(`Futbalnet sync: ${JSON.stringify(results)}`);
    return results;
  }

  /** Stiahne stránku súťaže z futbalnetu a naimportuje zápasy kategórie. */
  async syncCategory(categoryCode: string) {
    const category = await this.prisma.teamCategory.findUnique({ where: { code: categoryCode } });
    if (!category) throw new NotFoundException(`Kategória ${categoryCode} neexistuje`);
    if (!category.futbalnetCompetitionUrl || !category.futbalnetTeamName) {
      throw new BadRequestException(
        `Kategória ${categoryCode} nemá nastavenú futbalnet URL a názov tímu (POST /futbalnet/config/${categoryCode})`,
      );
    }

    const response = await fetch(category.futbalnetCompetitionUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (fkknv.sk portal)' },
    });
    if (!response.ok) {
      throw new BadRequestException(`Futbalnet vrátil ${response.status} pre ${category.futbalnetCompetitionUrl}`);
    }
    const html = await response.text();
    const matches = parseMatchesFromHtml(html);
    return this.importMatches(categoryCode, matches);
  }

  /**
   * Idempotentný import zápasov (z fetchu alebo manuálne poslaného JSON-u).
   * Vyberie len zápasy nášho tímu, existujúce (podľa futbalnetId) aktualizuje —
   * zmena termínu na futbalnete sa premietne do kalendára. Interné zápasy
   * vytvorené trénerom sa nikdy nemenia.
   */
  async importMatches(categoryCode: string, matches: NormalizedMatch[]) {
    const category = await this.prisma.teamCategory.findUnique({ where: { code: categoryCode } });
    if (!category) throw new NotFoundException(`Kategória ${categoryCode} neexistuje`);
    const teamName = category.futbalnetTeamName;
    if (!teamName) {
      throw new BadRequestException(`Kategória ${categoryCode} nemá nastavený futbalnetTeamName`);
    }
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');

    // futbalnet zápasy patria predvolenému družstvu kategórie
    const defaultTeam = await this.prisma.team.findFirst({
      where: { teamCategoryId: category.id },
      orderBy: { sortOrder: 'asc' },
    });
    if (!defaultTeam) {
      throw new BadRequestException(`Kategória ${categoryCode} nemá žiadne družstvo`);
    }

    const normalizedTeam = teamName.trim().toLowerCase();
    const ours: OurMatch[] = [];
    for (const match of matches) {
      const isHome = match.homeTeam.trim().toLowerCase() === normalizedTeam;
      const isAway = match.awayTeam.trim().toLowerCase() === normalizedTeam;
      if (!isHome && !isAway) continue;
      ours.push({ ...match, isHome, opponent: isHome ? match.awayTeam : match.homeTeam });
    }

    let created = 0;
    let updated = 0;
    for (const match of ours) {
      const futbalnetId = `${categoryCode}:${match.externalId}`;
      const title = match.isHome ? `${teamName} vs ${match.opponent}` : `${match.opponent} vs ${teamName}`;
      const existing = await this.prisma.event.findUnique({ where: { futbalnetId } });
      if (existing) {
        await this.prisma.event.update({
          where: { id: existing.id },
          data: { startAt: match.startAt, location: match.location, title },
        });
        updated++;
      } else {
        await this.prisma.event.create({
          data: {
            type: 'MATCH',
            seasonId: season.id,
            teamId: defaultTeam.id,
            title,
            startAt: match.startAt,
            location: match.location,
            source: 'FUTBALNET',
            futbalnetId,
            match: {
              create: { opponent: match.opponent, isHome: match.isHome, competition: match.competition },
            },
          },
        });
        created++;
      }
    }
    return { parsed: matches.length, ourMatches: ours.length, created, updated };
  }
}
