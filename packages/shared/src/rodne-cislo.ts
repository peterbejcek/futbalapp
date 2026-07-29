/**
 * Rodné číslo (SK/CZ) → dátum narodenia a pohlavie.
 *
 * Formát RRMMDD/XXXX (9 alebo 10 číslic). Mesiac je u žien zvýšený o 50
 * (0/1 na 3. pozícii = muž, 5/6 = žena); od r. 2004 sa pri vyčerpaní zásoby
 * používa aj +20 (muž) / +70 (žena). Storočie sa určuje z dvojčíslia roka.
 */
export type Sex = 'M' | 'F';

export interface RodneCisloInfo {
  birthDate: Date; // UTC polnoc
  sex: Sex;
}

/** Vráti len číslice z rodného čísla (odstráni lomku/medzery). */
export function normalizeRodneCislo(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}

/**
 * Rozparsuje rodné číslo. Vráti dátum narodenia a pohlavie, alebo null ak je
 * formát/dátum neplatný.
 */
export function parseRodneCislo(input: string, referenceYear = new Date().getUTCFullYear()): RodneCisloInfo | null {
  const digits = normalizeRodneCislo(input);
  if (digits.length !== 9 && digits.length !== 10) return null;

  const yy = Number(digits.slice(0, 2));
  const mmRaw = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (Number.isNaN(yy) || Number.isNaN(mmRaw) || Number.isNaN(dd)) return null;

  let month = mmRaw;
  let sex: Sex = 'M';
  if (mmRaw >= 71 && mmRaw <= 82) { month = mmRaw - 70; sex = 'F'; }
  else if (mmRaw >= 51 && mmRaw <= 62) { month = mmRaw - 50; sex = 'F'; }
  else if (mmRaw >= 21 && mmRaw <= 32) { month = mmRaw - 20; sex = 'M'; }
  else if (mmRaw >= 1 && mmRaw <= 12) { month = mmRaw; sex = 'M'; }
  else return null;

  // storočie: 10-miestne RČ (od 1954) — pivot podľa referenčného roka; 9-miestne = 1900+
  let year: number;
  if (digits.length === 10) {
    year = 2000 + yy <= referenceYear ? 2000 + yy : 1900 + yy;
  } else {
    year = 1900 + yy;
  }

  if (dd < 1 || dd > 31) return null;
  const birthDate = new Date(Date.UTC(year, month - 1, dd));
  // overenie, že ide o platný kalendárny dátum (napr. 31.2. → neplatné)
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== dd
  ) {
    return null;
  }
  return { birthDate, sex };
}
