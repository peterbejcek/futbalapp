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
  stats(@Query('category') categoryCode: string) {
    return this.matchesService.playerStats(categoryCode);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.matchesService.get(id);
  }

  @Post(':id/nominations')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  nominate(@Param('id') matchId: string, @Body() body: { memberId: string }) {
    return this.matchesService.nominate(matchId, body.memberId);
  }

  @Delete(':id/nominations/:memberId')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  removeNomination(@Param('id') matchId: string, @Param('memberId') memberId: string) {
    return this.matchesService.removeNomination(matchId, memberId);
  }

  @Post(':id/state')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  setState(
    @Param('id') matchId: string,
    @Body() body: { state: 'PLANNED' | 'LIVE' | 'FINISHED' | 'CANCELLED' },
  ) {
    return this.matchesService.setState(matchId, body.state);
  }

  @Post(':id/events')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  addEvent(
    @Param('id') matchId: string,
    @Body(new ZodValidationPipe(matchEventSchema)) body: MatchEventInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matchesService.addMatchEvent(matchId, body, user.id);
  }

  @Delete(':id/events/:eventId')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  deleteEvent(@Param('id') matchId: string, @Param('eventId') eventId: string) {
    return this.matchesService.deleteMatchEvent(matchId, eventId);
  }
}
