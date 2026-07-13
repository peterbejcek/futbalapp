import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { FinanceService, type BankRow } from './finance.service';
import { DunningService } from './dunning.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

const createFeePlanSchema = z.object({
  seasonId: z.string(),
  teamCategoryCode: z.string().optional(),
  name: z.string().min(2),
  amountCents: z.number().int().positive(),
  period: z.enum(['MONTHLY', 'QUARTERLY', 'ONE_TIME', 'SEASON']),
  dueDay: z.number().int().min(1).max(28).optional(),
});

const bankImportSchema = z.object({
  rows: z.array(
    z.object({
      externalId: z.string().min(1),
      date: z.string(),
      amountCents: z.number().int(),
      variableSymbol: z.string().optional(),
      counterpartyIban: z.string().optional(),
      counterpartyName: z.string().optional(),
      message: z.string().optional(),
    }),
  ),
});

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly dunningService: DunningService,
    private readonly prisma: PrismaService,
  ) {}

  /** Manuálne spustenie upomienok (inak bežia denne o 8:00). */
  @Post('dunning/run')
  @Roles('ADMIN', 'MANAGER')
  runDunning() {
    return this.dunningService.run();
  }

  @Get('fee-plans')
  @Roles('ADMIN', 'MANAGER')
  listFeePlans() {
    return this.financeService.listFeePlans();
  }

  @Post('fee-plans')
  @Roles('ADMIN', 'MANAGER')
  createFeePlan(@Body(new ZodValidationPipe(createFeePlanSchema)) body: z.infer<typeof createFeePlanSchema>) {
    return this.financeService.createFeePlan(body);
  }

  @Post('obligations/generate')
  @Roles('ADMIN', 'MANAGER')
  generate(@Body() body: { year: number; month: number }) {
    if (!body?.year || !body?.month) throw new BadRequestException('Chýba rok/mesiac');
    return this.financeService.generateObligations(body.year, body.month);
  }

  @Post('bank/import')
  @Roles('ADMIN', 'MANAGER')
  importBank(@Body(new ZodValidationPipe(bankImportSchema)) body: { rows: BankRow[] }) {
    return this.financeService.importBankTransactions(body.rows);
  }

  @Post('bank/match')
  @Roles('ADMIN', 'MANAGER')
  autoMatch() {
    return this.financeService.autoMatch();
  }

  @Get('debtors')
  @Roles('ADMIN', 'MANAGER')
  debtors() {
    return this.financeService.debtors();
  }

  /** Rodič vidí platby len svojich detí; vedenie ľubovoľného člena. */
  @Get('members/:memberId/payments')
  async memberPayments(
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const isStaff = user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
    if (!isStaff) {
      const guardian = await this.prisma.guardian.findUnique({
        where: { userId_memberId: { userId: user.id, memberId } },
      });
      const ownMember = await this.prisma.member.findFirst({ where: { id: memberId, userId: user.id } });
      if (!guardian && !ownMember) throw new ForbiddenException('Nemáte prístup k platbám tohto člena');
    }
    return this.financeService.memberPayments(memberId, from, to);
  }
}
