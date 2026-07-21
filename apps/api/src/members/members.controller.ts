import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMemberSchema, type CreateMemberInput } from '@fkknv/shared';
import { MembersService } from './members.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { coachTeamIds, isStaff } from '../auth/scope';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  list(
    @CurrentUser() user: AuthUser,
    @Query('category') categoryCode?: string,
    @Query('team') teamId?: string,
    @Query('season') seasonId?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('hideInactive') hideInactive?: string,
  ) {
    // tréner vidí len hráčov svojich družstiev
    const teamIds = isStaff(user) ? undefined : coachTeamIds(user);
    return this.membersService.list({
      categoryCode,
      teamId,
      teamIds,
      seasonId,
      status,
      role,
      hideInactive: hideInactive === 'true',
    });
  }

  /** Platnosť registračných preukazov (scope podľa roly) — pre dashboard. */
  @Get('registration-cards')
  @Roles('ADMIN', 'MANAGER', 'COACH', 'PLAYER', 'PARENT')
  registrationCards(@CurrentUser() user: AuthUser) {
    return this.membersService.registrationCards(user);
  }

  /** Import hráčov z Excelu (idempotentný upsert podľa reg. čísla / mena+dátumu). */
  @Post('import')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  importRoster(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer) throw new BadRequestException('Chýba súbor (pole "file")');
    return this.membersService.importRoster(file.buffer);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (!isStaff(user) && !(await this.membersService.memberInTeams(id, coachTeamIds(user)))) {
      throw new ForbiddenException('Hráč nie je vo vašom družstve');
    }
    return this.membersService.get(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(
    @Body(new ZodValidationPipe(createMemberSchema)) body: CreateMemberInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membersService.create(body, user.roles.map((r) => r.role));
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createMemberSchema.partial())) body: Partial<CreateMemberInput>,
  ) {
    if (!isStaff(user) && !(await this.membersService.memberInTeams(id, coachTeamIds(user)))) {
      throw new ForbiddenException('Hráča z iného družstva nemôžete upravovať');
    }
    return this.membersService.update(id, body, user.roles.map((r) => r.role));
  }
}
