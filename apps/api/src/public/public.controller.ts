import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { PublicService } from './public.service';
import { documentFileHeaders } from './public.mapper';

const CACHE_60 = 'public, max-age=60';

/**
 * Verejné read-only API pre klubový web (bez prihlásenia). Vracia výlučne
 * polia z kontraktu `@fkknv/shared` public-api.ts; rate-limit len na tomto controlleri.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('teams')
  @Header('Cache-Control', CACHE_60)
  teams() {
    return this.publicService.teams();
  }

  @Get('teams/:id/squad')
  @Header('Cache-Control', CACHE_60)
  squad(@Param('id') id: string) {
    return this.publicService.squad(id);
  }

  @Get('events')
  @Header('Cache-Control', CACHE_60)
  events(
    @Query('categoryCode') categoryCode?: string,
    @Query('teamId') teamId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicService.events({
      categoryCode: typeof categoryCode === 'string' ? categoryCode : undefined,
      teamId: typeof teamId === 'string' ? teamId : undefined,
      type: typeof type === 'string' ? type : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      limit: typeof limit === 'string' ? limit : undefined,
    });
  }

  @Get('events/:id')
  @Header('Cache-Control', CACHE_60)
  event(@Param('id') id: string) {
    return this.publicService.event(id);
  }

  @Get('players/:id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.publicService.playerPhoto(id);
    if (!photo) {
      res.status(404).setHeader('Cache-Control', 'no-store');
      res.end();
      return;
    }
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Content-Length', String(photo.buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(photo.buffer);
  }

  @Get('articles')
  @Header('Cache-Control', CACHE_60)
  articles(@Query('limit') limit?: string) {
    return this.publicService.articles(typeof limit === 'string' ? limit : undefined);
  }

  @Get('articles/:slug')
  @Header('Cache-Control', CACHE_60)
  article(@Param('slug') slug: string) {
    return this.publicService.article(slug);
  }

  @Get('pages')
  @Header('Cache-Control', CACHE_60)
  pages() {
    return this.publicService.pages();
  }

  @Get('pages/:slug')
  @Header('Cache-Control', CACHE_60)
  page(@Param('slug') slug: string) {
    return this.publicService.page(slug);
  }

  @Get('people')
  @Header('Cache-Control', CACHE_60)
  people() {
    return this.publicService.people();
  }

  @Get('documents')
  @Header('Cache-Control', CACHE_60)
  documents(@Query('category') category?: string) {
    return this.publicService.documents(typeof category === 'string' ? category : undefined);
  }

  @Get('documents/:id/file')
  async documentFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.publicService.documentFile(id);
    if (!file) {
      res.status(404).setHeader('Cache-Control', 'no-store');
      res.end();
      return;
    }
    const headers = documentFileHeaders({ ...file, size: file.buffer.length });
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(file.buffer);
  }
}
