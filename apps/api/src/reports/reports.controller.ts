import { BadRequestException, Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExcelService } from './excel.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendXlsx(res: Response, buffer: Buffer, filename: string) {
  res.set({
    'Content-Type': XLSX_TYPE,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
  });
  res.send(buffer);
}

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly excelService: ExcelService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('export/members')
  @Roles('ADMIN', 'MANAGER')
  async membersExport(@Res() res: Response, @Query('category') category?: string) {
    const buffer = await this.excelService.membersXlsx(category);
    sendXlsx(res, buffer, `clenovia${category ? `-${category}` : ''}.xlsx`);
  }

  @Get('export/payments')
  @Roles('ADMIN', 'MANAGER')
  async paymentsExport(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const year = new Date().getFullYear();
    const fromLabel = from ?? `${year}-01`;
    const toLabel = to ?? `${year}-12`;
    if (!/^\d{4}-\d{2}$/.test(fromLabel) || !/^\d{4}-\d{2}$/.test(toLabel)) {
      throw new BadRequestException('Obdobie zadajte vo formáte RRRR-MM');
    }
    const buffer = await this.excelService.paymentsXlsx(fromLabel, toLabel);
    sendXlsx(res, buffer, `platby-${fromLabel}-${toLabel}.xlsx`);
  }

  @Get('export/attendance')
  @Roles('ADMIN', 'MANAGER', 'COACH')
  async attendanceExport(
    @Res() res: Response,
    @Query('category') category: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!category) throw new BadRequestException('Chýba parameter category');
    const buffer = await this.excelService.attendanceXlsx(
      category,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    sendXlsx(res, buffer, `dochadzka-${category}.xlsx`);
  }

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
