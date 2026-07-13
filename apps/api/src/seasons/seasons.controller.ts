import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SeasonsService } from './seasons.service';
import { Roles } from '../auth/roles.decorator';

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

  @Post(':id/assign-memberships')
  @Roles('ADMIN', 'MANAGER')
  assign(@Param('id') seasonId: string) {
    return this.seasonsService.assignMemberships(seasonId);
  }

  @Post(':id/memberships/override')
  @Roles('ADMIN', 'MANAGER')
  override(
    @Param('id') seasonId: string,
    @Body() body: { memberId: string; teamCategoryCode: string },
  ) {
    return this.seasonsService.overrideMembership(seasonId, body.memberId, body.teamCategoryCode);
  }
}
