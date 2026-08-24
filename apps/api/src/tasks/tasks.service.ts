import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isStaff } from '../auth/scope';
import type { AuthUser } from '../auth/current-user.decorator';

interface TaskInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  assigneeRole?: string | null;
}

const ASSIGN_ROLES = ['ADMIN', 'MANAGER', 'COACH'] as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Členovia s funkciou (Admin/Vedúci/Tréner) na priradenie úlohy. */
  async assignees() {
    const roles = await this.prisma.userRole.findMany({
      where: { role: { in: [...ASSIGN_ROLES] } },
      select: { userId: true, role: true, user: { select: { firstName: true, lastName: true } } },
    });
    const map = new Map<string, { userId: string; name: string; roles: string[] }>();
    for (const r of roles) {
      const entry = map.get(r.userId) ?? {
        userId: r.userId,
        name: `${r.user.lastName} ${r.user.firstName}`.trim(),
        roles: [],
      };
      if (!entry.roles.includes(r.role)) entry.roles.push(r.role);
      map.set(r.userId, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'sk'));
  }

  async list() {
    const tasks = await this.prisma.task.findMany({ orderBy: [{ done: 'asc' }, { createdAt: 'desc' }] });
    const userIds = [
      ...new Set(tasks.flatMap((t) => [t.createdById, t.assigneeUserId, t.doneById].filter((x): x is string => !!x))),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, `${u.lastName} ${u.firstName}`.trim()]));

    const withDue = tasks.filter((t) => t.dueDate);
    const noDue = tasks.filter((t) => !t.dueDate);
    // nesplnené s termínom hore (podľa termínu), potom bez termínu, splnené naposledy
    withDue.sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
    const ordered = [...withDue, ...noDue].sort((a, b) => Number(a.done) - Number(b.done));

    return ordered.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      done: t.done,
      doneAt: t.doneAt,
      doneByName: t.doneById ? nameOf.get(t.doneById) ?? null : null,
      createdByName: nameOf.get(t.createdById) ?? null,
      assigneeUserId: t.assigneeUserId,
      assigneeName: t.assigneeUserId ? nameOf.get(t.assigneeUserId) ?? null : null,
      assigneeRole: t.assigneeRole,
      createdAt: t.createdAt,
    }));
  }

  async create(input: TaskInput, user: AuthUser) {
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Zadajte názov úlohy');
    const assigneeRole =
      input.assigneeRole && ASSIGN_ROLES.includes(input.assigneeRole as never) ? input.assigneeRole : null;
    await this.prisma.task.create({
      data: {
        title,
        description: input.description?.trim() || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeUserId: input.assigneeUserId || null,
        assigneeRole: input.assigneeUserId ? null : assigneeRole,
        createdById: user.id,
      },
    });
    return { created: true };
  }

  async setDone(id: string, done: boolean, user: AuthUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Úloha neexistuje');
    return this.prisma.task.update({
      where: { id },
      data: { done, doneAt: done ? new Date() : null, doneById: done ? user.id : null },
    });
  }

  async update(id: string, input: TaskInput, user: AuthUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Úloha neexistuje');
    if (!isStaff(user) && task.createdById !== user.id) {
      throw new ForbiddenException('Úlohu môže upraviť len jej autor alebo vedenie');
    }
    const assigneeRole =
      input.assigneeRole && ASSIGN_ROLES.includes(input.assigneeRole as never) ? input.assigneeRole : null;
    return this.prisma.task.update({
      where: { id },
      data: {
        title: input.title?.trim() || task.title,
        description: input.description === undefined ? task.description : input.description?.trim() || null,
        dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate ? new Date(input.dueDate) : null,
        assigneeUserId: input.assigneeUserId !== undefined ? input.assigneeUserId || null : task.assigneeUserId,
        assigneeRole:
          input.assigneeUserId ? null : input.assigneeRole !== undefined ? assigneeRole : task.assigneeRole,
      },
    });
  }

  async remove(id: string, user: AuthUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Úloha neexistuje');
    if (!isStaff(user) && task.createdById !== user.id) {
      throw new ForbiddenException('Úlohu môže odstrániť len jej autor alebo vedenie');
    }
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }
}
