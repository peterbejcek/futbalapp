import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/current-user.decorator';

/**
 * Realtime chat: klient sa pripojí s JWT (handshake.auth.token),
 * emitne `join` s channelId (server overí členstvo) a odvtedy dostáva
 * udalosti `message` pre daný kanál okamžite — bez pollingu.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = (socket.handshake.auth as { token?: string }).token;
      if (!token) throw new Error('missing token');
      const payload = await this.jwtService.verifyAsync<AuthUser & { sub: string }>(token);
      socket.data.user = { id: payload.sub, email: payload.email, roles: payload.roles } satisfies AuthUser;
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { channelId: string }) {
    const user = socket.data.user as AuthUser | undefined;
    if (!user || !body?.channelId) return { ok: false };

    const channel = await this.prisma.channel.findUnique({
      where: { id: body.channelId },
      include: { members: { where: { userId: user.id } } },
    });
    if (!channel) return { ok: false };

    const staff = user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
    const allowed = staff || channel.type === 'ANNOUNCEMENT' || channel.members.length > 0;
    if (!allowed) return { ok: false };

    await socket.join(`channel:${body.channelId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: { channelId: string }) {
    if (body?.channelId) await socket.leave(`channel:${body.channelId}`);
    return { ok: true };
  }

  /** Volané z ChatService po uložení správy. */
  broadcastMessage(channelId: string, message: unknown) {
    try {
      this.server.to(`channel:${channelId}`).emit('message', message);
    } catch (error) {
      this.logger.warn(`WS broadcast zlyhal: ${error instanceof Error ? error.message : error}`);
    }
  }
}
