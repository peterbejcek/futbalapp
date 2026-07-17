import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberInput, MemberStatus } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

const activeMembership = {
  where: { leftAt: null, season: { isActive: true } },
  include: { team: { include: { teamCategory: true } } },
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: {
    categoryCode?: string;
    teamId?: string;
    teamIds?: string[]; // scope pre trénera (jeho družstvá)
    seasonId?: string;
    status?: string;
  }) {
    const hasScope = params.categoryCode || params.teamId || params.teamIds || params.seasonId;
    return this.prisma.member.findMany({
      where: {
        status: params.status ? (params.status as MemberStatus) : undefined,
        memberships: hasScope
          ? {
              some: {
                leftAt: null,
                season: params.seasonId ? { id: params.seasonId } : { isActive: true },
                team: {
                  id: params.teamId ? params.teamId : params.teamIds ? { in: params.teamIds } : undefined,
                  teamCategory: params.categoryCode ? { code: params.categoryCode } : undefined,
                },
              },
            }
          : undefined,
      },
      include: {
        memberships: activeMembership,
        guardians: {
          include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async get(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { team: { include: { teamCategory: true } }, season: true },
          orderBy: { joinedAt: 'desc' },
        },
        guardians: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
        },
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

  /** Je člen v niektorom z uvedených družstiev v aktívnej sezóne? (scope trénera) */
  async memberInTeams(memberId: string, teamIds: string[]): Promise<boolean> {
    if (teamIds.length === 0) return false;
    const count = await this.prisma.teamMembership.count({
      where: { memberId, leftAt: null, season: { isActive: true }, teamId: { in: teamIds } },
    });
    return count > 0;
  }

  async update(id: string, input: Partial<CreateMemberInput>) {
    await this.get(id);
    return this.prisma.member.update({
      where: { id },
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
}
