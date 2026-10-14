import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateArticleInput, UpdateArticleInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Slug z titulu: bez diakritiky, malé písmená, pomlčky. */
export function slugify(title: string): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s || 'clanok';
}

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.article.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Článok neexistuje');
    return article;
  }

  /** Unikátny slug; pri kolízii pridá -2, -3… (vlastný záznam `exceptId` sa ignoruje). */
  async uniqueSlug(base: string, exceptId?: string): Promise<string> {
    let candidate = base;
    for (let n = 2; ; n++) {
      const hit = await this.prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!hit || hit.id === exceptId) return candidate;
      candidate = `${base}-${n}`;
    }
  }

  async create(input: CreateArticleInput, authorId: string) {
    const slug = await this.uniqueSlug(slugify(input.title));
    const article = await this.prisma.article.create({
      data: {
        slug,
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        publishedAt: input.publish ? new Date() : null,
        authorId,
      },
    });
    await this.audit(authorId, 'ARTICLE_CREATE', article.id, { title: article.title, published: !!article.publishedAt });
    return article;
  }

  async update(id: string, input: UpdateArticleInput, userId: string) {
    const existing = await this.get(id);
    let slug: string | undefined;
    if (input.slug && input.slug !== existing.slug) {
      slug = await this.uniqueSlug(input.slug, id);
    } else if (input.title && input.title !== existing.title && !existing.publishedAt) {
      // slug sa pri zmene titulu mení len kým je článok koncept
      slug = await this.uniqueSlug(slugify(input.title), id);
    }
    let publishedAt: Date | null | undefined;
    if (input.publish === true) publishedAt = existing.publishedAt ?? new Date();
    else if (input.publish === false) publishedAt = null;

    const article = await this.prisma.article.update({
      where: { id },
      data: {
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        slug,
        publishedAt,
      },
    });
    await this.audit(userId, 'ARTICLE_UPDATE', id, {
      fields: Object.keys(input),
      published: !!article.publishedAt,
    });
    return article;
  }

  async remove(id: string, userId: string) {
    const existing = await this.get(id);
    await this.prisma.article.delete({ where: { id } });
    await this.audit(userId, 'ARTICLE_DELETE', id, { title: existing.title });
    return { deleted: true };
  }

  private audit(userId: string, action: string, entityId: string, diff: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: { userId, action, entity: 'Article', entityId, diff: diff as never },
    });
  }
}
