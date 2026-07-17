import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateVariableSymbol, periodLabel } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface BankRow {
  externalId: string;
  date: string; // ISO
  amountCents: number;
  variableSymbol?: string;
  counterpartyIban?: string;
  counterpartyName?: string;
  message?: string;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  listFeePlans() {
    return this.prisma.feePlan.findMany({
      include: { teamCategory: true, season: true, assignments: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createFeePlan(input: {
    seasonId: string;
    teamCategoryCode?: string;
    name: string;
    amountCents: number;
    period: 'MONTHLY' | 'QUARTERLY' | 'ONE_TIME' | 'SEASON';
    dueDay?: number;
  }) {
    const season = await this.prisma.season.findUnique({ where: { id: input.seasonId } });
    if (!season) throw new NotFoundException('Sezóna neexistuje');
    const category = input.teamCategoryCode
      ? await this.prisma.teamCategory.findUnique({ where: { code: input.teamCategoryCode } })
      : null;

    const plan = await this.prisma.feePlan.create({
      data: {
        seasonId: season.id,
        teamCategoryId: category?.id,
        name: input.name,
        amountCents: input.amountCents,
        period: input.period,
        dueDay: input.dueDay ?? 15,
        activeFrom: season.startDate,
        activeTo: season.endDate,
      },
    });

    // Automaticky priradí predpis všetkým aktívnym členom kategórie (resp. celého klubu)
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        seasonId: season.id,
        leftAt: null,
        team: category ? { teamCategoryId: category.id } : undefined,
        member: { status: 'ACTIVE' },
      },
    });
    if (memberships.length > 0) {
      await this.prisma.feeAssignment.createMany({
        data: memberships.map((m) => ({ feePlanId: plan.id, memberId: m.memberId })),
        skipDuplicates: true,
      });
    }
    return this.prisma.feePlan.findUnique({
      where: { id: plan.id },
      include: { assignments: { select: { id: true } } },
    });
  }

  /**
   * Vygeneruje platobné povinnosti pre daný mesiac zo všetkých aktívnych
   * mesačných predpisov. Idempotentné — existujúce povinnosti sa preskočia.
   */
  async generateObligations(year: number, month: number) {
    if (month < 1 || month > 12) throw new BadRequestException('Neplatný mesiac');
    const assignments = await this.prisma.feeAssignment.findMany({
      where: { active: true, feePlan: { period: 'MONTHLY' } },
      include: { feePlan: true, member: { select: { memberSeq: true } } },
    });

    const label = periodLabel(year, month);
    let created = 0;
    for (const assignment of assignments) {
      const amount = assignment.overrideCents ?? assignment.feePlan.amountCents;
      const dueDate = new Date(Date.UTC(year, month - 1, assignment.feePlan.dueDay));
      try {
        await this.prisma.paymentObligation.create({
          data: {
            feeAssignmentId: assignment.id,
            memberId: assignment.memberId,
            periodLabel: label,
            amountCents: amount,
            variableSymbol: generateVariableSymbol(assignment.member.memberSeq, { year, month }),
            dueDate,
          },
        });
        created++;
      } catch {
        // unique constraint (feeAssignmentId, periodLabel) — už vygenerované
      }
    }
    return { period: label, created, total: assignments.length };
  }

  /** Import bankových pohybov (z CSV/CAMT parsera alebo API) + automatické párovanie. */
  async importBankTransactions(rows: BankRow[]) {
    let imported = 0;
    for (const row of rows) {
      try {
        await this.prisma.bankTransaction.create({
          data: {
            source: 'CSV',
            externalId: row.externalId,
            date: new Date(row.date),
            amountCents: row.amountCents,
            variableSymbol: row.variableSymbol,
            counterpartyIban: row.counterpartyIban,
            counterpartyName: row.counterpartyName,
            message: row.message,
          },
        });
        imported++;
      } catch {
        // duplicitný externalId — pohyb už bol importovaný
      }
    }
    const matched = await this.autoMatch();
    return { imported, ...matched };
  }

  /**
   * Automatické párovanie: pohyb s VS sa páruje na nezaplatené povinnosti
   * člena (podľa VS), od najstaršej. Jeden pohyb môže pokryť viac povinností
   * (rodič platí viac mesiacov naraz).
   */
  async autoMatch() {
    const unmatched = await this.prisma.bankTransaction.findMany({
      where: { matchStatus: 'UNMATCHED', amountCents: { gt: 0 }, variableSymbol: { not: null } },
    });

    let matchedCount = 0;
    for (const tx of unmatched) {
      // 1. presná zhoda VS
      let obligations = await this.prisma.paymentObligation.findMany({
        where: { variableSymbol: tx.variableSymbol!, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
      });
      // 2. fallback: VS patrí členovi (rovnaké posledné 6-číslie) → všetky jeho dlhy
      if (obligations.length === 0 && /^\d{10}$/.test(tx.variableSymbol!)) {
        const memberSeq = Number(tx.variableSymbol!.slice(4));
        const member = await this.prisma.member.findUnique({ where: { memberSeq } });
        if (member) {
          obligations = await this.prisma.paymentObligation.findMany({
            where: { memberId: member.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
            orderBy: { dueDate: 'asc' },
          });
        }
      }
      if (obligations.length === 0) continue;

      let remaining = tx.amountCents;
      for (const obligation of obligations) {
        if (remaining <= 0) break;
        const open = obligation.amountCents - obligation.paidCents;
        const applied = Math.min(open, remaining);
        if (applied <= 0) continue;
        await this.prisma.$transaction([
          this.prisma.paymentMatch.create({
            data: {
              bankTransactionId: tx.id,
              paymentObligationId: obligation.id,
              amountCents: applied,
              matchedBy: 'AUTO',
            },
          }),
          this.prisma.paymentObligation.update({
            where: { id: obligation.id },
            data: {
              paidCents: obligation.paidCents + applied,
              status: obligation.paidCents + applied >= obligation.amountCents ? 'PAID' : 'PARTIAL',
            },
          }),
        ]);
        remaining -= applied;
      }
      await this.prisma.bankTransaction.update({
        where: { id: tx.id },
        data: { matchStatus: remaining < tx.amountCents ? 'MATCHED' : 'UNMATCHED' },
      });
      if (remaining < tx.amountCents) matchedCount++;
    }
    return { matchedTransactions: matchedCount };
  }

  /** Prehľad dlžníkov: povinnosti po splatnosti, zoskupené po členoch. */
  async debtors() {
    await this.prisma.paymentObligation.updateMany({
      where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    const overdue = await this.prisma.paymentObligation.findMany({
      where: { status: 'OVERDUE' },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            guardians: { include: { user: { select: { email: true, phone: true } } } },
            memberships: {
              where: { leftAt: null, season: { isActive: true } },
              include: { team: { include: { teamCategory: { select: { code: true } } } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const byMember = new Map<string, { member: unknown; owedCents: number; periods: string[] }>();
    for (const o of overdue) {
      const entry = byMember.get(o.memberId) ?? { member: o.member, owedCents: 0, periods: [] };
      entry.owedCents += o.amountCents - o.paidCents;
      entry.periods.push(o.periodLabel);
      byMember.set(o.memberId, entry);
    }
    return [...byMember.values()].sort((a, b) => b.owedCents - a.owedCents);
  }

  /** Stav platieb člena — pre rodiča aj podklad pre športový príspevok. */
  memberPayments(memberId: string, fromLabel?: string, toLabel?: string) {
    return this.prisma.paymentObligation.findMany({
      where: {
        memberId,
        periodLabel: { gte: fromLabel, lte: toLabel },
      },
      include: { matches: { include: { bankTransaction: { select: { date: true } } } } },
      orderBy: { periodLabel: 'asc' },
    });
  }
}
