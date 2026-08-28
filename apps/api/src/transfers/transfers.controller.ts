import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';

@Controller('transfers')
@Roles('ADMIN', 'MANAGER', 'COACH')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  /** Žiadosti na schválenie / vlastné odoslané. */
  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.transfersService.pending(user);
  }

  /** Vyhľadanie hráča v klube (na požiadanie o presun). */
  @Get('players')
  players(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.transfersService.searchPlayers(q ?? '', user);
  }

  /** Požiadať o presun hráča do družstva (mód volí schvaľovateľ). */
  @Post()
  request(@CurrentUser() user: AuthUser, @Body() body: { memberId: string; toTeamId: string }) {
    if (!body?.memberId || !body?.toTeamId) throw new BadRequestException('Chýba hráč alebo družstvo');
    return this.transfersService.request(body.memberId, body.toTeamId, user);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { mode?: 'MOVE' | 'ADD' }) {
    return this.transfersService.approve(id, body?.mode === 'ADD' ? 'ADD' : 'MOVE', user);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transfersService.reject(id, user);
  }
}
