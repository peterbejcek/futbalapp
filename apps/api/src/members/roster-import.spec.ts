import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseRosterXlsx } from './roster-import';

async function buildXlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('hraci');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const HEADER = [
  'Meno',
  'Priezvisko',
  'Materský klub',
  'Hosťujúci klub',
  'Klubová príslušnosť',
  'Registračné číslo',
  'Dátum narodenia',
  'Platnosť registračného preukazu do',
  'Stav',
  'Dátum registrácie',
];

describe('parseRosterXlsx', () => {
  it('rozparsuje riadky a namapuje stĺpce podľa hlavičky', async () => {
    const buf = await buildXlsx([
      HEADER,
      [
        'Matúš',
        'Falat',
        'FK Košická Nová Ves',
        '',
        'FK Košická Nová Ves',
        '1398439',
        new Date('2004-07-26'),
        new Date('2026-09-12T23:59:59'),
        'Aktívny',
        new Date('2017-09-12'),
      ],
    ]);
    const rows = await parseRosterXlsx(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      firstName: 'Matúš',
      lastName: 'Falat',
      homeClub: 'FK Košická Nová Ves',
      guestClub: null,
      clubAffiliation: 'FK Košická Nová Ves',
      registrationNumber: '1398439',
      status: 'ACTIVE',
    });
    expect(rows[0].registrationValidUntil?.getFullYear()).toBe(2026);
    expect(rows[0].birthDate?.getFullYear()).toBe(2004);
  });

  it('je odolný voči diakritike/veľkosti písmen a poradiu stĺpcov', async () => {
    const buf = await buildXlsx([
      ['PRIEZVISKO', 'MENO', 'stav'],
      ['Palkovič', 'Marek', 'Hosťujúci'],
    ]);
    const rows = await parseRosterXlsx(buf);
    expect(rows[0]).toMatchObject({ firstName: 'Marek', lastName: 'Palkovič', status: 'GUEST' });
  });

  it('preskočí riadky bez mena/priezviska', async () => {
    const buf = await buildXlsx([HEADER, ['', '', '', '', '', '', '', '', '', ''], ['Ján', 'Nový']]);
    const rows = await parseRosterXlsx(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].firstName).toBe('Ján');
  });

  it('hodí chybu, keď chýbajú známe stĺpce', async () => {
    const buf = await buildXlsx([['A', 'B'], ['x', 'y']]);
    await expect(parseRosterXlsx(buf)).rejects.toThrow();
  });
});
