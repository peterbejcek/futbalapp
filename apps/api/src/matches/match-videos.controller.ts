import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { MatchVideosService } from './match-videos.service';
import { maxVideoBytes, videoDiskStorage, videoFileFilter } from './video-storage';

interface UploadedVideoFile {
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Videá zo zápasu nahrané z telefónu (súbory na disku v UPLOADS_DIR). */
@Controller('matches')
export class MatchVideosController {
  constructor(private readonly videos: MatchVideosService) {}

  /** Zoznam videí zápasu. */
  @Get(':id/videos')
  list(@Param('id') matchId: string, @CurrentUser() user: AuthUser) {
    return this.videos.list(matchId, user);
  }

  /** Nahrať video (multipart, pole "file", voliteľne "title"); streamuje sa priamo na disk. */
  @Post(':id/videos')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: videoDiskStorage,
      fileFilter: videoFileFilter,
      limits: { fileSize: maxVideoBytes(), files: 1 },
    }),
  )
  upload(
    @Param('id') matchId: string,
    @CurrentUser() user: AuthUser,
    @Body('title') title?: string,
    @UploadedFile() file?: UploadedVideoFile,
  ) {
    if (!file?.path) throw new BadRequestException('Chýba súbor (pole "file")');
    return this.videos.add(matchId, file, typeof title === 'string' ? title : undefined, user);
  }

  /**
   * Prehrávanie videa (neuhádnuteľné ID, verejné ako fotky — <video> neposiela Authorization).
   * res.sendFile podporuje Range/206, If-Range, ETag aj HEAD → seekovanie na mobile.
   */
  @Public()
  @Get('videos/:videoId')
  async stream(@Param('videoId') videoId: string, @Res() res: Response) {
    const video = await this.videos.getForStream(videoId);
    if (!video) throw new NotFoundException('Video neexistuje');
    res.setHeader('Content-Type', video.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(
      this.videos.filePath(video.storagePath),
      { acceptRanges: true, cacheControl: false, lastModified: true, dotfiles: 'deny' },
      (err?: Error & { code?: string; status?: number }) => {
        if (!err) return;
        if (res.headersSent) return; // prerušené prehrávanie/seek — ignorovať
        const notFound = err.code === 'ENOENT' || err.status === 404;
        res.status(notFound ? 404 : (err.status ?? 500)).json({
          statusCode: notFound ? 404 : (err.status ?? 500),
          message: notFound ? 'Súbor videa sa nenašiel' : 'Chyba pri čítaní videa',
        });
      },
    );
  }

  @Delete(':id/videos/:videoId')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  remove(@Param('id') matchId: string, @Param('videoId') videoId: string, @CurrentUser() user: AuthUser) {
    return this.videos.delete(matchId, videoId, user);
  }
}
