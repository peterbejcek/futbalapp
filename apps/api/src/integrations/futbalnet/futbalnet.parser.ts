/**
 * Parser futbalnet.sk / sportnet.online stránok.
 *
 * Futbalnet nemá garantované verejné API — stránky ale embedujú kompletné
 * dáta v `window.__REDUX_STATE__`. Parser z HTML vytiahne tento JSON a
 * rekurzívne v ňom nájde objekty zápasov (majú homeTeam/awayTeam + čas).
 * Ak sa štruktúra futbalnetu zmení, upravuje sa len tento súbor.
 */

export interface NormalizedMatch {
  /** Stabilné ID zápasu vo futbalnete (idempotencia importu) */
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  startAt: Date;
  location?: string;
  competition?: string;
  round?: string;
}

export function extractReduxState(html: string): unknown | null {
  const marker = 'window.__REDUX_STATE__=';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  // JSON končí pred najbližším </script>; odstráni prípadné ";" na konci
  const end = html.indexOf('</script>', jsonStart);
  if (end === -1) return null;
  let raw = html.slice(jsonStart, end).trim();
  if (raw.endsWith(';')) raw = raw.slice(0, -1);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asTeamName(team: unknown): string | null {
  if (typeof team === 'string') return team;
  if (team && typeof team === 'object') {
    const t = team as Record<string, unknown>;
    for (const key of ['name', 'displayName', 'fullName']) {
      if (typeof t[key] === 'string') return t[key] as string;
    }
    if (t['organization'] && typeof t['organization'] === 'object') {
      const org = t['organization'] as Record<string, unknown>;
      if (typeof org['name'] === 'string') return org['name'];
    }
  }
  return null;
}

function looksLikeMatch(obj: Record<string, unknown>): boolean {
  const hasTeams =
    ('homeTeam' in obj && 'awayTeam' in obj) ||
    (Array.isArray(obj['teams']) && (obj['teams'] as unknown[]).length === 2);
  const hasTime = ['startDate', 'startsAt', 'date', 'startAt'].some((k) => typeof obj[k] === 'string');
  return hasTeams && hasTime;
}

function toNormalized(obj: Record<string, unknown>): NormalizedMatch | null {
  let home: string | null = null;
  let away: string | null = null;

  if ('homeTeam' in obj) {
    home = asTeamName(obj['homeTeam']);
    away = asTeamName(obj['awayTeam']);
  } else if (Array.isArray(obj['teams'])) {
    const teams = obj['teams'] as unknown[];
    home = asTeamName(teams[0]);
    away = asTeamName(teams[1]);
  }
  if (!home || !away) return null;

  const rawDate = ['startDate', 'startsAt', 'date', 'startAt']
    .map((k) => obj[k])
    .find((v): v is string => typeof v === 'string');
  if (!rawDate) return null;
  const startAt = new Date(rawDate);
  if (Number.isNaN(startAt.getTime())) return null;

  const externalId = ['_id', 'id', '__issfId', 'matchId']
    .map((k) => obj[k])
    .find((v) => typeof v === 'string' || typeof v === 'number');
  if (externalId === undefined) return null;

  const sportGround = obj['sportGround'] as Record<string, unknown> | undefined;
  return {
    externalId: String(externalId),
    homeTeam: home,
    awayTeam: away,
    startAt,
    location:
      typeof obj['location'] === 'string'
        ? obj['location']
        : sportGround && typeof sportGround['name'] === 'string'
          ? (sportGround['name'] as string)
          : undefined,
    competition: typeof obj['competitionName'] === 'string' ? obj['competitionName'] : undefined,
    round: typeof obj['round'] === 'string' ? obj['round'] : undefined,
  };
}

/** Rekurzívne pozbiera všetky zápasy z ľubovoľne vnoreného redux stavu. */
export function collectMatches(node: unknown, found: Map<string, NormalizedMatch> = new Map()): NormalizedMatch[] {
  if (Array.isArray(node)) {
    for (const item of node) collectMatches(item, found);
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (looksLikeMatch(obj)) {
      const match = toNormalized(obj);
      if (match) found.set(match.externalId, match);
    }
    for (const value of Object.values(obj)) collectMatches(value, found);
  }
  return [...found.values()];
}

export function parseMatchesFromHtml(html: string): NormalizedMatch[] {
  const state = extractReduxState(html);
  if (!state) return [];
  return collectMatches(state);
}
