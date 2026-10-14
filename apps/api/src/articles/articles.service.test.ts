import { describe, expect, it, vi } from 'vitest';
import { ArticlesService, slugify } from './articles.service';

function make(existing: Array<{ id: string; slug: string; title?: string; publishedAt?: Date | null }> = []) {
  const prisma = {
    article: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
        existing.find((a) => (where.id ? a.id === where.id : a.slug === where.slug)) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'a1', ...data })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  return { prisma, service: new ArticlesService(prisma as never) };
}

describe('slugify', () => {
  it('odstráni diakritiku a použije pomlčky', () => {
    expect(slugify('Víťazstvo žiakov v Košiciach!')).toBe('vitazstvo-ziakov-v-kosiciach');
    expect(slugify('???')).toBe('clanok');
  });
});

describe('ArticlesService', () => {
  it('pri kolízii slugu pridá -2, -3', async () => {
    const { service, prisma } = make([
      { id: 'x', slug: 'nabor' },
      { id: 'y', slug: 'nabor-2' },
    ]);
    await service.create({ title: 'Nábor', excerpt: 'e', body: 'b' }, 'u1');
    expect(prisma.article.create.mock.calls[0]![0].data.slug).toBe('nabor-3');
    expect(prisma.article.create.mock.calls[0]![0].data.publishedAt).toBeNull();
  });

  it('publish=true nastaví publishedAt, publish=false ho zruší', async () => {
    const { service, prisma } = make([{ id: 'a1', slug: 's', title: 'T', publishedAt: null }]);
    await service.update('a1', { publish: true }, 'u1');
    expect(prisma.article.update.mock.calls[0]![0].data.publishedAt).toBeInstanceOf(Date);
    await service.update('a1', { publish: false }, 'u1');
    expect(prisma.article.update.mock.calls[1]![0].data.publishedAt).toBeNull();
  });

  it('publikovaný článok pri zmene titulu zachová slug a pôvodný publishedAt', async () => {
    const at = new Date('2026-01-01');
    const { service, prisma } = make([{ id: 'a1', slug: 'stary', title: 'Starý', publishedAt: at }]);
    await service.update('a1', { title: 'Nový titul', publish: true }, 'u1');
    const data = prisma.article.update.mock.calls[0]![0].data;
    expect(data.slug).toBeUndefined();
    expect(data.publishedAt).toBe(at);
  });
});
