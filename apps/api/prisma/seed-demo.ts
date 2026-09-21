/**
 * Testovacie (demo) dáta pre app-store review konto review@fkknv.sk.
 *
 * Spustenie na VPS (v kontajneri API):
 *   docker compose --env-file .env exec api npx ts-node prisma/seed-demo.ts
 * Voliteľne heslo:  REVIEW_PASSWORD=... (inak predvolené nižšie)
 *
 * Všetky vytvorené dáta majú isDemo=true a sú viditeľné IBA pre demo konto.
 * Ostatní členovia ich nevidia a demo konto nevidí ostré dáta. Skript je
 * idempotentný — dá sa spustiť opakovane.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const REVIEW_EMAIL = 'review@fkknv.sk';
const REVIEW_PASSWORD = process.env.REVIEW_PASSWORD ?? 'Fkknv-Review-2026';
const DEMO_TEAM_NAME = 'Demo tím';

/** Dátum ako „nástenný" čas v UTC (rovnaká konvencia ako v aplikácii). */
function wall(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute));
}

async function main() {
  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) throw new Error('Neexistuje aktívna sezóna — najprv spustite hlavný seed.');

  // kategória pre demo tím (ľubovoľná existujúca; demo tím je izolovaný príznakom isDemo)
  const category = await prisma.teamCategory.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!category) throw new Error('Neexistujú kategórie — najprv spustite hlavný seed.');

  // 1. Demo tím (vysoký sortOrder, aby nebol predvolený pri auto-zaraďovaní)
  let team = await prisma.team.findFirst({ where: { isDemo: true, name: DEMO_TEAM_NAME } });
  if (!team) {
    team = await prisma.team.create({
      data: { teamCategoryId: category.id, name: DEMO_TEAM_NAME, sortOrder: 999, isDemo: true },
    });
  }

  // 2. Review konto (tréner demo tímu) — isDemo, vidí len demo dáta
  const passwordHash = await bcrypt.hash(REVIEW_PASSWORD, 10);
  const reviewer = await prisma.user.upsert({
    where: { email: REVIEW_EMAIL },
    create: { email: REVIEW_EMAIL, firstName: 'App', lastName: 'Review', passwordHash, isDemo: true },
    update: { passwordHash, isDemo: true },
  });
  // rola COACH scoped na demo tím (idempotentne)
  const coachRole = await prisma.userRole.findFirst({ where: { userId: reviewer.id, role: 'COACH', teamId: team.id } });
  if (!coachRole) {
    await prisma.userRole.create({ data: { userId: reviewer.id, role: 'COACH', teamId: team.id } });
  }

  // 3. Demo hráči + zaradenie do demo tímu (výnimka, aby ich auto-zaraďovanie neriešilo)
  const players = [
    { firstName: 'Adam', lastName: 'Demovský', year: 2013 },
    { firstName: 'Boris', lastName: 'Testovič', year: 2013 },
    { firstName: 'Cyril', lastName: 'Ukážkový', year: 2014 },
    { firstName: 'Dávid', lastName: 'Skúšobný', year: 2013 },
    { firstName: 'Erik', lastName: 'Demovský', year: 2014 },
    { firstName: 'Filip', lastName: 'Vzorka', year: 2013 },
    { firstName: 'Gabriel', lastName: 'Testovací', year: 2014 },
    { firstName: 'Hugo', lastName: 'Príkladný', year: 2013 },
  ];
  const playerMembers = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i]!;
    const reg = `DEMO-P${String(i + 1).padStart(2, '0')}`;
    // platnosť preukazu: 1. hráč po platnosti, 2. čoskoro (do 30 dní), ostatní OK —
    // aby bolo na dashboarde vidieť aj farebné stavy registračných preukazov
    const validUntil = i === 0 ? wall(-12, 0) : i === 1 ? wall(20, 0) : wall(320, 0);
    const member = await prisma.member.upsert({
      where: { registrationNumber: reg },
      create: {
        isDemo: true,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: new Date(Date.UTC(p.year, 4, 10)),
        status: 'ACTIVE',
        registrationNumber: reg,
        registrationValidUntil: validUntil,
      },
      update: { isDemo: true, firstName: p.firstName, lastName: p.lastName, registrationValidUntil: validUntil },
    });
    await prisma.teamMembership.upsert({
      where: { memberId_seasonId_teamId: { memberId: member.id, seasonId: season.id, teamId: team.id } },
      create: { memberId: member.id, seasonId: season.id, teamId: team.id, isException: true },
      update: { isException: true, leftAt: null },
    });
    playerMembers.push(member);
  }

  // 4. Demo kanály (tímové + celoklubový oznam) — všetko isDemo
  const channelDefs: Array<{ kind: 'TEAM_ANNOUNCEMENTS' | 'TEAM_TRAINING' | 'TEAM_GENERAL'; name: string }> = [
    { kind: 'TEAM_ANNOUNCEMENTS', name: `${team.name} · Oznamy` },
    { kind: 'TEAM_TRAINING', name: `${team.name} · Tréningy` },
    { kind: 'TEAM_GENERAL', name: `${team.name} · Všeobecné` },
  ];
  const channels = [];
  for (const def of channelDefs) {
    let ch = await prisma.channel.findFirst({ where: { isDemo: true, teamId: team.id, kind: def.kind } });
    if (!ch) ch = await prisma.channel.create({ data: { kind: def.kind, teamId: team.id, name: def.name, isDemo: true } });
    channels.push(ch);
  }
  let clubCh = await prisma.channel.findFirst({ where: { isDemo: true, kind: 'CLUB_ANNOUNCEMENT' } });
  if (!clubCh) clubCh = await prisma.channel.create({ data: { kind: 'CLUB_ANNOUNCEMENT', name: 'Oznamy klubu (demo)', isDemo: true } });
  channels.push(clubCh);
  // review konto ako člen/moderátor demo kanálov
  for (const ch of channels) {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: ch.id, userId: reviewer.id } },
      create: { channelId: ch.id, userId: reviewer.id, isModerator: true },
      update: { isModerator: true },
    });
  }
  // ukážková správa v tímovom „Všeobecné"
  const general = channels.find((c) => c.kind === 'TEAM_GENERAL')!;
  const hasMsg = await prisma.message.findFirst({ where: { channelId: general.id } });
  if (!hasMsg) {
    await prisma.message.create({
      data: { channelId: general.id, senderId: reviewer.id, body: 'Vitajte v ukážkovom tíme! Toto je testovacia komunikácia.' },
    });
  }

  // 5. Demo udalosti — najprv vyčisti staré demo udalosti tímu, potom vytvor
  await prisma.event.deleteMany({ where: { isDemo: true, teamId: team.id } });
  // dva tréningy
  for (const [i, day] of [2, 5].entries()) {
    await prisma.event.create({
      data: {
        type: 'TRAINING',
        seasonId: season.id,
        teamId: team.id,
        isDemo: true,
        title: 'Tréning',
        startAt: wall(day, 17, 0),
        endAt: wall(day, 18, 30),
        location: 'Ihrisko KNV',
        createdById: reviewer.id,
      },
    });
    void i;
  }
  // zápas s nomináciou
  const matchEvent = await prisma.event.create({
    data: {
      type: 'MATCH',
      seasonId: season.id,
      teamId: team.id,
      isDemo: true,
      title: `${team.name} vs FC Ukážka`,
      startAt: wall(7, 10, 0),
      location: 'Ihrisko KNV',
      createdById: reviewer.id,
      match: { create: { opponent: 'FC Ukážka', isHome: true, meetAt: wall(7, 9, 0) } },
    },
    include: { match: true },
  });
  // nominuj prvých 6 hráčov
  for (const m of playerMembers.slice(0, 6)) {
    await prisma.matchNomination.upsert({
      where: { matchId_memberId: { matchId: matchEvent.match!.id, memberId: m.id } },
      create: { matchId: matchEvent.match!.id, memberId: m.id },
      update: {},
    });
  }

  // 6. Demo úloha
  await prisma.task.deleteMany({ where: { isDemo: true } });
  await prisma.task.create({
    data: {
      isDemo: true,
      title: 'Priniesť dresy na zápas',
      description: 'Ukážková úloha pre demo tím.',
      dueDate: wall(6, 12, 0),
      assigneeRole: 'COACH',
      createdById: reviewer.id,
    },
  });

  console.log('✅ Demo dáta pripravené.');
  console.log(`   Konto:  ${REVIEW_EMAIL}`);
  console.log(`   Heslo:  ${REVIEW_PASSWORD}`);
  console.log(`   Tím:    ${team.name} · hráčov ${playerMembers.length} · 2 tréningy · 1 zápas · 1 úloha`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
