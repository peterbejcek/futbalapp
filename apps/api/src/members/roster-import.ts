import ExcelJS from 'exceljs';
import type { MemberStatus } from '@fkknv/shared';

/** Jeden riadok rozparsovaný z importného Excelu (export hráčov z futbalnetu). */
export interface RosterRow {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  homeClub: string | null;
  guestClub: string | null;
  clubAffiliation: string | null;
  registrationNumber: string | null;
  registrationValidUntil: Date | null;
  registeredAt: Date | null;
  status: MemberStatus;
}

/** Odstráni diakritiku a prebytočné medzery pre porovnanie hlavičiek. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Mapovanie normalizovanej hlavičky stĺpca na pole. */
const HEADER_MAP: Record<string, keyof RosterRow> = {
  meno: 'firstName',
  priezvisko: 'lastName',
  'matersky klub': 'homeClub',
  'hostujuci klub': 'guestClub',
  'klubova prislusnost': 'clubAffiliation',
  'registracne cislo': 'registrationNumber',
  'datum narodenia': 'birthDate',
  'platnost registracneho preukazu do': 'registrationValidUntil',
  stav: 'status',
  'datum registracie': 'registeredAt',
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel sériové číslo (dni od 1899-12-30)
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) {
    value = (value as { text: unknown }).text; // ExcelJS rich text / hyperlink
  }
  const s = String(value).trim();
  return s.length ? s : null;
}

function toStatus(value: unknown): MemberStatus {
  const s = norm(toText(value) ?? '');
  if (s.startsWith('host')) return 'GUEST';
  if (s.startsWith('aktiv')) return 'ACTIVE';
  if (!s) return 'ACTIVE';
  return 'INACTIVE';
}

/**
 * Rozparsuje prvý hárok Excelu na riadky hráčov. Hlavičky sa rozpoznávajú
 * podľa názvu (bez ohľadu na diakritiku/veľkosť písmen a poradie stĺpcov).
 */
export async function parseRosterXlsx(buffer: Buffer): Promise<RosterRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel neobsahuje žiadny hárok');

  // nájdi hlavičkový riadok (prvý neprázdny) a namapuj stĺpce
  const headerRow = sheet.getRow(1);
  const colToField = new Map<number, keyof RosterRow>();
  headerRow.eachCell((cell, colNumber) => {
    const key = norm(toText(cell.value) ?? '');
    const field = HEADER_MAP[key];
    if (field) colToField.set(colNumber, field);
  });

  if (!colToField.size) throw new Error('V Exceli sa nenašli známe stĺpce (Meno, Priezvisko, …)');

  const rows: RosterRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // hlavička
    const raw: Partial<Record<keyof RosterRow, unknown>> = {};
    for (const [col, field] of colToField) raw[field] = row.getCell(col).value;

    const firstName = toText(raw.firstName);
    const lastName = toText(raw.lastName);
    if (!firstName || !lastName) return; // prázdny/neúplný riadok preskoč

    rows.push({
      firstName,
      lastName,
      birthDate: toDate(raw.birthDate),
      homeClub: toText(raw.homeClub),
      guestClub: toText(raw.guestClub),
      clubAffiliation: toText(raw.clubAffiliation),
      registrationNumber: toText(raw.registrationNumber),
      registrationValidUntil: toDate(raw.registrationValidUntil),
      registeredAt: toDate(raw.registeredAt),
      status: toStatus(raw.status),
    });
  });

  return rows;
}
