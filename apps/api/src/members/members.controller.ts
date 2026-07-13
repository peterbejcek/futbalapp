import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { createMemberSchema, type CreateMemberInput } from '@fkknv/shared';
import { MembersService } from './members.service';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  list(
    @Query('category') categoryCode?: string,
    @Query('season') seasonId?: string,
    @Query('status') status?: string,
  ) {
    return this.membersService.list({ categoryCode, seasonId, status });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  get(@Param('id') id: string) {
    return this.membersService.get(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body(new ZodValidationPipe(createMemberSchema)) body: CreateMemberInput) {
    return this.membersService.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createMemberSchema.partial())) body: Partial<CreateMemberInput>,
  ) {
    return this.membersService.update(id, body);
  }
}
