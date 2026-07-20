import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4A25' } },
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.style = { ...cell.style, ...HEADER_STYLE };
  });
}

@Injectable()
export class ExcelService {
  constructor(private readonly prisma: PrismaService) {}

  /** Adresár členov (voliteľne jednej kategórie) s kontaktmi na rodičov. */
  async membersXlsx(categoryCode?: string): Promise<Buffer> {
    const members = await this.prisma.member.findMany({
      where: categoryCode
        ? {
            memberships: {
              some: { leftAt: null, season: { isActive: true }, team: { teamCategory: { code: categoryCode } } },
            },
          }
        : undefined,
      include: {
        memberships: {
          where: { leftAt: null, season: { isActive: true } },
          include: { team: { include: { teamCategory: true } } },
        },
        guardians: { include: { user: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(categoryCode ? `Členovia ${categoryCode}` : 'Členovia');
    sheet.columns = [
      { header: 'Priezvisko', key: 'lastName', width: 18 },
      { header: 'Meno', key: 'firstName', width: 15 },
      { header: 'Dátum narodenia', key: 'birthDate', width: 16 },
      { header: 'Kategória', key: 'category', width: 10 },
      { header: 'Stav', key: 'status', width: 10 },
      { header: 'Rodič', key: 'guardian', width: 24 },
      { header: 'E-mail rodiča', key: 'email', width: 28 },
      { header: 'Telefón rodiča', key: 'phone', width: 16 },
    ];
    for (const member of members) {
      const guardian = member.guardians[0]?.user;
      sheet.addRow({
        lastName: member.lastName,
        firstName: member.firstName,
        birthDate: member.birthDate ? member.birthDate.toLocaleDateString('sk-SK', { timeZone: 'UTC' }) : '',
        category: member.memberships[0]?.team.teamCategory.code ?? '',
        status: member.status,
        guardian: guardian ? `${guardian.firstName} ${guardian.lastName}` : '',
        email: guardian?.email ?? '',
        phone: guardian?.phone ?? '',
      });
    }
    styleHeader(sheet);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Platby za obdobie: každá povinnosť s uhradenou sumou a stavom. */
  async paymentsXlsx(fromLabel: string, toLabel: string): Promise<Buffer> {
    const obligations = await this.prisma.paymentObligation.findMany({
      where: { periodLabel: { gte: fromLabel, lte: toLabel } },
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            memberships: {
              where: { leftAt: null, season: { isActive: true } },
              include: { team: { include: { teamCategory: { select: { code: true } } } } },
            },
          },
        },
        matches: { include: { bankTransaction: { select: { date: true } } } },
      },
      orderBy: [{ periodLabel: 'asc' }, { member: { lastName: 'asc' } }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Platby');
    sheet.columns = [
      { header: 'Obdobie', key: 'period', width: 10 },
      { header: 'Hráč', key: 'name', width: 24 },
      { header: 'Kategória', key: 'category', width: 10 },
      { header: 'VS', key: 'vs', width: 14 },
      { header: 'Predpis €', key: 'amount', width: 12 },
      { header: 'Uhradené €', key: 'paid', width: 12 },
      { header: 'Stav', key: 'status', width: 12 },
      { header: 'Splatnosť', key: 'due', width: 12 },
      { header: 'Dátum úhrady', key: 'paidAt', width: 14 },
    ];
    for (const o of obligations) {
      sheet.addRow({
        period: o.periodLabel,
        name: `${o.member.lastName} ${o.member.firstName}`,
        category: o.member.memberships[0]?.team.teamCategory.code ?? '',
        vs: o.variableSymbol,
        amount: o.amountCents / 100,
        paid: o.paidCents / 100,
        status: o.status,
        due: o.dueDate.toLocaleDateString('sk-SK', { timeZone: 'UTC' }),
        paidAt: o.matches[0]?.bankTransaction.date.toLocaleDateString('sk-SK', { timeZone: 'UTC' }) ?? '',
      });
    }
    // súčtový riadok
    const totalRow = sheet.addRow({
      name: 'SPOLU',
      amount: obligations.reduce((s, o) => s + o.amountCents, 0) / 100,
      paid: obligations.reduce((s, o) => s + o.paidCents, 0) / 100,
    });
    totalRow.font = { bold: true };
    styleHeader(sheet);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Dochádzka kategórie: matica hráči × tréningy + percento účasti. */
  async attendanceXlsx(categoryCode: string, from?: Date, to?: Date): Promise<Buffer> {
    const events = await this.prisma.event.findMany({
      where: {
        type: 'TRAINING',
        team: { teamCategory: { code: categoryCode } },
        startAt: { gte: from, lte: to },
      },
      include: { attendances: true },
      orderBy: { startAt: 'asc' },
    });
    const members = await this.prisma.member.findMany({
      where: {
        memberships: { some: { leftAt: null, season: { isActive: true }, team: { teamCategory: { code: categoryCode } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Dochádzka ${categoryCode}`);
    const symbols: Record<string, string> = { PRESENT: '✓', ABSENT: '✗', EXCUSED: 'O', INJURED: 'Z', UNKNOWN: '' };

    sheet.columns = [
      { header: 'Hráč', key: 'name', width: 24 },
      ...events.map((event, i) => ({
        header: event.startAt.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }),
        key: `e${i}`,
        width: 7,
      })),
      { header: 'Účasť %', key: 'pct', width: 10 },
    ];

    for (const member of members) {
      const row: Record<string, string | number> = { name: `${member.lastName} ${member.firstName}` };
      let present = 0;
      let counted = 0;
      events.forEach((event, i) => {
        const attendance = event.attendances.find((a) => a.memberId === member.id);
        row[`e${i}`] = symbols[attendance?.status ?? 'UNKNOWN'] ?? '';
        if (attendance && attendance.status !== 'UNKNOWN') {
          counted++;
          if (attendance.status === 'PRESENT') present++;
        }
      });
      row['pct'] = counted > 0 ? Math.round((present / counted) * 100) : 0;
      sheet.addRow(row);
    }
    sheet.addRow({});
    sheet.addRow({ name: 'Legenda: ✓ prítomný, ✗ neprítomný, O ospravedlnený, Z zranený' });
    styleHeader(sheet);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
