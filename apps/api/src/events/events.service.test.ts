import { describe, expect, it, vi } from 'vitest';
import { EventsService } from './events.service';

const pitch = { id: 'p1', name: 'Hlavné', surface: 'PT', address: 'Plocha 1' };
const admin = { id: 'u1', roles: [{ role: 'ADMIN' }] } as never;

function make() {
  const prisma = {
    season: { findFirst: vi.fn(async () => ({ id: 's1' })) },
    team: { findUnique: vi.fn(async () => null) },
    pitch: { findUnique: vi.fn(async () => pitch) },
    teamMembership: { findMany: vi.fn(async () => []) },
    event: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => ({ id: 'e1', teamId: null, type: 'OTHER', pitchId: null, startAt: new Date('2030-01-01T10:00:00Z'), endAt: new Date('2030-01-01T11:00:00Z') })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'e1', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'e1', startAt: new Date('2030-01-01T10:00:00Z'), endAt: new Date('2030-01-01T11:00:00Z'), ...data })),
    },
  };
  return { prisma, service: new EventsService(prisma as never, {} as never, {} as never) };
}

const base = {
  type: 'OTHER' as const,
  title: 'T',
  startAt: new Date('2030-01-01T10:00:00Z'),
  endAt: new Date('2030-01-01T11:00:00Z'),
  pitchId: 'p1',
};

describe('adresa udalosti s plochou', () => {
  it('create preberie adresu plochy', async () => {
    const { service, prisma } = make();
    await service.create(base as never, 'u1');
    expect(prisma.event.create.mock.calls[0]![0].data.address).toBe('Plocha 1');
  });

  it('create: vlastná adresa má prednosť', async () => {
    const { service, prisma } = make();
    await service.create({ ...base, address: 'Vlastná 5' } as never, 'u1');
    expect(prisma.event.create.mock.calls[0]![0].data.address).toBe('Vlastná 5');
  });

  it('update pri nastavení plochy preberie adresu plochy, vlastná má prednosť', async () => {
    const a = make();
    await a.service.update('e1', { pitchId: 'p1' } as never, admin);
    expect(a.prisma.event.update.mock.calls[0]![0].data.address).toBe('Plocha 1');
    const b = make();
    await b.service.update('e1', { pitchId: 'p1', address: 'Vlastná 5' } as never, admin);
    expect(b.prisma.event.update.mock.calls[0]![0].data.address).toBe('Vlastná 5');
  });

  it('bez plochy ostáva input.address', async () => {
    const { service, prisma } = make();
    await service.create({ ...base, pitchId: undefined, address: 'X 1' } as never, 'u1');
    expect(prisma.event.create.mock.calls[0]![0].data.address).toBe('X 1');
  });
});
