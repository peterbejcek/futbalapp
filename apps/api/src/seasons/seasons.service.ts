import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { categoryForBirthDate, type CategoryRule as SharedRule, type CategoryCode } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.season.findMany({
      include: { categoryRules: { include: { teamCategory: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  active() {
    return this.prisma.season.findFirst({
      where: { isActive: true },
      include: { categoryRules: { include: { teamCategory: true } } },
    });
  }

  categories() {
    return this.prisma.teamCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { teams: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  /** Zoznam všetkých družstiev (na výber v UI). */
  teams() {
    return this.prisma.team.findMany({
      include: { teamCategory: { select: { code: true, name: true, sortOrder: true } } },
      orderBy: [{ teamCategory: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  async createTeam(teamCategoryCode: string, name: string) {
    const category = await this.prisma.teamCategory.findUnique({ where: { code: teamCategoryCode } });
    if (!category) throw new NotFoundException(`Kategória ${teamCategoryCode} neexistuje`);
    const count = await this.prisma.team.count({ where: { teamCategoryId: category.id } });
    return this.prisma.team.create({
      data: { teamCategoryId: category.id, name, sortOrder: count },
    });
  }

  /**
   * Navrhne/aktualizuje zaradenie aktívnych členov do predvoleného družstva
   * kategórie podľa ročníka. Manuálne výnimky (isException) sa nemenia a hráča,
   * ktorý je už v družstve správnej kategórie (napr. presunutý do B), nechá tak.
   */
  async assignMemberships(seasonId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        categoryRules: {
          include: { teamCategory: { include: { teams: { orderBy: { sortOrder: 'asc' } } } } },
        },
      },
    });
    if (!season) throw new NotFoundException('Sezóna neexistuje');

    const rules: Array<SharedRule & { teamCategoryId: string; defaultTeamId: string | null }> =
      season.categoryRules.map((r) => ({
        categoryCode: r.teamCategory.code as CategoryCode,
        birthYearFrom: r.birthYearFrom,
        birthYearTo: r.birthYearTo,
        teamCategoryId: r.teamCategoryId,
        defaultTeamId: r.teamCategory.teams[0]?.id ?? null,
      }));

    const members = await this.prisma.member.findMany({
      // len hráči (majú dátum narodenia); rodičia/tréneri bez dátumu sa nezaraďujú
      where: { status: 'ACTIVE', birthDate: { not: null } },
      include: { memberships: { where: { seasonId }, include: { team: true } } },
    });

    const result = { assigned: 0, unchanged: 0, skippedExceptions: 0, unmatched: [] as string[] };

    for (const member of members) {
      const code = categoryForBirthDate(member.birthDate!, rules);
      const rule = rules.find((r) => r.categoryCode === code);
      if (!code || !rule || !rule.defaultTeamId) {
        result.unmatched.push(`${member.firstName} ${member.lastName}`);
        continue;
      }
      const existing = member.memberships[0];
      if (existing?.isException) {
        result.skippedExceptions++;
        continue;
      }
      // hráč už je v družstve správnej kategórie (napr. B tím) → nemeníme
      if (existing && existing.team.teamCategoryId === rule.teamCategoryId) {
        result.unchanged++;
        continue;
      }
      await this.prisma.teamMembership.upsert({
        where: { memberId_seasonId: { memberId: member.id, seasonId } },
        create: { memberId: member.id, seasonId, teamId: rule.defaultTeamId },
        update: { teamId: rule.defaultTeamId, isException: false },
      });
      result.assigned++;
    }
    return result;
  }

  /** Manuálne priradenie hráča do konkrétneho družstva (výnimka). */
  async overrideMembership(seasonId: string, memberId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Družstvo neexistuje');
    return this.prisma.teamMembership.upsert({
      where: { memberId_seasonId: { memberId, seasonId } },
      create: { memberId, seasonId, teamId, isException: true },
      update: { teamId, isException: true },
    });
  }
}
