import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  CLUB_DOCUMENT_MAX_BYTES,
  CLUB_DOCUMENT_MIME_TYPES,
  type CreateClubDocumentInput,
  type CreateClubPageInput,
  type CreateClubPersonInput,
  type UpdateClubDocumentInput,
  type UpdateClubPageInput,
  type UpdateClubPersonInput,
} from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

export const PUBLISH_CONFIRM_MESSAGE =
  'Publikovanie (status PUBLISHED) vyžaduje potvrdenie, že údaje overil klub (confirm: true)';

const ALLOWED_MIME = new Set<string>(CLUB_DOCUMENT_MIME_TYPES);

/** Admin výber dokumentu — NIKDY nečíta `data` (bajty súboru). */
export const ADMIN_DOCUMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  documentDate: true,
  originalFilename: true,
  mimeType: true,
  size: true,
  sha256: true,
  sourceUrl: true,
  sourceNote: true,
  status: true,
  confirmedAt: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ClubDocumentSelect;

type AdminDocumentRow = Prisma.ClubDocumentGetPayload<{ select: typeof ADMIN_DOCUMENT_SELECT }>;

export interface UploadedDocumentFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
}

/**
 * Publikačná poistka: status=PUBLISHED sa dá nastaviť len s confirm=true.
 * Vracia hodnotu confirmedAt na zápis (undefined = nemeniť).
 */
export function resolveConfirmation(input: { status?: string; confirm?: boolean }): Date | null | undefined {
  if (input.status === 'PUBLISHED' && input.confirm !== true) {
    throw new BadRequestException(PUBLISH_CONFIRM_MESSAGE);
  }
  if (input.confirm === true) return new Date();
  if (input.confirm === false) return null;
  return undefined;
}

/** "YYYY-MM-DD" → polnoc UTC (dátum podľa zdroja); null = vymazať; undefined = nemeniť. */
function toDocumentDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Overenie, že obsah zodpovedá deklarovanému typu (podpis súboru). */
export function matchesSignature(mime: string, buf: Buffer): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  switch (mime) {
    case 'application/pdf':
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff);
    default:
      // zip, docx, xlsx — ZIP kontajner (PK\x03\x04, prázdny PK\x05\x06)
      return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06);
  }
}

/** Názov súboru: bez ciest a riadiacich znakov, max 255 znakov. */
export function cleanFilename(name: string | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return cleaned || null;
}

@Injectable()
export class ClubContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- stránky

  listPages() {
    return this.prisma.clubPage.findMany({ orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] });
  }

  async getPage(id: string) {
    const page = await this.prisma.clubPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Stránka neexistuje');
    return page;
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const hit = await this.prisma.clubPage.findUnique({ where: { slug }, select: { id: true } });
    if (hit && hit.id !== exceptId) throw new ConflictException(`Stránka so slugom „${slug}" už existuje`);
  }

  async createPage(input: CreateClubPageInput, userId: string) {
    const confirmedAt = resolveConfirmation(input);
    await this.assertSlugFree(input.slug);
    const page = await this.prisma.clubPage.create({
      data: {
        slug: input.slug,
        title: input.title,
        body: input.body,
        status: input.status ?? 'DRAFT',
        sourceUrl: input.sourceUrl ?? null,
        sourceNote: input.sourceNote ?? null,
        sortOrder: input.sortOrder ?? 0,
        confirmedAt: confirmedAt ?? null,
        updatedById: userId,
      },
    });
    await this.audit(userId, 'CLUB_PAGE_CREATE', 'ClubPage', page.id, { slug: page.slug, status: page.status });
    return page;
  }

  async updatePage(id: string, input: UpdateClubPageInput, userId: string) {
    const confirmedAt = resolveConfirmation(input);
    const existing = await this.getPage(id);
    if (input.slug && input.slug !== existing.slug) await this.assertSlugFree(input.slug, id);
    const page = await this.prisma.clubPage.update({
      where: { id },
      data: {
        slug: input.slug,
        title: input.title,
        body: input.body,
        status: input.status,
        sourceUrl: input.sourceUrl,
        sourceNote: input.sourceNote,
        sortOrder: input.sortOrder,
        confirmedAt,
        updatedById: userId,
      },
    });
    await this.audit(userId, 'CLUB_PAGE_UPDATE', 'ClubPage', id, {
      fields: Object.keys(input),
      from: existing.status,
      status: page.status,
    });
    return page;
  }

  async removePage(id: string, userId: string) {
    const existing = await this.getPage(id);
    await this.prisma.clubPage.delete({ where: { id } });
    await this.audit(userId, 'CLUB_PAGE_DELETE', 'ClubPage', id, { slug: existing.slug, title: existing.title });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- osoby

  listPeople() {
    return this.prisma.clubPerson.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async getPerson(id: string) {
    const person = await this.prisma.clubPerson.findUnique({ where: { id } });
    if (!person) throw new NotFoundException('Osoba neexistuje');
    return person;
  }

  async createPerson(input: CreateClubPersonInput, userId: string) {
    const confirmedAt = resolveConfirmation(input);
    const person = await this.prisma.clubPerson.create({
      data: {
        name: input.name,
        role: input.role,
        group: input.group ?? 'MANAGEMENT',
        teamNote: input.teamNote ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        status: input.status ?? 'DRAFT',
        sourceUrl: input.sourceUrl ?? null,
        sourceNote: input.sourceNote ?? null,
        sortOrder: input.sortOrder ?? 0,
        confirmedAt: confirmedAt ?? null,
      },
    });
    await this.audit(userId, 'CLUB_PERSON_CREATE', 'ClubPerson', person.id, { name: person.name, status: person.status });
    return person;
  }

  async updatePerson(id: string, input: UpdateClubPersonInput, userId: string) {
    const confirmedAt = resolveConfirmation(input);
    const existing = await this.getPerson(id);
    const person = await this.prisma.clubPerson.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        group: input.group,
        teamNote: input.teamNote,
        phone: input.phone,
        email: input.email,
        status: input.status,
        sourceUrl: input.sourceUrl,
        sourceNote: input.sourceNote,
        sortOrder: input.sortOrder,
        confirmedAt,
      },
    });
    await this.audit(userId, 'CLUB_PERSON_UPDATE', 'ClubPerson', id, {
      fields: Object.keys(input),
      from: existing.status,
      status: person.status,
    });
    return person;
  }

  async removePerson(id: string, userId: string) {
    const existing = await this.getPerson(id);
    await this.prisma.clubPerson.delete({ where: { id } });
    await this.audit(userId, 'CLUB_PERSON_DELETE', 'ClubPerson', id, { name: existing.name });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- dokumenty

  private toAdminDocument(d: AdminDocumentRow) {
    return { ...d, hasFile: d.size !== null && d.sha256 !== null };
  }

  async listDocuments() {
    const rows = await this.prisma.clubDocument.findMany({
      orderBy: [{ documentDate: { sort: 'desc', nulls: 'last' } }, { sortOrder: 'asc' }, { title: 'asc' }],
      select: ADMIN_DOCUMENT_SELECT,
    });
    return rows.map((d) => this.toAdminDocument(d));
  }

  async getDocument(id: string) {
    const doc = await this.prisma.clubDocument.findUnique({ where: { id }, select: ADMIN_DOCUMENT_SELECT });
    if (!doc) throw new NotFoundException('Dokument neexistuje');
    return this.toAdminDocument(doc);
  }

  async createDocument(input: CreateClubDocumentInput, userId: string) {
    const confirmedAt = resolveConfirmation(input);
    const doc = await this.prisma.clubDocument.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? 'OTHER',
        documentDate: toDocumentDate(input.documentDate) ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceNote: input.sourceNote ?? null,
        status: input.status ?? 'DRAFT',
        sortOrder: input.sortOrder ?? 0,
        confirmedAt: confirmedAt ?? null,
      },
      select: ADMIN_DOCUMENT_SELECT,
    });
    await this.audit(userId, 'CLUB_DOCUMENT_CREATE', 'ClubDocument', doc.id, { title: doc.title, status: doc.status });
    return this.toAdminDocument(doc);
  }

  async updateDocument(id: string, input: UpdateClubDocumentInput, userId: string) {
    const confirmedAt = resolveConfirmation(input);
    const existing = await this.getDocument(id);
    const doc = await this.prisma.clubDocument.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        documentDate: toDocumentDate(input.documentDate),
        sourceUrl: input.sourceUrl,
        sourceNote: input.sourceNote,
        status: input.status,
        sortOrder: input.sortOrder,
        confirmedAt,
      },
      select: ADMIN_DOCUMENT_SELECT,
    });
    await this.audit(userId, 'CLUB_DOCUMENT_UPDATE', 'ClubDocument', id, {
      fields: Object.keys(input),
      from: existing.status,
      status: doc.status,
    });
    return this.toAdminDocument(doc);
  }

  async removeDocument(id: string, userId: string) {
    const existing = await this.getDocument(id);
    await this.prisma.clubDocument.delete({ where: { id } });
    await this.audit(userId, 'CLUB_DOCUMENT_DELETE', 'ClubDocument', id, {
      title: existing.title,
      sha256: existing.sha256,
    });
    return { deleted: true };
  }

  /** Uloží súbor BEZ ZMENY (bajty), spolu s SHA-256, veľkosťou, typom a pôvodným názvom. */
  async uploadDocumentFile(id: string, file: UploadedDocumentFile | undefined, userId: string) {
    if (!file?.buffer || file.buffer.length === 0) throw new BadRequestException('Chýba súbor (pole "file")');
    if (file.buffer.length > CLUB_DOCUMENT_MAX_BYTES) throw new BadRequestException('Súbor je väčší ako 15 MB');
    const mimeType = (file.mimetype ?? '').toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException('Nepovolený typ súboru (PDF, ZIP, DOCX, XLSX, PNG, JPEG)');
    }
    if (!matchesSignature(mimeType, file.buffer)) {
      throw new BadRequestException('Obsah súboru nezodpovedá jeho typu');
    }
    await this.getDocument(id);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const size = file.buffer.length;
    const originalFilename = cleanFilename(file.originalname);
    const doc = await this.prisma.clubDocument.update({
      where: { id },
      data: { data: file.buffer, sha256, size, mimeType, originalFilename },
      select: ADMIN_DOCUMENT_SELECT,
    });
    await this.audit(userId, 'CLUB_DOCUMENT_FILE_UPLOAD', 'ClubDocument', id, {
      originalFilename,
      mimeType,
      size,
      sha256,
    });
    return this.toAdminDocument(doc);
  }

  async removeDocumentFile(id: string, userId: string) {
    const existing = await this.getDocument(id);
    const doc = await this.prisma.clubDocument.update({
      where: { id },
      data: { data: null, sha256: null, size: null, mimeType: null, originalFilename: null },
      select: ADMIN_DOCUMENT_SELECT,
    });
    await this.audit(userId, 'CLUB_DOCUMENT_FILE_DELETE', 'ClubDocument', id, {
      originalFilename: existing.originalFilename,
      sha256: existing.sha256,
    });
    return this.toAdminDocument(doc);
  }

  private audit(userId: string, action: string, entity: string, entityId: string, diff: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, diff: diff as never },
    });
  }
}
