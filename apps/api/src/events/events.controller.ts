import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createEventSchema,
  createRecurringTrainingSchema,
  markAttendanceSchema,
  type CreateEventInput,
  type CreateRecurringTrainingInput,
  type MarkAttendanceInput,
} from '@fkknv/shared';
import { EventsService } from './events.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { canManageTeam } from '../auth/scope';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(
    @Query('category') categoryCode?: string,
    @Query('team') teamId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.eventsService.list({
      categoryCode,
      teamId,
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  create(@Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput, @CurrentUser() user: AuthUser) {
    if (!canManageTeam(user, body.teamId ?? null) && body.teamId) {
      throw new ForbiddenException('Nemôžete vytvárať udalosti pre iné družstvo');
    }
    return this.eventsService.create(body, user.id);
  }

  @Post('recurring')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  createRecurring(
    @Body(new ZodValidationPipe(createRecurringTrainingSchema)) body: CreateRecurringTrainingInput,
    @CurrentUser() user: AuthUser,
  ) {
    if (!canManageTeam(user, body.teamId)) {
      throw new ForbiddenException('Nemôžete vytvárať tréningy pre iné družstvo');
    }
    return this.eventsService.createRecurring(body, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  update(
    @Param('id') eventId: string,
    @Body(new ZodValidationPipe(createEventSchema.partial())) body: Partial<CreateEventInput>,
  ) {
    return this.eventsService.update(eventId, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  remove(@Param('id') eventId: string, @Query('scope') scope?: string) {
    return this.eventsService.remove(eventId, scope === 'future' ? 'future' : 'one');
  }

  @Get('attendance-stats')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  stats(@Query('team') teamId: string) {
    return this.eventsService.teamAttendanceStats(teamId);
  }

  @Get(':id/attendance')
  attendance(@Param('id') eventId: string) {
    return this.eventsService.attendance(eventId);
  }

  @Post(':id/attendance')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  markAttendance(
    @Param('id') eventId: string,
    @Body(new ZodValidationPipe(markAttendanceSchema)) body: MarkAttendanceInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.markAttendance(eventId, body, user.id);
  }
}
