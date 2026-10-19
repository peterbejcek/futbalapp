import { Body, Controller, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { MatchSyncService } from './match-sync.service';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../../auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';

const bodySchema = z.object({ url: z.string().url().optional() });

@Controller('matches')
export class MatchSyncController {
  constructor(private readonly sync: MatchSyncService) {}

  /** Skontroluje zápas proti futbalnetu a opraví rozdiely (voliteľne s odkazom na zápas). */
  @Post(':id/futbalnet-sync')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  run(@Param('id') id: string, @Body(new ZodValidationPipe(bodySchema)) body: z.infer<typeof bodySchema>, @CurrentUser() user: AuthUser) {
    return this.sync.syncManual(id, user, body.url);
  }
}
