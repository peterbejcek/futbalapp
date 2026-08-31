import { ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';
import { ChatGateway } from './chat.gateway';
import type { AuthUser } from '../auth/current-user.decorator';
import { isStaff } from '../auth/scope';

/** Do týchto kanálov píše iba vedenie / tréner (moderátor); ostatní len čítajú. */
const READ_ONLY_FOR_MEMBERS = new Set(['TEAM_ANNOUNCEMENTS', 'CLUB_ANNOUNCEMENT']);

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, firstName: true, lastName: true } },
  attachment: { select: { id: true, filename: true, mimeType: true, size: true } },
} as const;
/** Interné kanály len pre daný okruh. */
const STAFF_ONLY = new Set(['COACHES', 'BOARD']);

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    @Inject(forwardRef(() => ChatGateway)) private readonly chatGateway: ChatGateway,
  ) {}

  /** Družstvá relevantné pre používateľa: jeho vlastné (hráč) + jeho detí (rodič). */
  private async relevantTeamIds(userId: string): Promise<string[]> {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) return [];
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        seasonId: season.id,
        leftAt: null,
        member: { OR: [{ userId }, { guardians: { some: { userId } } }] },
      },
      select: { teamId: true },
    });
    return [...new Set(memberships.map((m) => m.teamId))];
  }

  /** Kanály, do ktorých má používateľ prístup, zoskupené podľa družstva. */
  async myChannels(user: AuthUser) {
    const staff = isStaff(user);
    const coach = user.roles.some((r) => r.role === 'COACH');
    // hráč/rodič: len kanály svojich družstiev (a detí); tréner: všetky
    const relevant = !staff && !coach ? await this.relevantTeamIds(user.id) : [];
    const channels = await this.prisma.channel.findMany({
      where: staff
        ? {}
        : {
            OR: [
              { kind: 'CLUB_ANNOUNCEMENT' }, // celoklubové oznamy číta každý prihlásený
              { members: { some: { userId: user.id } } },
              // tréner vidí komunikáciu v každom družstve + interný kanál trénerov/vedenia
              ...(coach
                ? [{ teamId: { not: null } }, { kind: 'COACHES' as const }]
                : [{ teamId: { in: relevant } }]), // hráč/rodič: kanály svojich/detských družstiev
            ],
          },
      include: {
        team: { include: { teamCategory: { select: { code: true, sortOrder: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true } },
      },
    });
    return channels
      .map((channel) => ({
        id: channel.id,
        kind: channel.kind,
        name: channel.name,
        teamId: channel.teamId,
        teamName: channel.team?.name ?? null,
        categoryCode: channel.team?.teamCategory.code ?? null,
        categorySort: channel.team?.teamCategory.sortOrder ?? -1,
        lastMessage: channel.messages[0] ?? null,
      }))
      .sort(
        (a, b) =>
          a.categorySort - b.categorySort ||
          (a.teamName ?? '').localeCompare(b.teamName ?? '') ||
          a.name.localeCompare(b.name),
      );
  }

  private async assertAccess(channelId: string, user: AuthUser, forPosting: boolean) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: { where: { userId: user.id } } },
    });
    if (!channel) throw new NotFoundException('Kanál neexistuje');

    const membership = channel.members[0];
    const staff = isStaff(user);
    const coach = user.roles.some((r) => r.role === 'COACH');

    if (channel.kind === 'COACHES') {
      // interný kanál trénerov a vedenia
      if (!staff && !coach && !membership) throw new ForbiddenException('Nemáte prístup k tomuto kanálu');
      return channel;
    }
    if (STAFF_ONLY.has(channel.kind)) {
      if (!staff && !membership) throw new ForbiddenException('Nemáte prístup k tomuto kanálu');
      return channel;
    }

    if (channel.kind === 'CLUB_ANNOUNCEMENT') {
      if (forPosting && !staff) throw new ForbiddenException('Do oznamov klubu môže písať len vedenie');
      return channel; // čítať môže každý prihlásený
    }

    // tímové kanály: vedenie/tréner (vidí každé družstvo), člen kanála, alebo
    // hráč/rodič družstva (jeho alebo jeho dieťaťa)
    if (!staff && !coach && !membership) {
      const relevant = channel.teamId ? await this.relevantTeamIds(user.id) : [];
      if (!channel.teamId || !relevant.includes(channel.teamId)) {
        throw new ForbiddenException('Nie ste členom tohto kanála');
      }
    }

    if (forPosting && READ_ONLY_FOR_MEMBERS.has(channel.kind) && !staff && !coach && !membership?.isModerator) {
      throw new ForbiddenException('Do oznamov družstva môže písať len tréner alebo vedenie');
    }
    return channel;
  }

  async messages(channelId: string, user: AuthUser, before?: string) {
    await this.assertAccess(channelId, user, false);
    const messages = await this.prisma.message.findMany({
      where: { channelId, createdAt: before ? { lt: new Date(before) } : undefined },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return messages.reverse();
  }

  async post(channelId: string, user: AuthUser, body: string) {
    const channel = await this.assertAccess(channelId, user, true);
    const message = await this.prisma.message.create({
      data: { channelId, senderId: user.id, body },
      include: MESSAGE_INCLUDE,
    });

    this.chatGateway.broadcastMessage(channelId, message);
    await this.notifyMembers(channel, user.id, `${message.sender.firstName} ${message.sender.lastName}: ${body.slice(0, 120)}`);
    return message;
  }

  private async notifyMembers(channel: { id: string; name: string }, senderId: string, body: string) {
    const members = await this.prisma.channelMember.findMany({
      where: { channelId: channel.id, userId: { not: senderId }, muted: false },
      select: { userId: true },
    });
    await this.pushService.notifyUsers(
      members.map((m) => m.userId),
      { title: channel.name, body, data: { type: 'chat', channelId: channel.id } },
    );
  }

  /** Odošle správu s prílohou (obrázok/dokument). Voliteľný text ako popis. */
  async postAttachment(
    channelId: string,
    user: AuthUser,
    body: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    const channel = await this.assertAccess(channelId, user, true);
    const message = await this.prisma.message.create({
      data: { channelId, senderId: user.id, body: body?.trim() ?? '' },
    });
    await this.prisma.chatAttachment.create({
      data: {
        messageId: message.id,
        filename: file.originalname || 'príloha',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        data: file.buffer,
      },
    });
    const full = await this.prisma.message.findUniqueOrThrow({ where: { id: message.id }, include: MESSAGE_INCLUDE });

    this.chatGateway.broadcastMessage(channelId, full);
    await this.notifyMembers(channel, user.id, `${full.sender.firstName} ${full.sender.lastName}: 📎 ${full.attachment?.filename ?? 'príloha'}`);
    return full;
  }

  /** Bajty prílohy na servírovanie (obrázok inline / dokument na stiahnutie). */
  getAttachment(id: string) {
    return this.prisma.chatAttachment.findUnique({ where: { id } });
  }

  /**
   * Prepočíta členstvo v tímových kanáloch podľa aktuálnej sezóny:
   * rodičia hráčov družstva + hráči s vlastným účtom + tréneri družstva
   * (ako moderátori). Volá sa po zmene súpisiek alebo prechode na novú sezónu.
   */
  async syncCategoryChannels() {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) return { synced: 0 };

    const channels = await this.prisma.channel.findMany({
      where: { teamId: { not: null } },
    });

    let synced = 0;
    for (const channel of channels) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { seasonId: season.id, teamId: channel.teamId!, leftAt: null },
        include: { member: { include: { guardians: true } } },
      });

      const userIds = new Map<string, boolean>(); // userId -> isModerator
      for (const m of memberships) {
        if (m.member.userId) userIds.set(m.member.userId, false);
        for (const guardian of m.member.guardians) userIds.set(guardian.userId, false);
      }
      const coaches = await this.prisma.userRole.findMany({
        where: { role: 'COACH', teamId: channel.teamId },
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

    // Interný kanál pre trénerov a vedenie (všetci tréneri + vedúci + admini)
    let coachesChannel = await this.prisma.channel.findFirst({ where: { kind: 'COACHES' } });
    if (!coachesChannel) {
      coachesChannel = await this.prisma.channel.create({ data: { kind: 'COACHES', name: 'Tréneri a vedenie' } });
    }
    const staffRoles = await this.prisma.userRole.findMany({
      where: { role: { in: ['COACH', 'MANAGER', 'ADMIN'] } },
      select: { userId: true },
    });
    for (const userId of new Set(staffRoles.map((r) => r.userId))) {
      await this.prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: coachesChannel.id, userId } },
        create: { channelId: coachesChannel.id, userId, isModerator: true },
        update: { isModerator: true },
      });
      synced++;
    }

    return { channels: channels.length, synced };
  }
}
