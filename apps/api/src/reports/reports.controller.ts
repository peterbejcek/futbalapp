import { BadRequestException, Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * PDF podklad pre športový príspevok. Rodič len pre svoje deti,
   * vedenie pre ľubovoľného člena.
   * Obdobie: ?from=2026-01&to=2026-12 (predvolene aktuálny kalendárny rok).
   */
  @Get('sport-allowance/:memberId')
  async sportAllowance(
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const year = new Date().getFullYear();
    const fromLabel = from ?? `${year}-01`;
    const toLabel = to ?? `${year}-12`;
    if (!/^\d{4}-\d{2}$/.test(fromLabel) || !/^\d{4}-\d{2}$/.test(toLabel)) {
      throw new BadRequestException('Obdobie zadajte vo formáte RRRR-MM');
    }

    const isStaff = user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
    if (!isStaff) {
      const guardian = await this.prisma.guardian.findUnique({
        where: { userId_memberId: { userId: user.id, memberId } },
      });
      const ownMember = await this.prisma.member.findFirst({ where: { id: memberId, userId: user.id } });
      if (!guardian && !ownMember) {
        throw new ForbiddenException('Nemáte prístup k potvrdeniu tohto člena');
      }
    }

    const pdf = await this.reportsService.sportAllowancePdf(memberId, fromLabel, toLabel);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sportovy-prispevok-${fromLabel}-${toLabel}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
