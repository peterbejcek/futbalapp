import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { NominationRequestsService } from './nomination-requests.service';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

const nominateSchema = z.object({
  memberId: z.string().min(1).max(64),
  note: z.string().max(500).optional(),
});
const decideSchema = z.object({ note: z.string().max(500).optional() });

/** Nominácia hráčov z iných družstiev a žiadosti o povolenie trénera hráča. */
@Controller('nomination-requests')
@Roles('COACH', 'MANAGER')
export class NominationRequestsController {
  constructor(private readonly service: NominationRequestsService) {}

  /** Čakajúce žiadosti na rozhodnutie + moje žiadosti (voliteľne len pre zápas). */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('matchId') matchId?: string) {
    return this.service.list(user, matchId || undefined);
  }

  /** Vekovo vhodní hráči z iných družstiev pre zápas. */
  @Get('match/:matchId/candidates')
  candidates(@Param('matchId') matchId: string, @CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.service.candidates(matchId, user, q);
  }

  /** Nominovať hráča z iného družstva (priamo, alebo vznikne žiadosť). */
  @Post('match/:matchId')
  nominate(
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(nominateSchema)) body: z.infer<typeof nominateSchema>,
  ) {
    return this.service.nominate(matchId, body.memberId, user, body.note);
  }

  /** Zrušiť nomináciu hráča z iného družstva (alebo jeho čakajúcu žiadosť). */
  @Delete('match/:matchId/:memberId')
  cancel(@Param('matchId') matchId: string, @Param('memberId') memberId: string, @CurrentUser() user: AuthUser) {
    return this.service.cancel(matchId, memberId, user);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(decideSchema)) body: z.infer<typeof decideSchema>,
  ) {
    return this.service.decide(id, user, true, body.note);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(decideSchema)) body: z.infer<typeof decideSchema>,
  ) {
    return this.service.decide(id, user, false, body.note);
  }
}
