/**
 * Fuzzy párovanie platby na člena podľa mena v poznámke / názve partnera.
 *
 * Rodičia píšu do poznámky rôzne: meno dieťaťa, svoje meno, zdrobneniny
 * („Danka" = Daniela), niekedy s prebytočným textom. Najsilnejší signál je
 * priezvisko (aj v ženskom tvare „Oroszová" → stem „orosz"). Meno (aj cez
 * zdrobneninu) a meno rodiča sú doplnkové signály. Výsledkom je návrh, ktorý
 * admin potvrdí — po potvrdení sa účet (IBAN) naučí a ďalšie platby sú
 * automatické, takže na zdrobneninách záleží len prvýkrát.
 */

/** Časté slovenské zdrobneniny → základné meno. */
const DIMINUTIVES: Record<string, string> = {
  danka: 'daniela', dana: 'daniela', dano: 'daniel', danko: 'daniel',
  miso: 'michal', misko: 'michal', mesko: 'michal',
  zuzka: 'zuzana', zuza: 'zuzana',
  katka: 'katarina', kata: 'katarina',
  janko: 'jan', jano: 'jan', janka: 'jana',
  peto: 'peter', peťo: 'peter', petko: 'peter',
  tomasko: 'tomas', tomko: 'tomas',
  kubo: 'jakub', kubko: 'jakub', jakubko: 'jakub',
  matko: 'matej', mato: 'matej', matus: 'matus', matusko: 'matus',
  martinko: 'martin', maros: 'maros',
  luky: 'lukas', lukasko: 'lukas',
  adamko: 'adam', adko: 'adam',
  filipko: 'filip', filo: 'filip',
  samko: 'samuel', samo: 'samuel', samuelko: 'samuel',
  paľo: 'pavol', palo: 'pavol', pavolko: 'pavol',
  jozko: 'jozef', jozo: 'jozef',
  vilo: 'viliam', vilko: 'viliam',
  ferko: 'frantisek', fero: 'frantisek',
  stanko: 'stanislav', stano: 'stanislav',
  vlado: 'vladimir', vladko: 'vladimir', vladka: 'vladimira',
  riso: 'richard', risko: 'richard',
  robo: 'robert', robko: 'robert',
  betka: 'alzbeta', evka: 'eva', ivka: 'ivana', ivanka: 'ivana',
  lucka: 'lucia', lucka2: 'lucia', terka: 'terezia', natalka: 'natalia',
  ninka: 'nina', ninko: 'nino', sofka: 'sofia', emka: 'ema', ellka: 'ela',
  krisko: 'kristian', kika: 'kristina', bibka: 'barbora', barborka: 'barbora',
  timko: 'timotej', timo: 'timotej', olivko: 'oliver', olko: 'oliver',
};

/** Odstráni diakritiku, malé písmená. */
function strip(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Tituly, ktoré vyhadzujeme z názvu partnera. */
const TITLES = new Set(['mgr', 'ing', 'bc', 'mudr', 'judr', 'phd', 'prof', 'doc', 'rndr', 'paeddr', 'dr']);

/** Rozloží reťazec na normalizované tokeny (bez titulov a krátkych slov). */
function tokenize(text: string | undefined | null): string[] {
  if (!text) return [];
  return strip(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !TITLES.has(t));
}

/** Základ krstného mena (rozbalí zdrobneninu). */
function firstBase(token: string): string {
  return DIMINUTIVES[token] ?? token;
}

/** Stem priezviska — odreže ženské koncovky (Oroszová→orosz, Malá→mal). */
function surnameStem(t: string): string {
  if (t.endsWith('ova')) return t.slice(0, -3);
  if (t.endsWith('a') && t.length > 4) return t.slice(0, -1);
  return t;
}

export interface MatchCandidate {
  memberId: string;
  firstName: string;
  lastName: string;
  guardianNames: Array<{ firstName: string; lastName: string }>;
}

interface Prepared {
  memberId: string;
  surnameStems: Set<string>; // priezviská člena + rodičov (stem)
  firstBases: Set<string>; // krstné mená člena + rodičov (základ)
}

/** Predpripraví index kandidátov (kvôli výkonu pri mnohých pohyboch). */
export function buildIndex(candidates: MatchCandidate[]): Prepared[] {
  return candidates.map((c) => {
    const surnameStems = new Set<string>();
    const firstBases = new Set<string>();
    const add = (first: string, last: string) => {
      for (const t of tokenize(first)) firstBases.add(firstBase(t));
      for (const t of tokenize(last)) surnameStems.add(surnameStem(t));
    };
    add(c.firstName, c.lastName);
    for (const g of c.guardianNames) add(g.firstName, g.lastName);
    return { memberId: c.memberId, surnameStems, firstBases };
  });
}

/**
 * Navrhne memberId pre platbu podľa mena v názve partnera + poznámke.
 * Vráti null, ak niet dostatočne jednoznačného kandidáta.
 */
export function suggestMemberId(
  counterpartyName: string | undefined | null,
  message: string | undefined | null,
  index: Prepared[],
): string | null {
  const tokens = [...tokenize(counterpartyName), ...tokenize(message)];
  if (tokens.length === 0) return null;
  const surnameTokens = new Set(tokens.map(surnameStem));
  const firstTokens = new Set(tokens.map(firstBase));

  let best: { memberId: string; score: number } | null = null;
  let secondScore = 0;

  for (const cand of index) {
    let score = 0;
    let surnameHit = false;
    for (const s of cand.surnameStems) {
      if (s.length >= 3 && surnameTokens.has(s)) { score += 3; surnameHit = true; break; }
    }
    for (const f of cand.firstBases) {
      if (f.length >= 3 && firstTokens.has(f)) { score += 2; break; }
    }
    // samotné krstné meno bez priezviska je slabé — nestačí na návrh
    if (!surnameHit) score = Math.min(score, 2);

    if (!best || score > best.score) {
      secondScore = best?.score ?? 0;
      best = { memberId: cand.memberId, score };
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  // návrh len pri jednoznačnej zhode: aspoň priezvisko (>=3) a jasný náskok
  if (best && best.score >= 3 && best.score > secondScore) return best.memberId;
  return null;
}
