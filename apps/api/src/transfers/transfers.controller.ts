import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  /** Žiadosti na schválenie, ktoré používateľ vidí. */
  @Get('pending')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  pending(@CurrentUser() user: AuthUser) {
    return this.transfersService.pending(user);
  }

  /** Požiadať o presun / priamo presunúť hráča do družstva. */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  request(
    @CurrentUser() user: AuthUser,
    @Body() body: { memberId: string; toTeamId: string; mode?: 'MOVE' | 'ADD' },
  ) {
    if (!body?.memberId || !body?.toTeamId) throw new BadRequestException('Chýba hráč alebo družstvo');
    return this.transfersService.request(body.memberId, body.toTeamId, body.mode === 'ADD' ? 'ADD' : 'MOVE', user);
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transfersService.approve(id, user);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transfersService.reject(id, user);
  }
}
