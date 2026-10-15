import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { createPitchSchema, type CreatePitchInput } from '@fkknv/shared';
import { PitchesService } from './pitches.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('pitches')
export class PitchesController {
  constructor(private readonly pitches: PitchesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  list() {
    return this.pitches.list();
  }

  @Get('occupancy')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  occupancy(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.pitches.occupancy(from ? new Date(from) : undefined, to ? new Date(to) : undefined, !!user.isDemo);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body(new ZodValidationPipe(createPitchSchema)) body: CreatePitchInput) {
    return this.pitches.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(createPitchSchema.partial())) body: Partial<CreatePitchInput>) {
    return this.pitches.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.pitches.remove(id);
  }
}
