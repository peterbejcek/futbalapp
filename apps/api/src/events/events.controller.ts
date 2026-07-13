import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  createEventSchema,
  markAttendanceSchema,
  type CreateEventInput,
  type MarkAttendanceInput,
} from '@fkknv/shared';
import { EventsService } from './events.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(
    @Query('category') categoryCode?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.eventsService.list({
      categoryCode,
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'COACH')
  create(
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.create(body, user.id);
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
