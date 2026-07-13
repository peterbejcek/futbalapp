import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateEventInput, MarkAttendanceInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { categoryCode?: string; from?: Date; to?: Date; type?: string }) {
    return this.prisma.event.findMany({
      where: {
        teamCategory: params.categoryCode ? { code: params.categoryCode } : undefined,
        type: params.type ? (params.type as never) : undefined,
        startAt: { gte: params.from, lte: params.to },
      },
      include: { teamCategory: true, match: true },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Vytvorí udalosť; pre TRAINING automaticky predpripraví dochádzku
   * pre všetkých členov kategórie, pre MATCH/TOURNAMENT vytvorí Match záznam.
   */
  async create(input: CreateEventInput, createdById: string) {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new BadRequestException('Neexistuje aktívna sezóna');

    const category = input.teamCategoryCode
      ? await this.prisma.teamCategory.findUnique({ where: { code: input.teamCategoryCode } })
      : null;
    if (input.teamCategoryCode && !category) {
      throw new BadRequestException(`Kategória ${input.teamCategoryCode} neexistuje`);
    }

    const isMatch = input.type === 'MATCH' || input.type === 'TOURNAMENT';

    const event = await this.prisma.event.create({
      data: {
        type: input.type,
        seasonId: season.id,
        teamCategoryId: category?.id,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        createdById,
        match: isMatch
          ? { create: { opponent: input.opponent ?? 'Neznámy súper', isHome: input.isHome ?? true } }
          : undefined,
      },
      include: { match: true },
    });

    if (input.type === 'TRAINING' && category) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { seasonId: season.id, teamCategoryId: category.id, leftAt: null },
      });
      if (memberships.length > 0) {
        await this.prisma.attendance.createMany({
          data: memberships.map((m) => ({ eventId: event.id, memberId: m.memberId })),
          skipDuplicates: true,
        });
      }
    }

    return event;
  }

  async attendance(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendances: {
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { member: { lastName: 'asc' } },
        },
      },
    });
    if (!event) throw new NotFoundException('Udalosť neexistuje');
    return event;
  }

  markAttendance(eventId: string, input: MarkAttendanceInput, markedById: string) {
    return this.prisma.attendance.upsert({
      where: { eventId_memberId: { eventId, memberId: input.memberId } },
      create: { eventId, memberId: input.memberId, status: input.status, markedById, markedAt: new Date() },
      update: { status: input.status, markedById, markedAt: new Date() },
    });
  }
}
