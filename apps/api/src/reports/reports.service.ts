import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const CLUB_NAME = 'FK Košická Nová Ves';
const CLUB_ADDRESS = 'Košická Nová Ves, Košice';
const CLUB_WEB = 'fkknv.sk';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PDF potvrdenie o zaplatených členských poplatkoch za obdobie —
   * podklad pre športový príspevok od zamestnávateľa rodiča.
   */
  async sportAllowancePdf(memberId: string, fromLabel: string, toLabel: string): Promise<Buffer> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        paymentObligations: {
          where: {
            periodLabel: { gte: fromLabel, lte: toLabel },
            paidCents: { gt: 0 },
          },
          include: {
            matches: { include: { bankTransaction: { select: { date: true } } }, orderBy: { matchedAt: 'desc' } },
          },
          orderBy: { periodLabel: 'asc' },
        },
      },
    });
    if (!member) throw new NotFoundException('Člen neexistuje');

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.registerFont('regular', path.join(FONT_DIR, 'DejaVuSans.ttf'));
    doc.registerFont('bold', path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'));

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    // Hlavička klubu
    doc.font('bold').fontSize(18).fillColor('#1b4a25').text(CLUB_NAME);
    doc.font('regular').fontSize(10).fillColor('#555555').text(`${CLUB_ADDRESS} · ${CLUB_WEB}`);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1b4a25').lineWidth(2).stroke();
    doc.moveDown(1.5);

    doc.font('bold').fontSize(14).fillColor('#000000').text('Potvrdenie o zaplatených členských poplatkoch');
    doc.font('regular').fontSize(10).fillColor('#555555').text('Podklad pre športový príspevok od zamestnávateľa');
    doc.moveDown(1.5);

    // Údaje člena
    doc.fontSize(11).fillColor('#000000');
    doc.font('bold').text('Člen klubu: ', { continued: true }).font('regular').text(`${member.firstName} ${member.lastName}`);
    doc
      .font('bold')
      .text('Dátum narodenia: ', { continued: true })
      .font('regular')
      .text(member.birthDate.toLocaleDateString('sk-SK', { timeZone: 'UTC' }));
    doc.font('bold').text('Obdobie: ', { continued: true }).font('regular').text(`${fromLabel} až ${toLabel}`);
    doc.moveDown(1.5);

    // Tabuľka platieb
    const col = { period: 50, amount: 220, date: 380 };
    doc.font('bold').fontSize(10);
    doc.text('Obdobie', col.period, doc.y, { continued: false });
    const headerY = doc.y - 12;
    doc.text('Uhradená suma', col.amount, headerY);
    doc.text('Dátum úhrady', col.date, headerY);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(1).stroke();
    doc.moveDown(0.3);

    doc.font('regular').fontSize(10).fillColor('#000000');
    let totalCents = 0;
    for (const obligation of member.paymentObligations) {
      const paidDate = obligation.matches[0]?.bankTransaction.date;
      const rowY = doc.y;
      doc.text(obligation.periodLabel, col.period, rowY);
      doc.text(`${(obligation.paidCents / 100).toFixed(2)} €`, col.amount, rowY);
      doc.text(paidDate ? paidDate.toLocaleDateString('sk-SK', { timeZone: 'UTC' }) : '—', col.date, rowY);
      totalCents += obligation.paidCents;
      doc.moveDown(0.5);
    }

    if (member.paymentObligations.length === 0) {
      doc.fillColor('#555555').text('Za zvolené obdobie neevidujeme žiadne uhradené poplatky.', 50, doc.y);
    }

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.font('bold').fontSize(12).fillColor('#1b4a25');
    doc.text(`Spolu uhradené: ${(totalCents / 100).toFixed(2)} €`, 50, doc.y);

    // Pätička
    doc.moveDown(3);
    doc.font('regular').fontSize(9).fillColor('#555555');
    doc.text(
      `${CLUB_NAME} týmto potvrdzuje, že vyššie uvedené členské poplatky boli uhradené za športovú činnosť člena klubu. ` +
        'Potvrdenie slúži ako podklad pre príspevok na športovú činnosť dieťaťa podľa § 152b Zákonníka práce.',
      50,
      doc.y,
      { width: 495 },
    );
    doc.moveDown(1);
    doc.text(`Vygenerované ${new Date().toLocaleDateString('sk-SK')} · portál ${CLUB_WEB}`);

    doc.end();
    return done;
  }
}
