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

  // 4. Predvolené družstvo pre každú kategóriu (jedno, admin môže pridať A/B)
  //    + 3 podkanály na družstvo (Oznamy / Tréningy / Všeobecné)
  for (const code of CATEGORY_CODES) {
    const category = await prisma.teamCategory.findUniqueOrThrow({ where: { code } });
    let team = await prisma.team.findFirst({ where: { teamCategoryId: category.id } });
    if (!team) {
      team = await prisma.team.create({
        data: { teamCategoryId: category.id, name: code, sortOrder: 0 },
      });
    }
    const subchannels: Array<{ kind: 'TEAM_ANNOUNCEMENTS' | 'TEAM_TRAINING' | 'TEAM_GENERAL'; name: string }> = [
      { kind: 'TEAM_ANNOUNCEMENTS', name: `${team.name} · Oznamy` },
      { kind: 'TEAM_TRAINING', name: `${team.name} · Tréningy` },
      { kind: 'TEAM_GENERAL', name: `${team.name} · Všeobecné` },
    ];
    for (const sc of subchannels) {
      const exists = await prisma.channel.findFirst({ where: { teamId: team.id, kind: sc.kind } });
      if (!exists) {
        await prisma.channel.create({ data: { kind: sc.kind, teamId: team.id, name: sc.name } });
      }
    }
  }

  // Celoklubový kanál oznamov
  const clubAnn = await prisma.channel.findFirst({ where: { kind: 'CLUB_ANNOUNCEMENT' } });
  if (!clubAnn) {
    await prisma.channel.create({ data: { kind: 'CLUB_ANNOUNCEMENT', name: 'Oznamy klubu' } });
  }

  // Register klubov (súperi) — MFZ Košice, logá z futbalnetu (idempotentne)
  const logo = (domain: string) => `https://api.sportnet.online/data/ppo/${domain}/logo`;
  const CLUBS: Array<{ name: string; domain: string }> = [
    { name: 'FK GALAKTIK', domain: 'fk-galaktik.futbalnet.sk' },
    { name: 'Slávia TU Košice', domain: 'slavia-tu-kosice.futbalnet.sk' },
    { name: 'FK Košická Nová Ves', domain: 'fk-kosicka-nova-ves.futbalnet.sk' },
    { name: 'FA BENECOL KOŠICE', domain: 'fa-benecol-kosice.futbalnet.sk' },
    { name: 'FK Junior Košice', domain: 'fk-junior-kosice.futbalnet.sk' },
    { name: 'KAC Jednota Košice', domain: 'kac-jednota-kosice.futbalnet.sk' },
    { name: 'ŠK Pyramída Košice', domain: 'sk-pyramida-kosice.futbalnet.sk' },
    { name: 'FK Považská Sokoľ', domain: 'sk-sokol.futbalnet.sk' },
    { name: 'MŠK Moldava nad Bodvou B', domain: 'issf_club_10136' },
  ];
  for (const c of CLUBS) {
    await prisma.club.upsert({
      where: { name: c.name },
      create: { name: c.name, sportnetDomain: c.domain, logoUrl: logo(c.domain) },
      update: { sportnetDomain: c.domain, logoUrl: logo(c.domain) },
    });
  }

  console.log(`Seed hotový: sezóna ${season.name}, ${CATEGORY_CODES.length} kategórií (družstvá + podkanály)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
