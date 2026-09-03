import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { matchEventSchema, type MatchEventInput } from '@fkknv/shared';
import { MatchesService } from './matches.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('stats')
  stats(@Query('category') categoryCode?: string, @Query('team') teamId?: string) {
    return this.matchesService.playerStats({ categoryCode, teamId });
  }

  /** Moje (a detí) nominácie na potvrdenie účasti (U17/U19/Muži). */
  @Get('my/nominations')
  myNominations(@CurrentUser() user: AuthUser) {
    return this.matchesService.myNominations(user.id);
  }

  /** Zápasy, na ktoré je prihlásený (alebo jeho deti) nominovaný — pre kalendár/dashboard. */
  @Get('my/nominated')
  myNominated(@CurrentUser() user: AuthUser) {
    return this.matchesService.myNominatedMatches(user.id);
  }

  /** Hráč/rodič potvrdí alebo odmietne účasť na zápase. */
  @Post('nominations/:nominationId/respond')
  respond(
    @Param('nominationId') nominationId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { status: 'CONFIRMED' | 'DECLINED' },
  ) {
    return this.matchesService.respondNomination(nominationId, user.id, body.status);
  }

  /** Doteraz zadaní súperi pre našepkávač. */
  @Get('opponents')
  opponents() {
    return this.matchesService.opponents();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.matchesService.get(id);
  }

  @Post(':id/nominations')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  nominate(@Param('id') matchId: string, @Body() body: { memberId: string }, @CurrentUser() user: AuthUser) {
    return this.matchesService.nominate(matchId, body.memberId, user);
  }

  @Delete(':id/nominations/:memberId')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  removeNomination(@Param('id') matchId: string, @Param('memberId') memberId: string, @CurrentUser() user: AuthUser) {
    return this.matchesService.removeNomination(matchId, memberId, user);
  }

  /** Rozposlať oznam o nominácii e-mailom hráčom/rodičom. */
  @Post(':id/notify-nomination')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  notifyNomination(@Param('id') matchId: string, @CurrentUser() user: AuthUser) {
    return this.matchesService.emailNomination(matchId, user);
  }

  @Post(':id/score')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  setScore(
    @Param('id') matchId: string,
    @Body() body: { scoreUs: number; scoreThem: number },
    @CurrentUser() user: AuthUser,
  ) {
    return this.matchesService.setScore(matchId, body.scoreUs, body.scoreThem, user);
  }

  @Post(':id/state')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  setState(
    @Param('id') matchId: string,
    @Body() body: { state: 'PLANNED' | 'LIVE' | 'FINISHED' | 'CANCELLED' },
    @CurrentUser() user: AuthUser,
  ) {
    return this.matchesService.setState(matchId, body.state, user);
  }

  @Post(':id/events')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  addEvent(
    @Param('id') matchId: string,
    @Body(new ZodValidationPipe(matchEventSchema)) body: MatchEventInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matchesService.addMatchEvent(matchId, body, user);
  }

  @Delete(':id/events/:eventId')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  deleteEvent(@Param('id') matchId: string, @Param('eventId') eventId: string, @CurrentUser() user: AuthUser) {
    return this.matchesService.deleteMatchEvent(matchId, eventId, user);
  }
}
