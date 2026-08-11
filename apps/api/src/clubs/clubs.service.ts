import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.club.findMany({ orderBy: { name: 'asc' } });
  }

  /** Vytvorí/aktualizuje klub podľa mena (idempotentne). */
  create(input: { name: string; logoUrl?: string | null; sportnetDomain?: string | null }) {
    const name = input.name.trim();
    return this.prisma.club.upsert({
      where: { name },
      create: { name, logoUrl: input.logoUrl ?? undefined, sportnetDomain: input.sportnetDomain ?? undefined },
      update: {
        logoUrl: input.logoUrl ?? undefined,
        sportnetDomain: input.sportnetDomain ?? undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.club.delete({ where: { id } });
    return { deleted: true };
  }

  /** Logo klubu podľa mena — na denormalizáciu do zápasu. */
  async logoForName(name?: string | null): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const club = await this.prisma.club.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });
    return club?.logoUrl ?? null;
  }

  /** Zabezpečí, že klub s daným menom je v registri (doplní nového súpera). */
  async ensure(name?: string | null) {
    const trimmed = name?.trim();
    if (!trimmed || trimmed === 'Neznámy súper') return;
    const existing = await this.prisma.club.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (!existing) await this.prisma.club.create({ data: { name: trimmed } });
  }
}
