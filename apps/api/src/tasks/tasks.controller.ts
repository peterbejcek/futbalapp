import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';

interface TaskBody {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  assigneeRole?: string | null;
}

@Controller('tasks')
@Roles('ADMIN', 'MANAGER', 'COACH')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tasksService.list(user);
  }

  @Get('assignees')
  assignees() {
    return this.tasksService.assignees();
  }

  @Get(':id/comments')
  comments(@Param('id') id: string) {
    return this.tasksService.listComments(id);
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() body: { body: string }, @CurrentUser() user: AuthUser) {
    return this.tasksService.addComment(id, body?.body ?? '', user);
  }

  @Post()
  create(@Body() body: TaskBody, @CurrentUser() user: AuthUser) {
    return this.tasksService.create(body, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: TaskBody, @CurrentUser() user: AuthUser) {
    return this.tasksService.update(id, body, user);
  }

  @Post(':id/done')
  setDone(@Param('id') id: string, @Body() body: { done: boolean }, @CurrentUser() user: AuthUser) {
    return this.tasksService.setDone(id, body?.done ?? true, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasksService.remove(id, user);
  }
}
