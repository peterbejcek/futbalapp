import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { PublicService } from './public.service';
import { decodePhotoDataUrl, splitParagraphs, toEventDto, wallClockToInstant, type PublicEventRow } from './public.mapper';
import { isInternalRequest } from './public.module';
import type { PrismaService } from '../prisma/prisma.service';

const SEASON = {
  id: 's-db',
  name: '2030/2031',
  startDate: new Date('2030-07-01T00:00:00Z'),
  endDate: new Date('2031-06-30T00:00:00Z'),
  isActive: true,
};

function mockPrisma() {
  return {
    season: { findFirst: vi.fn().mockResolvedValue(SEASON) },
    team: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    teamMembership: { findMany: vi.fn().mockResolvedValue([]) },
    member: { findFirst: vi.fn() },
    event: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    article: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
  };
}

type Mock = ReturnType<typeof mockPrisma>;
let prisma: Mock;
let service: PublicService;

beforeEach(() => {
  prisma = mockPrisma();
  service = new PublicService(prisma as unknown as PrismaService);
});

const CLUB = { name: 'FK Košická Nová Ves', timezone: 'Europe/Bratislava' };

function eventRow(over: Partial<PublicEventRow> = {}): PublicEventRow {
  return {
    id: 'e1',
    type: 'MATCH',
    title: 'U10 vs Lokomotíva',
    startAt: new Date('2030-09-12T17:00:00Z'),
    endAt: null,
    location: 'Ihrisko KNV',
    team: { id: 't1', name: 'U10', teamCategory: { code: 'U10', name: 'Prípravka U10' } },
    match: { opponent: 'Lokomotíva', isHome: true, competition: 'Liga', scoreUs: 3, scoreThem: 1, state: 'FINISHED' },
    ...over,
  };
}

/** Rekurzívne zozbiera všetky kľúče z objektu (napr. `select`). */
function allKeys(obj: unknown, acc = new Set<string>()): Set<string> {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      acc.add(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

describe('aktívna sezóna', () => {
  it('berie sa z DB (isActive, najnovšia), nie natvrdo', async () => {
    const res = await service.teams();
    expect(prisma.season.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, orderBy: { startDate: 'desc' } }),
    );
    expect(res.season).toEqual({ name: '2030/2031', startDate: '2030-07-01', endDate: '2031-06-30', isActive: true });
  });
  it('bez aktívnej sezóny → 503', async () => {
    prisma.season.findFirst.mockResolvedValue(null);
    await expect(service.teams()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('mužstvá', () => {
  it('filtruje demo družstvá, rosterSize len aktívni nedemo členovia aktívnej sezóny', async () => {
    prisma.team.findMany.mockResolvedValue([
      { id: 't1', name: 'U10', sortOrder: 0, teamCategory: { code: 'U10', name: 'U10', sortOrder: 3 }, _count: { memberships: 12 } },
    ]);
    const res = await service.teams();
    const arg = prisma.team.findMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ isDemo: false });
    expect(arg.orderBy).toEqual([{ teamCategory: { sortOrder: 'asc' } }, { sortOrder: 'asc' }]);
    const mw = arg.select._count.select.memberships.where;
    expect(mw.seasonId).toBe('s-db');
    expect(mw.member).toEqual({ status: 'ACTIVE', isDemo: false });
    expect(mw.OR).toEqual([{ leftAt: null }, { leftAt: { gt: expect.any(Date) } }]);
    expect(res.teams[0]).toEqual({ id: 't1', name: 'U10', categoryCode: 'U10', categoryName: 'U10', sortOrder: 0, rosterSize: 12 });
  });
});

describe('súpiska', () => {
  beforeEach(() => {
    prisma.team.findFirst.mockResolvedValue({
      id: 't1',
      name: 'U10',
      sortOrder: 0,
      teamCategory: { code: 'U10', name: 'U10', sortOrder: 3 },
      _count: { memberships: 3 },
    });
  });

  it('demo družstvo → 404', async () => {
    prisma.team.findFirst.mockResolvedValue(null);
    await expect(service.squad('demo')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.team.findFirst.mock.calls[0]![0].where).toEqual({ id: 'demo', isDemo: false });
  });

  it('dotaz vyžaduje súhlas, ACTIVE, nie demo; select bez citlivých polí', async () => {
    await service.squad('t1');
    const arg = prisma.teamMembership.findMany.mock.calls[0]![0];
    expect(arg.where.member).toEqual({ status: 'ACTIVE', isDemo: false, publicProfileConsent: true });
    expect(arg.where.seasonId).toBe('s-db');
    expect(arg.where.teamId).toBe('t1');
    const keys = allKeys(arg.select);
    for (const forbidden of ['birthDate', 'birthNumber', 'healthNotes', 'dataUrl', 'photoUrl', 'addressStreet', 'userId', 'sex']) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(arg.include).toBeUndefined();
  });

  it('hráč bez súhlasu (ak by ho DB vrátila filtrom) nie je; foto len pri súhlase a existencii', async () => {
    prisma.teamMembership.findMany.mockResolvedValue([
      { member: { id: 'm2', firstName: 'Ján', lastName: 'Šimko', publicPhotoConsent: false, photo: { id: 'p2' } } },
      { member: { id: 'm1', firstName: 'Adam', lastName: 'Čech', publicPhotoConsent: true, photo: { id: 'p1' } } },
      { member: { id: 'm3', firstName: 'Peter', lastName: 'Sekera', publicPhotoConsent: true, photo: null } },
    ]);
    const res = await service.squad('t1');
    // slovenské radenie: Čech < Sekera < Šimko
    expect(res.players.map((p) => p.lastName)).toEqual(['Čech', 'Sekera', 'Šimko']);
    expect(res.players.find((p) => p.id === 'm1')!.photoUrl).toBe('/api/v1/public/players/m1/photo');
    expect(res.players.find((p) => p.id === 'm2')!.photoUrl).toBeNull();
    expect(res.players.find((p) => p.id === 'm3')!.photoUrl).toBeNull();
    expect(Object.keys(res.players[0]!).sort()).toEqual(['firstName', 'id', 'lastName', 'photoUrl']);
  });
});

describe('foto hráča', () => {
  it('vyžaduje súhlas profil + foto a nie demo', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    expect(await service.playerPhoto('m1')).toBeNull();
    const arg = prisma.member.findFirst.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ id: 'm1', isDemo: false, publicProfileConsent: true, publicPhotoConsent: true });
    expect(arg.select).toEqual({ photo: { select: { dataUrl: true } } });
  });
  it('bez fotky → null; s fotkou → buffer + mime', async () => {
    prisma.member.findFirst.mockResolvedValue({ photo: null });
    expect(await service.playerPhoto('m1')).toBeNull();
    prisma.member.findFirst.mockResolvedValue({ photo: { dataUrl: `data:image/png;base64,${Buffer.from('abc').toString('base64')}` } });
    const p = await service.playerPhoto('m1');
    expect(p!.mime).toBe('image/png');
    expect(p!.buffer.toString()).toBe('abc');
  });
  it('SVG ani neplatné data URL sa neservírujú', () => {
    expect(decodePhotoDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(decodePhotoDataUrl('https://x/y.jpg')).toBeNull();
  });
});

describe('udalosti', () => {
  it('where: nie demo, aktívna sezóna, družstvo, len MATCH/TOURNAMENT alebo verejný TRAINING', async () => {
    await service.events({});
    const arg = prisma.event.findMany.mock.calls[0]![0];
    const base = arg.where.AND[0];
    expect(base).toEqual({
      isDemo: false,
      seasonId: 's-db',
      teamId: { not: null },
      team: { isDemo: false },
      OR: [{ type: { in: ['MATCH', 'TOURNAMENT'] } }, { type: 'TRAINING', isPublic: true }],
    });
    expect(arg.take).toBe(200);
    const keys = allKeys(arg.select);
    for (const forbidden of ['attendances', 'nominations', 'notes', 'meetAt', 'jerseyColor', 'videoUrl', 'highlightsUrl', 'createdById', 'futbalnetId', 'recurrenceGroupId', 'isPublic']) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it('CLUB_EVENT/PARENT_MEETING a udalosť bez družstva sa nevrátia ani pri chybnom riadku', () => {
    expect(toEventDto(eventRow({ type: 'CLUB_EVENT' }), CLUB)).toBeNull();
    expect(toEventDto(eventRow({ type: 'PARENT_MEETING' }), CLUB)).toBeNull();
    expect(toEventDto(eventRow({ team: null }), CLUB)).toBeNull();
  });

  it('filtre: type, from/to ako kalendárne dni, limit max 500, neplatné → 400', async () => {
    await service.events({ type: 'training', from: '2030-09-01', to: '2030-09-30', limit: '9999', teamId: 't1', categoryCode: 'U10' });
    const arg = prisma.event.findMany.mock.calls[0]![0];
    expect(arg.where.AND).toEqual(
      expect.arrayContaining([
        { type: 'TRAINING' },
        { teamId: 't1' },
        { team: { teamCategory: { code: 'U10' } } },
        { startAt: { gte: new Date('2030-09-01T00:00:00Z') } },
        { startAt: { lt: new Date('2030-10-01T00:00:00Z') } },
      ]),
    );
    expect(arg.take).toBe(500);
    await expect(service.events({ type: 'club' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.events({ from: '2030-13-01' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.events({ limit: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('domáci: isHome=true → my domáci, skóre z pohľadu domácich', () => {
    const e = toEventDto(eventRow(), CLUB)!;
    expect(e.state).toBe('FINISHED');
    expect(e.match).toEqual({
      homeName: 'FK Košická Nová Ves',
      awayName: 'Lokomotíva',
      isHome: true,
      opponent: 'Lokomotíva',
      competition: 'Liga',
      homeScore: 3,
      awayScore: 1,
    });
  });

  it('vonku: isHome=false → súper domáci, skóre otočené; názov s družstvom', () => {
    const e = toEventDto(
      eventRow({
        team: { id: 't2', name: 'U10 B', teamCategory: { code: 'U10', name: 'U10' } },
        match: { opponent: 'Lokomotíva', isHome: false, competition: null, scoreUs: 2, scoreThem: 4, state: 'FINISHED' },
      }),
      CLUB,
    )!;
    expect(e.match!.homeName).toBe('Lokomotíva');
    expect(e.match!.awayName).toBe('FK Košická Nová Ves U10 B');
    expect(e.match!.homeScore).toBe(4);
    expect(e.match!.awayScore).toBe(2);
  });

  it('stav: PLANNED→SCHEDULED bez skóre, CANCELLED bez skóre, LIVE s priebežným skóre, tréning SCHEDULED', () => {
    const planned = toEventDto(eventRow({ match: { ...eventRow().match!, state: 'PLANNED' } }), CLUB)!;
    expect(planned.state).toBe('SCHEDULED');
    expect(planned.match!.homeScore).toBeNull();
    const cancelled = toEventDto(eventRow({ match: { ...eventRow().match!, state: 'CANCELLED' } }), CLUB)!;
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.match!.awayScore).toBeNull();
    const live = toEventDto(eventRow({ match: { ...eventRow().match!, state: 'LIVE' } }), CLUB)!;
    expect(live.state).toBe('LIVE');
    expect(live.match!.homeScore).toBe(3);
    const training = toEventDto(eventRow({ type: 'TRAINING', match: null }), CLUB)!;
    expect(training.state).toBe('SCHEDULED');
    expect(training.match).toBeNull();
  });

  it('nástenný čas → skutočný UTC okamih (leto +2, zima +1)', () => {
    expect(wallClockToInstant(new Date('2030-09-12T17:00:00Z'), 'Europe/Bratislava').toISOString()).toBe('2030-09-12T15:00:00.000Z');
    expect(wallClockToInstant(new Date('2030-12-12T17:00:00Z'), 'Europe/Bratislava').toISOString()).toBe('2030-12-12T16:00:00.000Z');
    expect(toEventDto(eventRow(), CLUB)!.startAt).toBe('2030-09-12T15:00:00.000Z');
  });

  it('detail neverejnej udalosti → 404', async () => {
    prisma.event.findFirst.mockResolvedValue(null);
    await expect(service.event('x')).rejects.toBeInstanceOf(NotFoundException);
    const arg = prisma.event.findFirst.mock.calls[0]![0];
    expect(arg.where.AND[0]).toEqual({ id: 'x' });
    expect(arg.where.AND[1].OR).toEqual([{ type: { in: ['MATCH', 'TOURNAMENT'] } }, { type: 'TRAINING', isPublic: true }]);
  });
});

describe('články', () => {
  it('len publikované (publishedAt <= now), zoradené desc', async () => {
    await service.articles();
    const arg = prisma.article.findMany.mock.calls[0]![0];
    expect(arg.where.publishedAt.not).toBeNull();
    expect(arg.where.publishedAt.lte).toBeInstanceOf(Date);
    expect(arg.orderBy[0]).toEqual({ publishedAt: 'desc' });
    expect(arg.select.body).toBeUndefined();
  });
  it('nepublikovaný článok → 404', async () => {
    prisma.article.findFirst.mockResolvedValue(null);
    await expect(service.article('koncept')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.article.findFirst.mock.calls[0]![0].where.publishedAt.lte).toBeInstanceOf(Date);
  });
  it('paragraphs: split podľa prázdneho riadku, trim, bez prázdnych', async () => {
    expect(splitParagraphs('  Prvý odsek.\r\n\r\n\n  Druhý\nriadok.  \n \nTretí\n\n')).toEqual(['Prvý odsek.', 'Druhý\nriadok.', 'Tretí']);
    prisma.article.findFirst.mockResolvedValue({
      id: 'a1',
      slug: 'leto',
      title: 'Leto',
      excerpt: 'Úvod',
      publishedAt: new Date('2030-01-01T10:00:00Z'),
      body: 'A\n\nB',
    });
    expect(await service.article('leto')).toEqual({
      id: 'a1',
      slug: 'leto',
      title: 'Leto',
      excerpt: 'Úvod',
      publishedAt: '2030-01-01T10:00:00.000Z',
      paragraphs: ['A', 'B'],
    });
  });
});

describe('rate-limit', () => {
  it('interné volanie (docker, bez XFF) sa nepočíta; cez proxy áno', () => {
    expect(isInternalRequest({ headers: {}, socket: { remoteAddress: '172.18.0.5' } } as never)).toBe(true);
    expect(isInternalRequest({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '172.18.0.3' } } as never)).toBe(false);
    expect(isInternalRequest({ headers: {}, socket: { remoteAddress: '8.8.8.8' } } as never)).toBe(false);
  });
});
