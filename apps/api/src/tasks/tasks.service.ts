import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { PushService } from '../notifications/push.service';
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
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', MANAGER: 'Vedúci klubu', COACH: 'Tréneri' };
const isAdmin = (user: AuthUser) => user.roles.some((r) => r.role === 'ADMIN');

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly push: PushService,
  ) {}

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

  async list(user: AuthUser) {
    const tasks = await this.prisma.task.findMany({
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { comments: true } } },
    });
    const userIds = [
      ...new Set(tasks.flatMap((t) => [t.createdById, t.assigneeUserId, t.doneById].filter((x): x is string => !!x))),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, `${u.lastName} ${u.firstName}`.trim()]));
    const admin = isAdmin(user);

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
      commentCount: t._count.comments,
      // splniť môže len zadávateľ; odstrániť admin alebo zadávateľ
      canComplete: t.createdById === user.id,
      canDelete: admin || t.createdById === user.id,
    }));
  }

  async listComments(taskId: string) {
    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(comments.map((c) => c.userId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, `${u.lastName} ${u.firstName}`.trim()]));
    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: nameOf.get(c.userId) ?? '—',
      createdAt: c.createdAt,
    }));
  }

  async addComment(taskId: string, body: string, user: AuthUser) {
    const text = body?.trim();
    if (!text) throw new BadRequestException('Zadajte text komentára');
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Úloha neexistuje');
    await this.prisma.taskComment.create({ data: { taskId, userId: user.id, body: text.slice(0, 4000) } });
    return { created: true };
  }

  async create(input: TaskInput, user: AuthUser) {
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Zadajte názov úlohy');
    const assigneeRole =
      input.assigneeRole && ASSIGN_ROLES.includes(input.assigneeRole as never) ? input.assigneeRole : null;
    const task = await this.prisma.task.create({
      data: {
        title,
        description: input.description?.trim() || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeUserId: input.assigneeUserId || null,
        assigneeRole: input.assigneeUserId ? null : assigneeRole,
        createdById: user.id,
      },
    });
    // notifikácia e-mailom tomu, kto má úlohu splniť (nezablokuje vytvorenie pri chybe)
    this.notifyAssignees(task, user.id).catch((e) =>
      this.logger.warn(`Notifikácia úlohy zlyhala: ${e instanceof Error ? e.message : e}`),
    );
    return { created: true };
  }

  /** Odošle e-mail o novej úlohe priradenému členovi, alebo všetkým s danou funkciou. */
  private async notifyAssignees(
    task: { id: string; title: string; description: string | null; dueDate: Date | null; assigneeUserId: string | null; assigneeRole: string | null },
    createdById: string,
  ) {
    let userIds: string[] = [];
    let target = '';
    if (task.assigneeUserId) {
      userIds = [task.assigneeUserId];
      const u = await this.prisma.user.findUnique({
        where: { id: task.assigneeUserId },
        select: { firstName: true, lastName: true },
      });
      target = u ? `${u.firstName} ${u.lastName}`.trim() : '';
    } else if (task.assigneeRole) {
      const roles = await this.prisma.userRole.findMany({
        where: { role: task.assigneeRole as never },
        select: { userId: true },
      });
      userIds = [...new Set(roles.map((r) => r.userId))];
      target = ROLE_LABELS[task.assigneeRole] ?? task.assigneeRole;
    }
    if (userIds.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    });
    const recipients = [...new Set(users.map((u) => u.email).filter((e): e is string => !!e))];

    // push notifikácia do aplikácie
    void this.push.notifyUsers(userIds, {
      title: 'Nová úloha',
      body: target ? `${task.title} — ${target}` : task.title,
      data: { type: 'task' },
    });

    if (recipients.length === 0) return;

    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { firstName: true, lastName: true },
    });
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : 'vedenie';
    const due = task.dueDate
      ? task.dueDate.toLocaleDateString('sk-SK', { timeZone: 'UTC' })
      : null;

    const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#16223c">
        <h2 style="color:#1a2848">Nová úloha${target ? ` pre: ${esc(target)}` : ''}</h2>
        <p style="font-size:16px;font-weight:bold">${esc(task.title)}</p>
        ${task.description ? `<p style="white-space:pre-wrap">${esc(task.description)}</p>` : ''}
        ${due ? `<p><strong>Termín:</strong> ${due}</p>` : ''}
        <p style="color:#6b7280">Zadal: ${esc(creatorName)}</p>
        <p><a href="https://fkknv.sk/portal/ulohy" style="color:#2b4278">Otvoriť úlohy v portáli →</a></p>
      </div>`;
    await this.email.send(recipients, `Nová úloha: ${task.title}`, html);
  }

  async setDone(id: string, done: boolean, user: AuthUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Úloha neexistuje');
    if (task.createdById !== user.id) {
      throw new ForbiddenException('Úlohu môže označiť za splnenú len jej zadávateľ');
    }
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
    if (!isAdmin(user) && task.createdById !== user.id) {
      throw new ForbiddenException('Úlohu môže odstrániť len admin alebo jej zadávateľ');
    }
    await this.prisma.task.delete({ where: { id } });
    return { deleted: true };
  }
}
