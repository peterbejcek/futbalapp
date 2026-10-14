import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  createClubDocumentSchema,
  createClubPageSchema,
  createClubPersonSchema,
  updateArticleSchema,
  updateClubDocumentSchema,
} from '@fkknv/shared';
import { ClubContentService, PUBLISH_CONFIRM_MESSAGE, cleanFilename, matchesSignature } from './club-content.service';
import { ClubContentController } from './club-content.controller';
import { ROLES_KEY } from '../auth/roles.decorator';

const PDF = Buffer.from('%PDF-1.7\n% test obsah á\n%%EOF', 'utf8');

function make() {
  const page = { id: 'p1', slug: 'historia', title: 'História', status: 'DRAFT' };
  const doc = { id: 'd1', title: 'Zmluva', status: 'DRAFT', size: null, sha256: null, originalFilename: null };
  const prisma = {
    clubPage: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
        where.id === 'p1' || where.slug === 'historia' ? page : null,
      ),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...page, ...data })),
      delete: vi.fn(async () => page),
    },
    clubPerson: {
      findUnique: vi.fn(async () => ({ id: 'o1', name: 'Ján', status: 'DRAFT' })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'o-new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'o1', ...data })),
    },
    clubDocument: {
      findMany: vi.fn(async () => [{ ...doc, size: 10, sha256: 'ab' }]),
      findUnique: vi.fn(async () => doc),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd-new', size: null, sha256: null, ...data })),
      // ako Prisma: pri `select` vráti len vybrané polia
      update: vi.fn(async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const row: Record<string, unknown> = { ...doc, ...data };
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k] ?? null])) : row;
      }),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  return { prisma, service: new ClubContentService(prisma as never) };
}

describe('publikačná poistka', () => {
  it('PUBLISHED bez confirm → 400 s jasnou správou (stránka, osoba, dokument)', async () => {
    const { service, prisma } = make();
    await expect(service.createPage({ slug: 'kontakt', title: 'Kontakt', body: 'x', status: 'PUBLISHED' }, 'u1')).rejects.toThrow(
      PUBLISH_CONFIRM_MESSAGE,
    );
    await expect(service.updatePage('p1', { status: 'PUBLISHED', confirm: false }, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.createPerson({ name: 'A', role: 'Predseda', status: 'PUBLISHED' }, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateDocument('d1', { status: 'PUBLISHED' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.clubPage.create).not.toHaveBeenCalled();
    expect(prisma.clubPage.update).not.toHaveBeenCalled();
    expect(prisma.clubDocument.update).not.toHaveBeenCalled();
  });

  it('confirm=true nastaví confirmedAt, confirm=false ho zruší; DRAFT/ARCHIVED confirm nevyžadujú', async () => {
    const { service, prisma } = make();
    await service.updatePage('p1', { status: 'PUBLISHED', confirm: true }, 'u1');
    expect(prisma.clubPage.update.mock.calls[0]![0].data.confirmedAt).toBeInstanceOf(Date);
    expect(prisma.clubPage.update.mock.calls[0]![0].data.status).toBe('PUBLISHED');
    await service.updatePage('p1', { status: 'DRAFT', confirm: false }, 'u1');
    expect(prisma.clubPage.update.mock.calls[1]![0].data.confirmedAt).toBeNull();
    await service.updatePage('p1', { status: 'ARCHIVED' }, 'u1');
    expect(prisma.clubPage.update.mock.calls[2]![0].data.confirmedAt).toBeUndefined();
    await service.createDocument({ title: 'Oznam', status: 'ARCHIVED' }, 'u1');
    expect(prisma.clubDocument.create.mock.calls[0]![0].data.confirmedAt).toBeNull();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CLUB_DOCUMENT_CREATE', entity: 'ClubDocument' }) }),
    );
  });

  it('úprava PUBLISHED záznamu bez zmeny stavu vyžaduje confirm (stránka, osoba, dokument)', async () => {
    const { service, prisma } = make();
    prisma.clubPage.findUnique.mockResolvedValue({ id: 'p1', slug: 'historia', title: 'H', status: 'PUBLISHED' });
    prisma.clubPerson.findUnique.mockResolvedValue({ id: 'o1', name: 'Ján', status: 'PUBLISHED' });
    prisma.clubDocument.findUnique.mockResolvedValue({ id: 'd1', title: 'Z', status: 'PUBLISHED', size: null, sha256: null });
    await expect(service.updatePage('p1', { title: 'Nový' }, 'u1')).rejects.toThrow(PUBLISH_CONFIRM_MESSAGE);
    await expect(service.updatePage('p1', { status: 'PUBLISHED', body: 'x' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updatePerson('o1', { role: 'Tréner' }, 'u1')).rejects.toThrow(PUBLISH_CONFIRM_MESSAGE);
    await expect(service.updateDocument('d1', { description: 'x' }, 'u1')).rejects.toThrow(PUBLISH_CONFIRM_MESSAGE);
    expect(prisma.clubPage.update).not.toHaveBeenCalled();
    expect(prisma.clubPerson.update).not.toHaveBeenCalled();
    expect(prisma.clubDocument.update).not.toHaveBeenCalled();
    await service.updatePerson('o1', { role: 'Tréner', confirm: true }, 'u1');
    expect(prisma.clubPerson.update.mock.calls[0]![0].data.confirmedAt).toBeInstanceOf(Date);
  });

  it('PUBLISHED: samotné sortOrder a zmena na DRAFT/ARCHIVED confirm nevyžadujú', async () => {
    const { service, prisma } = make();
    prisma.clubPage.findUnique.mockResolvedValue({ id: 'p1', slug: 'historia', title: 'H', status: 'PUBLISHED' });
    prisma.clubDocument.findUnique.mockResolvedValue({ id: 'd1', title: 'Z', status: 'PUBLISHED', size: null, sha256: null });
    await service.updatePage('p1', { sortOrder: 3 }, 'u1');
    expect(prisma.clubPage.update.mock.calls[0]![0].data.confirmedAt).toBeUndefined();
    await service.updatePage('p1', { status: 'DRAFT', title: 'x' }, 'u1');
    await service.updateDocument('d1', { status: 'ARCHIVED', description: 'x' }, 'u1');
    expect(prisma.clubPage.update).toHaveBeenCalledTimes(2);
    expect(prisma.clubDocument.update).toHaveBeenCalledTimes(1);
  });

  it('nový obsah je predvolene DRAFT; duplicitný slug → 409', async () => {
    const { service, prisma } = make();
    await service.createPage({ slug: 'kontakt', title: 'Kontakt', body: '' }, 'u1');
    expect(prisma.clubPage.create.mock.calls[0]![0].data.status).toBe('DRAFT');
    await expect(service.createPage({ slug: 'historia', title: 'H', body: '' }, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('dokumenty (admin)', () => {
  it('zoznam a detail nenačítajú data; vracajú hasFile, size, sha256', async () => {
    const { service, prisma } = make();
    const list = await service.listDocuments();
    const sel = prisma.clubDocument.findMany.mock.calls[0]![0].select;
    expect(sel.data).toBeUndefined();
    expect(sel).toMatchObject({ size: true, sha256: true });
    expect(list[0]).toMatchObject({ hasFile: true, size: 10, sha256: 'ab' });
    expect(list[0]).not.toHaveProperty('data');
    await service.getDocument('d1');
    expect(prisma.clubDocument.findUnique.mock.calls[0]![0].select.data).toBeUndefined();
  });

  it('upload uloží bajty bez zmeny a sha256 zodpovedá bajtom', async () => {
    const { service, prisma } = make();
    const res = await service.uploadDocumentFile(
      'd1',
      { buffer: PDF, mimetype: 'application/pdf', originalname: 'Zmluva č. 1/2024.pdf' },
      'u1',
    );
    const data = prisma.clubDocument.update.mock.calls[0]![0].data;
    expect(Buffer.compare(data.data, PDF)).toBe(0);
    expect(data.sha256).toBe(createHash('sha256').update(PDF).digest('hex'));
    expect(data.size).toBe(PDF.length);
    expect(data.mimeType).toBe('application/pdf');
    expect(data.originalFilename).toBe('2024.pdf');
    expect(prisma.clubDocument.update.mock.calls[0]![0].select.data).toBeUndefined();
    expect(res).not.toHaveProperty('data');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CLUB_DOCUMENT_FILE_UPLOAD' }) }),
    );
  });

  it('nepovolený typ, nesúlad obsahu a chýbajúci súbor → 400', async () => {
    const { service } = make();
    await expect(
      service.uploadDocumentFile('d1', { buffer: Buffer.from('<svg/>'), mimetype: 'image/svg+xml' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadDocumentFile('d1', { buffer: Buffer.from('<html>'), mimetype: 'application/pdf' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadDocumentFile('d1', undefined, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('zmazanie súboru vynuluje data aj metadáta', async () => {
    const { service, prisma } = make();
    await service.removeDocumentFile('d1', 'u1');
    expect(prisma.clubDocument.update.mock.calls[0]![0].data).toEqual({
      data: null,
      sha256: null,
      size: null,
      mimeType: null,
      originalFilename: null,
    });
  });

  it('podpisy súborov a čistenie názvu', () => {
    expect(matchesSignature('application/pdf', PDF)).toBe(true);
    expect(matchesSignature('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesSignature('application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('PK\x03\x04'))).toBe(true);
    expect(matchesSignature('image/jpeg', PDF)).toBe(false);
    expect(cleanFilename('..\\..\\a\r\nb.pdf')).toBe('ab.pdf');
    expect(cleanFilename('')).toBeNull();
  });
});

describe('validácia (zod)', () => {
  it('slug [a-z0-9-], sourceUrl len http(s), dátum YYYY-MM-DD alebo null', () => {
    expect(createClubPageSchema.safeParse({ slug: 'O klube', title: 'x', body: '' }).success).toBe(false);
    expect(createClubPageSchema.safeParse({ slug: 'o-klube', title: 'x', body: '' }).success).toBe(true);
    expect(createClubPageSchema.safeParse({ slug: 'a', title: 'x', body: '', sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(createClubPersonSchema.safeParse({ name: 'A', role: 'B', sourceUrl: 'ftp://x.sk/a' }).success).toBe(false);
    const ok = createClubDocumentSchema.parse({ title: 'D', sourceUrl: 'https://fkknv.sk/a.pdf', documentDate: '2024-02-29' });
    expect(ok.sourceUrl).toBe('https://fkknv.sk/a.pdf');
    expect(createClubDocumentSchema.parse({ title: 'D', sourceUrl: '' }).sourceUrl).toBeNull();
    expect(createClubDocumentSchema.safeParse({ title: 'D', documentDate: '2023-02-29' }).success).toBe(false);
    expect(updateClubDocumentSchema.parse({ documentDate: null }).documentDate).toBeNull();
    expect(updateArticleSchema.safeParse({ isArchive: true, sourceUrl: 'http://old.fkknv.sk/x' }).success).toBe(true);
    expect(updateArticleSchema.safeParse({ sourceUrl: 'data:text/html,x' }).success).toBe(false);
  });
});

describe('roly', () => {
  it('každá route metóda ClubContentController má @Roles(ADMIN, MANAGER)', () => {
    const proto = ClubContentController.prototype as unknown as Record<string, unknown>;
    const routes = Object.getOwnPropertyNames(proto).filter(
      (k) => k !== 'constructor' && Reflect.getMetadata(METHOD_METADATA, proto[k] as object) !== undefined,
    );
    expect(routes.length).toBe(17);
    for (const k of routes) {
      expect(Reflect.getMetadata(ROLES_KEY, proto[k] as object), k).toEqual(['ADMIN', 'MANAGER']);
    }
    const upload = proto.uploadDocumentFile as object;
    expect(Reflect.getMetadata(METHOD_METADATA, upload)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, upload)).toBe('documents/:id/file');
  });
});
