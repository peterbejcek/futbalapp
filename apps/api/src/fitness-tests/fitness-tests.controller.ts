import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FitnessTestsService, type FitnessTestInput } from './fitness-tests.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';

@Controller('fitness-tests')
@Roles('ADMIN', 'MANAGER', 'COACH')
export class FitnessTestsController {
  constructor(private readonly service: FitnessTestsService) {}

  /** Previerky (vedenie všetky, tréner len hráčov svojich družstiev); voliteľne filter na hráča. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('member') memberId?: string) {
    return this.service.list(user, memberId);
  }

  @Post()
  create(@Body() body: FitnessTestInput, @CurrentUser() user: AuthUser) {
    return this.service.create(body, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: FitnessTestInput, @CurrentUser() user: AuthUser) {
    return this.service.update(id, body, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
