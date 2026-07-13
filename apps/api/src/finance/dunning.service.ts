import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../notifications/push.service';

/**
 * Automatické upomienky pri nezaplatenom členskom.
 * Eskalácia: 1. upomienka deň po splatnosti, 2. po týždni, 3. po dvoch týždňoch.
 * Každá úroveň sa pre danú povinnosť pošle len raz (eviduje DunningNotice).
 */
const LEVEL_THRESHOLDS_DAYS: Array<{ level: number; days: number }> = [
  { level: 3, days: 15 },
  { level: 2, days: 8 },
  { level: 1, days: 1 },
];

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  /** Denne o 8:00 — upomienky sa neposielajú v noci. */
  @Cron('0 8 * * *')
  async daily() {
    const result = await this.run();
    this.logger.log(`Upomienky: ${JSON.stringify(result)}`);
  }

  async run() {
    const now = new Date();

    // 1. preklop povinnosti po splatnosti na OVERDUE
    await this.prisma.paymentObligation.updateMany({
      where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
      data: { status: 'OVERDUE' },
    });

    // 2. zisti, ktoré povinnosti potrebujú (vyššiu) upomienku
    const overdue = await this.prisma.paymentObligation.findMany({
      where: { status: 'OVERDUE' },
      include: {
        dunning: { orderBy: { level: 'desc' }, take: 1 },
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userId: true,
            guardians: { select: { userId: true } },
          },
        },
      },
    });

    // zoskupenie podľa člena — rodič dostane jednu správu za dieťa, nie za každý mesiac
    const perMember = new Map<
      string,
      { recipients: string[]; name: string; totalCents: number; periods: string[]; obligationIds: string[]; level: number }
    >();

    for (const obligation of overdue) {
      const daysOverdue = Math.floor((now.getTime() - obligation.dueDate.getTime()) / 86_400_000);
      const targetLevel = LEVEL_THRESHOLDS_DAYS.find((t) => daysOverdue >= t.days)?.level ?? 0;
      const sentLevel = obligation.dunning[0]?.level ?? 0;
      if (targetLevel <= sentLevel) continue;

      const entry = perMember.get(obligation.memberId) ?? {
        recipients: [
          ...obligation.member.guardians.map((g) => g.userId),
          ...(obligation.member.userId ? [obligation.member.userId] : []),
        ],
        name: `${obligation.member.firstName} ${obligation.member.lastName}`,
        totalCents: 0,
        periods: [],
        obligationIds: [],
        level: 0,
      };
      entry.totalCents += obligation.amountCents - obligation.paidCents;
      entry.periods.push(obligation.periodLabel);
      entry.obligationIds.push(obligation.id);
      entry.level = Math.max(entry.level, targetLevel);
      perMember.set(obligation.memberId, entry);
    }

    // 3. pošli a zaeviduj
    let notified = 0;
    for (const entry of perMember.values()) {
      const amount = (entry.totalCents / 100).toFixed(2);
      const urgency = entry.level >= 3 ? 'Posledná upomienka' : entry.level === 2 ? 'Pripomienka' : 'Upozornenie';
      await this.pushService.notifyUsers(entry.recipients, {
        title: `${urgency}: nezaplatené členské`,
        body: `${entry.name} — dlžné ${amount} € za obdobie ${entry.periods.join(', ')}. Prosíme o úhradu.`,
        data: { type: 'dunning' },
      });
      await this.prisma.dunningNotice.createMany({
        data: entry.obligationIds.map((paymentObligationId) => ({
          paymentObligationId,
          level: entry.level,
          channel: 'PUSH',
        })),
      });
      notified++;
    }

    return { overdueObligations: overdue.length, membersNotified: notified };
  }
}
