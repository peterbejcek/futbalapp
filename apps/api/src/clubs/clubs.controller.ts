import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { Roles } from '../auth/roles.decorator';

@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  /** Zoznam klubov (súperov) s logami — pre našepkávač. */
  @Get()
  list() {
    return this.clubs.list();
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  create(@Body() body: { name: string; logoUrl?: string; sportnetDomain?: string }) {
    return this.clubs.create(body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.clubs.remove(id);
  }
}
