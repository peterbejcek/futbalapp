import { describe, expect, it, vi } from 'vitest';
import { PitchesService } from './pitches.service';

function make(pitch: Record<string, unknown> | null = { id: 'p1', name: 'A', surface: 'PT', address: 'Stará 1' }) {
  const prisma = {
    pitch: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string } }) => (where.id ? pitch : null)),
      aggregate: vi.fn(async () => ({ _max: { sortOrder: 1 } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...pitch, ...data })),
    },
    event: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  return { prisma, service: new PitchesService(prisma as never) };
}

describe('PitchesService adresa', () => {
  it('create uloží adresu', async () => {
    const { service, prisma } = make();
    await service.create({ name: 'B', surface: 'PT', address: 'Nová 2' });
    expect(prisma.pitch.create.mock.calls[0]![0].data.address).toBe('Nová 2');
  });

  it('update uloží adresu a propaguje ju len udalostiam bez vlastnej adresy', async () => {
    const { service, prisma } = make();
    await service.update('p1', { address: 'Nová 2' });
    expect(prisma.pitch.update.mock.calls[0]![0].data.address).toBe('Nová 2');
    expect(prisma.event.updateMany).toHaveBeenCalledWith({
      where: { pitchId: 'p1', OR: [{ address: null }, { address: 'Stará 1' }] },
      data: { address: 'Nová 2' },
    });
  });

  it('update null vymaže adresu a propaguje null', async () => {
    const { service, prisma } = make();
    await service.update('p1', { address: null });
    expect(prisma.event.updateMany).toHaveBeenLastCalledWith({
      where: { pitchId: 'p1', OR: [{ address: null }, { address: 'Stará 1' }] },
      data: { address: null },
    });
  });

  it('update bez adresy ju nepropaguje', async () => {
    const { service, prisma } = make();
    await service.update('p1', { name: 'A2' });
    expect(prisma.event.updateMany).toHaveBeenCalledTimes(1);
  });
});
