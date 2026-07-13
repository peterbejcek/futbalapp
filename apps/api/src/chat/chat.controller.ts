import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ChatService } from './chat.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

const postMessageSchema = z.object({ body: z.string().min(1).max(4000) });

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('channels')
  channels(@CurrentUser() user: AuthUser) {
    return this.chatService.myChannels(user);
  }

  @Get('channels/:id/messages')
  messages(@Param('id') channelId: string, @CurrentUser() user: AuthUser, @Query('before') before?: string) {
    return this.chatService.messages(channelId, user, before);
  }

  @Post('channels/:id/messages')
  post(
    @Param('id') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(postMessageSchema)) body: { body: string },
  ) {
    return this.chatService.post(channelId, user, body.body);
  }

  /** Prepočet členstva kanálov po zmene súpisiek / novej sezóne. */
  @Post('sync')
  @Roles('ADMIN', 'MANAGER')
  sync() {
    return this.chatService.syncCategoryChannels();
  }
}
