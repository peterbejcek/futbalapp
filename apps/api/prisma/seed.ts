import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CATEGORY_CODES, defaultCategoryRules, seasonFromStartYear } from '@fkknv/shared';

const prisma = new PrismaClient();

const CATEGORY_NAMES: Record<string, string> = {
  U8: 'Prípravka U8',
  U9: 'Prípravka U9',
  U10: 'Prípravka U10',
  U11: 'Mladší žiaci U11',
  U13: 'Starší žiaci U13',
  U15: 'Mladší dorast U15',
  U17: 'Dorast U17',
  U19: 'Starší dorast U19',
  MUZI: 'Muži',
};

async function main() {
  // 1. Kategórie
  for (const [index, code] of CATEGORY_CODES.entries()) {
    await prisma.teamCategory.upsert({
      where: { code },
      create: { code, name: CATEGORY_NAMES[code] ?? code, sortOrder: index },
      update: { name: CATEGORY_NAMES[code] ?? code, sortOrder: index },
    });
  }

  // 2. Sezóna 2026/2027 + pravidlá zaradenia podľa ročníkov
  const bounds = seasonFromStartYear(2026);
  const season = await prisma.season.upsert({
    where: { name: bounds.name },
    create: { name: bounds.name, startDate: bounds.startDate, endDate: bounds.endDate, isActive: true },
    update: { isActive: true },
  });

  for (const rule of defaultCategoryRules(2026)) {
    const category = await prisma.teamCategory.findUniqueOrThrow({ where: { code: rule.categoryCode } });
    await prisma.categoryRule.upsert({
      where: { seasonId_teamCategoryId: { seasonId: season.id, teamCategoryId: category.id } },
      create: {
        seasonId: season.id,
        teamCategoryId: category.id,
        birthYearFrom: rule.birthYearFrom,
        birthYearTo: rule.birthYearTo,
      },
      update: { birthYearFrom: rule.birthYearFrom, birthYearTo: rule.birthYearTo },
    });
  }

  // 3. Admin účet (len ak neexistuje)
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@fkknv.sk').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'zmen-ma-hned';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'FKKNV',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        roles: { create: { role: 'ADMIN' } },
      },
    });
    console.log(`Vytvorený admin účet ${adminEmail}`);
  }

  // 4. Komunikačné kanály per kategória + celoklubové oznamy
  for (const code of CATEGORY_CODES) {
    const category = await prisma.teamCategory.findUniqueOrThrow({ where: { code } });
    const existing = await prisma.channel.findFirst({
      where: { type: 'CATEGORY', teamCategoryId: category.id },
    });
    if (!existing) {
      await prisma.channel.create({
        data: { type: 'CATEGORY', teamCategoryId: category.id, name: `Kategória ${code}` },
      });
    }
  }
  const announcements = await prisma.channel.findFirst({ where: { type: 'ANNOUNCEMENT' } });
  if (!announcements) {
    await prisma.channel.create({ data: { type: 'ANNOUNCEMENT', name: 'Oznamy klubu' } });
  }

  console.log(`Seed hotový: sezóna ${season.name}, ${CATEGORY_CODES.length} kategórií`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
