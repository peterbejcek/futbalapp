import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { ChatService } from './chat.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
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

  /** Odoslanie správy s prílohou (obrázok / dokument), voliteľne s popisom. */
  @Post('channels/:id/attachment')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  postAttachment(
    @Param('id') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body('body') body?: string,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file?.buffer) throw new BadRequestException('Chýba súbor (pole "file")');
    return this.chatService.postAttachment(channelId, user, body ?? '', file);
  }

  /** Servírovanie prílohy (neuhádnuteľné ID) — obrázok inline, dokument na stiahnutie. */
  @Public()
  @Get('attachments/:id')
  async attachment(@Param('id') id: string, @Res() res: Response) {
    const att = await this.chatService.getAttachment(id);
    if (!att) throw new NotFoundException('Príloha neexistuje');
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (!att.mimeType.startsWith('image/')) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.filename)}"`);
    }
    res.end(Buffer.from(att.data));
  }

  /** Prepočet členstva kanálov po zmene súpisiek / novej sezóne. */
  @Post('sync')
  @Roles('ADMIN', 'MANAGER')
  sync() {
    return this.chatService.syncCategoryChannels();
  }
}
