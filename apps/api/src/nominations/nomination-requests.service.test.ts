import { describe, expect, it, vi } from 'vitest';
import { isAgeEligible, NominationRequestsService, playerCategoryOrder } from './nomination-requests.service';
import type { AuthUser } from '../auth/current-user.decorator';

const cat = (code: string, sortOrder: number) => ({ code, sortOrder });
// sezóna 2026/2027 (refYear 2027): U13 = 2014–2015, U15 = 2012–2013, U17 = 2010–2011
const RULES = [
  { birthYearFrom: 2014, birthYearTo: 2015, teamCategory: cat('U13', 4) },
  { birthYearFrom: 2012, birthYearTo: 2013, teamCategory: cat('U15', 5) },
  { birthYearFrom: 2010, birthYearTo: 2011, teamCategory: cat('U17', 6) },
];
const team = (id: string, code: string, sortOrder: number) => ({ id, name: `${code} ${id}`, teamCategory: cat(code, sortOrder) });

const U15 = team('t-u15', 'U15', 5);
const U13 = team('t-u13', 'U13', 4);
const U17 = team('t-u17', 'U17', 6);

const coachOf = (...teamIds: string[]): AuthUser => ({
  id: 'coach-' + teamIds.join('-'),
  email: 'c@x.sk',
  roles: teamIds.map((teamId) => ({ role: 'COACH' as const, teamId })),
  isDemo: false,
});
const admin: AuthUser = { id: 'admin', email: 'a@x.sk', roles: [{ role: 'ADMIN', teamId: null }], isDemo: false };

interface Player {
  id: string;
  birthYear: number | null;
  teams: ReturnType<typeof team>[];
}

function make(opts: {
  players: Player[];
  nominations?: Array<{ memberId: string; status: string }>;
  requests?: Array<{ id: string; memberId: string; status: string; matchId?: string; requestedById?: string; note?: string | null }>;
  memberStatus?: string;
}) {
  const requests = (opts.requests ?? []).map((r) => ({ matchId: 'm1', requestedById: 'x', note: null, ...r }));
  const nominations = opts.nominations ?? [];
  const toMember = (p: Player) => ({
    id: p.id,
    firstName: 'Meno',
    lastName: p.id,
    birthDate: p.birthYear ? new Date(Date.UTC(p.birthYear, 3, 1)) : null,
    memberships: p.teams.map((t) => ({ team: t })),
  });
  const prisma = {
    match: {
      findUnique: vi.fn(async () => ({
        id: 'm1',
        event: { isDemo: false, title: 'U15 vs X', startAt: new Date('2026-10-20T10:00:00Z'), location: null, team: U15 },
      })),
    },
    categoryRule: { findMany: vi.fn(async () => RULES) },
    member: {
      findMany: vi.fn(async ({ where }: { where: { AND: Array<{ id?: string }> } }) => {
        const id = where.AND[0]?.id;
        return opts.players.filter((p) => !id || p.id === id).map(toMember);
      }),
      findUnique: vi.fn(async () => null),
    },
    matchNomination: {
      findMany: vi.fn(async () => nominations.filter((n) => n.status !== 'REMOVED')),
      findUnique: vi.fn(async ({ where }: { where: { matchId_memberId: { memberId: string } } }) =>
        nominations.find((n) => n.memberId === where.matchId_memberId.memberId) ?? null,
      ),
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({ id: 'nom', ...create })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'nom', ...data })),
    },
    nominationRequest: {
      findMany: vi.fn(async () => requests),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; matchId_memberId?: { memberId: string } } }) => {
        const r = where.id
          ? requests.find((x) => x.id === where.id)
          : requests.find((x) => x.memberId === where.matchId_memberId?.memberId);
        if (!r) return null;
        const p = opts.players.find((x) => x.id === r.memberId);
        return {
          ...r,
          member: {
            status: opts.memberStatus ?? 'ACTIVE',
            isDemo: false,
            memberships: (p?.teams ?? []).map((t) => ({ teamId: t.id })),
          },
        };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'req-new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'req', ...data })),
      delete: vi.fn(async () => ({})),
    },
    userRole: { findMany: vi.fn(async () => []) },
  };
  const push = { notifyUsers: vi.fn(async () => ({ sent: 0 })) };
  const email = { send: vi.fn(async () => ({ sent: false })) };
  return { prisma, push, email, service: new NominationRequestsService(prisma as never, push as never, email as never) };
}

describe('veková kategória', () => {
  it('určí kategóriu podľa ročníka, bez dátumu podľa najstaršieho družstva', () => {
    expect(playerCategoryOrder(new Date(Date.UTC(2014, 0, 1)), RULES, [U15])).toBe(4);
    expect(playerCategoryOrder(null, RULES, [U13, U15])).toBe(5);
    expect(playerCategoryOrder(null, RULES, [])).toBeNull();
  });

  it('povolí rovnakú alebo mladšiu kategóriu', () => {
    expect(isAgeEligible(4, 5)).toBe(true);
    expect(isAgeEligible(5, 5)).toBe(true);
    expect(isAgeEligible(6, 5)).toBe(false);
    expect(isAgeEligible(null, 5)).toBe(false);
  });
});

describe('NominationRequestsService', () => {
  const players: Player[] = [
    { id: 'mladsi', birthYear: 2014, teams: [U13] },
    { id: 'starsi', birthYear: 2010, teams: [U17] },
  ];

  it('zoznam kandidátov vynechá staršie kategórie a označí priamu nomináciu', async () => {
    const { service } = make({ players });
    const list = await service.candidates('m1', coachOf('t-u15', 't-u13'));
    expect(list.map((c) => c.id)).toEqual(['mladsi']);
    expect(list[0]!.direct).toBe(true);
    expect(list[0]!.categoryCode).toBe('U13');
  });

  it('tréner cudzieho družstva nemôže zobraziť kandidátov', async () => {
    const { service } = make({ players });
    await expect(service.candidates('m1', coachOf('t-u13'))).rejects.toThrow(/svoje družstvo/);
  });

  it('staršieho hráča odmietne', async () => {
    const { service } = make({ players });
    await expect(service.nominate('m1', 'starsi', admin)).rejects.toThrow(/mladšej/);
  });

  it('tréner, ktorý hráča trénuje, nominuje priamo', async () => {
    const { service, prisma } = make({ players });
    const res = await service.nominate('m1', 'mladsi', coachOf('t-u15', 't-u13'));
    expect(res.result).toBe('NOMINATED');
    expect(prisma.matchNomination.upsert).toHaveBeenCalled();
    expect(prisma.nominationRequest.create).not.toHaveBeenCalled();
  });

  it('vedenie nominuje bez žiadosti', async () => {
    const { service } = make({ players });
    expect((await service.nominate('m1', 'mladsi', admin)).result).toBe('NOMINATED');
  });

  it('cudzí hráč → vznikne žiadosť a notifikácia trénerom', async () => {
    const { service, prisma } = make({ players });
    const res = await service.nominate('m1', 'mladsi', coachOf('t-u15'), 'chýba nám brankár');
    expect(res.result).toBe('REQUESTED');
    expect(prisma.matchNomination.upsert).not.toHaveBeenCalled();
    expect(prisma.nominationRequest.create.mock.calls[0]![0].data).toMatchObject({
      matchId: 'm1',
      memberId: 'mladsi',
      status: 'PENDING',
      note: 'chýba nám brankár',
    });
  });

  it('zabráni duplicitnej žiadosti a nominácii už nominovaného', async () => {
    const pending = make({ players, requests: [{ id: 'r1', memberId: 'mladsi', status: 'PENDING' }] });
    await expect(pending.service.nominate('m1', 'mladsi', coachOf('t-u15'))).rejects.toThrow(/čaká/);
    const nominated = make({ players, nominations: [{ memberId: 'mladsi', status: 'NOMINATED' }] });
    await expect(nominated.service.nominate('m1', 'mladsi', coachOf('t-u15'))).rejects.toThrow(/už je v nominácii/);
  });

  it('po zamietnutí možno požiadať znova (žiadosť sa vráti do PENDING)', async () => {
    const { service, prisma } = make({ players, requests: [{ id: 'r1', memberId: 'mladsi', status: 'REJECTED' }] });
    await service.nominate('m1', 'mladsi', coachOf('t-u15'));
    expect(prisma.nominationRequest.update.mock.calls[0]![0].data.status).toBe('PENDING');
  });

  it('schválenie trénerom hráča vytvorí nomináciu', async () => {
    const { service, prisma } = make({ players, requests: [{ id: 'r1', memberId: 'mladsi', status: 'PENDING' }] });
    const res = await service.decide('r1', coachOf('t-u13'), true);
    expect(res.status).toBe('APPROVED');
    expect(prisma.matchNomination.upsert).toHaveBeenCalled();
  });

  it('zamietnutie nevytvorí nomináciu; rozhodnúť môže len tréner hráča a len raz', async () => {
    const { service, prisma } = make({ players, requests: [{ id: 'r1', memberId: 'mladsi', status: 'PENDING' }] });
    await expect(service.decide('r1', coachOf('t-u15'), true)).rejects.toThrow(/tréner družstva hráča/);
    const res = await service.decide('r1', coachOf('t-u13'), false, 'hrá za U13');
    expect(res.status).toBe('REJECTED');
    expect(prisma.matchNomination.upsert).not.toHaveBeenCalled();
    const done = make({ players, requests: [{ id: 'r1', memberId: 'mladsi', status: 'APPROVED' }] });
    await expect(done.service.decide('r1', admin, true)).rejects.toThrow(/rozhodnuté/);
  });

  it('neaktívneho hráča neschváli', async () => {
    const { service } = make({ players, memberStatus: 'INACTIVE', requests: [{ id: 'r1', memberId: 'mladsi', status: 'PENDING' }] });
    await expect(service.decide('r1', admin, true)).rejects.toThrow(/aktívny/);
  });
});

describe('zrušenie nominácie z iného družstva a radenie', () => {
  const three: Player[] = [
    { id: 'a', birthYear: 2014, teams: [U13] },
    { id: 'b', birthYear: 2014, teams: [U13] },
    { id: 'c', birthYear: 2014, teams: [U13] },
  ];

  it('nominovaní hráči sú v zozname najprv, ostatní až potom (v oboch skupinách abecedne)', async () => {
    const { service } = make({ players: three, nominations: [{ memberId: 'c', status: 'NOMINATED' }] });
    const list = await service.candidates('m1', coachOf('t-u15'));
    expect(list.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(list[0]!.nominated).toBe(true);
  });

  it('odobratá nominácia (REMOVED) sa radí medzi ostatných', async () => {
    const { service } = make({ players: three, nominations: [{ memberId: 'b', status: 'REMOVED' }] });
    const list = await service.candidates('m1', coachOf('t-u15'));
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('zruší existujúcu nomináciu (status REMOVED)', async () => {
    const { service, prisma } = make({ players: three, nominations: [{ memberId: 'a', status: 'NOMINATED' }] });
    await expect(service.cancel('m1', 'a', coachOf('t-u15'))).resolves.toEqual({ result: 'REMOVED' });
    expect(prisma.matchNomination.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REMOVED' } }),
    );
    expect(prisma.nominationRequest.delete).not.toHaveBeenCalled();
  });

  it('zruší čakajúcu žiadosť (zmaže ju) a nominácie sa nedotkne', async () => {
    const { service, prisma } = make({
      players: three,
      requests: [{ id: 'r1', memberId: 'a', status: 'PENDING' }],
    });
    await expect(service.cancel('m1', 'a', coachOf('t-u15'))).resolves.toEqual({ result: 'CANCELLED' });
    expect(prisma.nominationRequest.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(prisma.matchNomination.update).not.toHaveBeenCalled();
  });

  it('bez nominácie aj bez čakajúcej žiadosti vráti 404; schválená žiadosť sa nemaže', async () => {
    const { service, prisma } = make({ players: three, requests: [{ id: 'r2', memberId: 'a', status: 'APPROVED' }] });
    await expect(service.cancel('m1', 'a', coachOf('t-u15'))).rejects.toThrow(/neexistuje/);
    expect(prisma.nominationRequest.delete).not.toHaveBeenCalled();
  });

  it('tréner cudzieho družstva nominácie rušiť nemôže', async () => {
    const { service } = make({ players: three, nominations: [{ memberId: 'a', status: 'NOMINATED' }] });
    await expect(service.cancel('m1', 'a', coachOf('t-u13'))).rejects.toThrow(/svoje družstvo/);
  });

  it('vedenie (admin) môže zrušiť nomináciu', async () => {
    const { service } = make({ players: three, nominations: [{ memberId: 'a', status: 'NOMINATED' }] });
    await expect(service.cancel('m1', 'a', admin)).resolves.toEqual({ result: 'REMOVED' });
  });
});
