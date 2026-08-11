import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createMemberSchema, type CreateMemberInput } from '@fkknv/shared';
import { MembersService } from './members.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
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

  /** Fotka hráča (obrázok) — verejné podľa neuhádnuteľného ID. */
  @Public()
  @Get(':id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const dataUrl = await this.membersService.getPhoto(id);
    const match = dataUrl ? /^data:(.+?);base64,(.*)$/.exec(dataUrl) : null;
    if (!match) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', match[1]!);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(Buffer.from(match[2]!, 'base64'));
  }

  /** Nahranie/výmena fotky hráča. */
  @Post(':id/photo')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 * 1024 * 1024 } }))
  async uploadPhoto(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!isStaff(user) && !(await this.membersService.memberInTeams(id, coachTeamIds(user)))) {
      throw new ForbiddenException('Hráča z iného družstva nemôžete upravovať');
    }
    if (!file?.buffer) throw new BadRequestException('Chýba súbor (pole "file")');
    if (!file.mimetype?.startsWith('image/')) throw new BadRequestException('Nahrajte obrázok');
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.membersService.setPhoto(id, dataUrl);
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

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
