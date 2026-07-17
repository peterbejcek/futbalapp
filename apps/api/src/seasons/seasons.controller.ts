import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { createTeamSchema, type CreateTeamInput } from '@fkknv/shared';
import { SeasonsService } from './seasons.service';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get()
  list() {
    return this.seasonsService.list();
  }

  @Get('active')
  active() {
    return this.seasonsService.active();
  }

  @Get('categories')
  categories() {
    return this.seasonsService.categories();
  }

  @Get('teams')
  teams() {
    return this.seasonsService.teams();
  }

  @Post('teams')
  @Roles('ADMIN', 'MANAGER')
  createTeam(@Body(new ZodValidationPipe(createTeamSchema)) body: CreateTeamInput) {
    return this.seasonsService.createTeam(body.teamCategoryCode, body.name);
  }

  @Post(':id/assign-memberships')
  @Roles('ADMIN', 'MANAGER')
  assign(@Param('id') seasonId: string) {
    return this.seasonsService.assignMemberships(seasonId);
  }

  @Post(':id/memberships/override')
  @Roles('ADMIN', 'MANAGER')
  override(@Param('id') seasonId: string, @Body() body: { memberId: string; teamId: string }) {
    return this.seasonsService.overrideMembership(seasonId, body.memberId, body.teamId);
  }
}
