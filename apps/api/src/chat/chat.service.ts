import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import type { AuthUser } from '../auth/current-user.decorator';

function isStaff(user: AuthUser): boolean {
  return user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /** Kanály, do ktorých má používateľ prístup. Vedenie vidí všetky. */
  async myChannels(user: AuthUser) {
    const channels = await this.prisma.channel.findMany({
      where: isStaff(user)
        ? {}
        : {
            OR: [
              { type: 'ANNOUNCEMENT' }, // oznamy číta každý prihlásený
              { members: { some: { userId: user.id } } },
            ],
          },
      include: {
        teamCategory: { select: { code: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return channels.map((channel) => ({
      id: channel.id,
      type: channel.type,
      name: channel.name,
      categoryCode: channel.teamCategory?.code ?? null,
      lastMessage: channel.messages[0] ?? null,
    }));
  }

  private async assertAccess(channelId: string, user: AuthUser, forPosting: boolean) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: { where: { userId: user.id } } },
    });
    if (!channel) throw new NotFoundException('Kanál neexistuje');

    const membership = channel.members[0];
    const staff = isStaff(user);

    if (channel.type === 'ANNOUNCEMENT') {
      // čítať môže každý prihlásený, písať len vedenie a moderátori
      if (forPosting && !staff && !membership?.isModerator) {
        throw new ForbiddenException('Do oznamov môže písať len vedenie klubu');
      }
      return channel;
    }
    if (!staff && !membership) {
      throw new ForbiddenException('Nie ste členom tohto kanála');
    }
    return channel;
  }

  async messages(channelId: string, user: AuthUser, before?: string) {
    await this.assertAccess(channelId, user, false);
    const messages = await this.prisma.message.findMany({
      where: { channelId, createdAt: before ? { lt: new Date(before) } : undefined },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return messages.reverse();
  }

  async post(channelId: string, user: AuthUser, body: string) {
    const channel = await this.assertAccess(channelId, user, true);
    const message = await this.prisma.message.create({
      data: { channelId, senderId: user.id, body },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Push ostatným členom kanála (odosielateľ notifikáciu nedostane).
    // Zámerne bez await v ceste odpovede by hrozila strata chýb — radšej
    // počkáme, PushService nikdy nevyhodí výnimku.
    const members = await this.prisma.channelMember.findMany({
      where: { channelId, userId: { not: user.id }, muted: false },
      select: { userId: true },
    });
    await this.pushService.notifyUsers(
      members.map((m) => m.userId),
      {
        title: channel.name,
        body: `${message.sender.firstName} ${message.sender.lastName}: ${body.slice(0, 120)}`,
        data: { type: 'chat', channelId },
      },
    );

    return message;
  }

  /**
   * Prepočíta členstvo v kategóriových kanáloch podľa aktuálnej sezóny:
   * rodičia členov kategórie + hráči s vlastným účtom + tréneri kategórie
   * (ako moderátori). Volá sa po zmene súpisiek alebo prechode na novú sezónu.
   */
  async syncCategoryChannels() {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) return { synced: 0 };

    const channels = await this.prisma.channel.findMany({
      where: { type: 'CATEGORY', teamCategoryId: { not: null } },
    });

    let synced = 0;
    for (const channel of channels) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { seasonId: season.id, teamCategoryId: channel.teamCategoryId!, leftAt: null },
        include: { member: { include: { guardians: true } } },
      });

      const userIds = new Map<string, boolean>(); // userId -> isModerator
      for (const m of memberships) {
        if (m.member.userId) userIds.set(m.member.userId, false);
        for (const guardian of m.member.guardians) userIds.set(guardian.userId, false);
      }
      const coaches = await this.prisma.userRole.findMany({
        where: { role: 'COACH', teamCategoryId: channel.teamCategoryId },
      });
      for (const coach of coaches) userIds.set(coach.userId, true);

      for (const [userId, isModerator] of userIds) {
        await this.prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: channel.id, userId } },
          create: { channelId: channel.id, userId, isModerator },
          update: { isModerator },
        });
        synced++;
      }
    }
    return { channels: channels.length, synced };
  }
}
