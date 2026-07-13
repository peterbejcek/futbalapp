import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { categoryCode?: string; seasonId?: string; status?: string }) {
    return this.prisma.member.findMany({
      where: {
        status: params.status ? (params.status as never) : undefined,
        memberships:
          params.categoryCode || params.seasonId
            ? {
                some: {
                  leftAt: null,
                  season: params.seasonId ? { id: params.seasonId } : { isActive: true },
                  teamCategory: params.categoryCode ? { code: params.categoryCode } : undefined,
                },
              }
            : undefined,
      },
      include: {
        memberships: {
          where: { leftAt: null, season: { isActive: true } },
          include: { teamCategory: true },
        },
        guardians: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async get(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        memberships: { include: { teamCategory: true, season: true }, orderBy: { joinedAt: 'desc' } },
        guardians: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        paymentObligations: { orderBy: { dueDate: 'desc' }, take: 24 },
      },
    });
    if (!member) throw new NotFoundException('Člen neexistuje');
    return member;
  }

  create(input: CreateMemberInput) {
    return this.prisma.member.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        status: input.status,
        futbalnetId: input.futbalnetId,
        healthNotes: input.healthNotes,
      },
    });
  }

  async update(id: string, input: Partial<CreateMemberInput>) {
    await this.get(id);
    return this.prisma.member.update({ where: { id }, data: input });
  }
}
