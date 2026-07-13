import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.teamCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Navrhne/aktualizuje zaradenie všetkých aktívnych členov do kategórií
   * podľa pravidiel sezóny. Existujúce manuálne výnimky (isException) sa nemenia.
   * Vráti prehľad vykonaných zmien.
   */
  async assignMemberships(seasonId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { categoryRules: { include: { teamCategory: true } } },
    });
    if (!season) throw new NotFoundException('Sezóna neexistuje');

    const rules: Array<SharedRule & { teamCategoryId: string }> = season.categoryRules.map((r) => ({
      categoryCode: r.teamCategory.code as CategoryCode,
      birthYearFrom: r.birthYearFrom,
      birthYearTo: r.birthYearTo,
      teamCategoryId: r.teamCategoryId,
    }));

    const members = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      include: { memberships: { where: { seasonId } } },
    });

    const result = { assigned: 0, unchanged: 0, skippedExceptions: 0, unmatched: [] as string[] };

    for (const member of members) {
      const code = categoryForBirthDate(member.birthDate, rules);
      const rule = rules.find((r) => r.categoryCode === code);
      if (!code || !rule) {
        result.unmatched.push(`${member.firstName} ${member.lastName}`);
        continue;
      }
      const existing = member.memberships[0];
      if (existing?.isException) {
        result.skippedExceptions++;
        continue;
      }
      if (existing?.teamCategoryId === rule.teamCategoryId) {
        result.unchanged++;
        continue;
      }
      await this.prisma.teamMembership.upsert({
        where: { memberId_seasonId: { memberId: member.id, seasonId } },
        create: { memberId: member.id, seasonId, teamCategoryId: rule.teamCategoryId },
        update: { teamCategoryId: rule.teamCategoryId },
      });
      result.assigned++;
    }
    return result;
  }

  /** Manuálne preradenie hráča (výnimka — napr. hráva za vyššiu kategóriu). */
  async overrideMembership(seasonId: string, memberId: string, teamCategoryCode: string) {
    const category = await this.prisma.teamCategory.findUnique({ where: { code: teamCategoryCode } });
    if (!category) throw new NotFoundException(`Kategória ${teamCategoryCode} neexistuje`);
    return this.prisma.teamMembership.upsert({
      where: { memberId_seasonId: { memberId, seasonId } },
      create: { memberId, seasonId, teamCategoryId: category.id, isException: true },
      update: { teamCategoryId: category.id, isException: true },
    });
  }
}
