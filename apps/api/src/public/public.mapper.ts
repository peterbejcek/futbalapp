import type {
  PublicArticleDto,
  PublicArticleListItemDto,
  PublicClubDto,
  PublicEventDto,
  PublicEventState,
  PublicSeasonDto,
} from '@fkknv/shared';

/**
 * Explicitný výber polí pre verejné API. Nič mimo týchto `select`-ov sa z DB
 * nenačíta, takže sa nemôže ani omylom dostať do odpovede.
 */

export const SEASON_SELECT = { id: true, name: true, startDate: true, endDate: true, isActive: true } as const;

export const TEAM_CATEGORY_SELECT = { code: true, name: true, sortOrder: true } as const;

/** Člen v súpiske: len meno + príznak súhlasu s fotkou + existencia fotky (bez dát). */
export const SQUAD_MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  publicPhotoConsent: true,
  photo: { select: { id: true } },
} as const;

export const PUBLIC_EVENT_SELECT = {
  id: true,
  type: true,
  title: true,
  startAt: true,
  endAt: true,
  location: true,
  team: {
    select: { id: true, name: true, teamCategory: { select: { code: true, name: true } } },
  },
  match: {
    select: { opponent: true, isHome: true, competition: true, scoreUs: true, scoreThem: true, state: true },
  },
} as const;

export const ARTICLE_LIST_SELECT = { id: true, slug: true, title: true, excerpt: true, publishedAt: true } as const;
export const ARTICLE_DETAIL_SELECT = { ...ARTICLE_LIST_SELECT, body: true } as const;

/** Povolené formáty fotky (bez SVG — mohlo by obsahovať skript). */
const PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export function clubConfig(env: NodeJS.ProcessEnv = process.env): PublicClubDto {
  const name = env.CLUB_NAME?.trim() || 'FK Košická Nová Ves';
  let timezone = env.CLUB_TIMEZONE?.trim() || 'Europe/Bratislava';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
  } catch {
    timezone = 'Europe/Bratislava';
  }
  return { name, timezone };
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function toSeasonDto(s: { name: string; startDate: Date; endDate: Date; isActive: boolean }): PublicSeasonDto {
  return { name: s.name, startDate: isoDay(s.startDate), endDate: isoDay(s.endDate), isActive: s.isActive };
}

/**
 * Časy udalostí sa v DB ukladajú ako „nástenný" čas v UTC komponentoch
 * (17:00 v klube = 17:00Z, viď packages/shared/src/datetime.ts). Verejné API
 * vracia skutočný okamih v UTC — klient ho formátuje v `club.timezone`.
 */
export function wallClockToInstant(wall: Date, timeZone: string): Date {
  const offsetAt = (instant: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
        .formatToParts(instant)
        .map((x) => [x.type, x.value]),
    ) as Record<string, string>;
    const hour = Number(p.hour) === 24 ? 0 : Number(p.hour);
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
  };
  const wallMs = wall.getTime();
  let guess = wallMs - offsetAt(new Date(wallMs));
  // druhý krok — správny posun pri prechode letného/zimného času
  guess = wallMs - offsetAt(new Date(guess));
  return new Date(guess);
}

/** "YYYY-MM-DD" → začiatok kalendárneho dňa v nástennom čase (UTC komponenty). null = neplatné. */
export function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return null;
  }
  return d;
}

export function mapState(type: string, matchState: string | null | undefined): PublicEventState {
  if (type === 'TRAINING' || !matchState) return 'SCHEDULED';
  switch (matchState) {
    case 'LIVE':
      return 'LIVE';
    case 'FINISHED':
      return 'FINISHED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'SCHEDULED';
  }
}

/** Názov nášho družstva: pri jedinom družstve kategórie (názov = kód) len názov klubu. */
export function ourTeamName(clubName: string, teamName: string, categoryCode: string): string {
  return teamName.trim().toUpperCase() === categoryCode.trim().toUpperCase() ? clubName : `${clubName} ${teamName}`;
}

export interface PublicEventRow {
  id: string;
  type: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  team: { id: string; name: string; teamCategory: { code: string; name: string } } | null;
  match: {
    opponent: string;
    isHome: boolean;
    competition: string | null;
    scoreUs: number | null;
    scoreThem: number | null;
    state: string;
  } | null;
}

export function toEventDto(e: PublicEventRow, club: PublicClubDto): PublicEventDto | null {
  if (!e.team) return null;
  if (e.type !== 'MATCH' && e.type !== 'TOURNAMENT' && e.type !== 'TRAINING') return null;
  const state = mapState(e.type, e.match?.state);
  let match: PublicEventDto['match'] = null;
  if (e.type !== 'TRAINING' && e.match) {
    const us = ourTeamName(club.name, e.team.name, e.team.teamCategory.code);
    const showScore = state === 'FINISHED' || state === 'LIVE';
    const scoreUs = showScore ? e.match.scoreUs : null;
    const scoreThem = showScore ? e.match.scoreThem : null;
    const home = e.match.isHome;
    match = {
      homeName: home ? us : e.match.opponent,
      awayName: home ? e.match.opponent : us,
      isHome: home,
      opponent: e.match.opponent,
      competition: e.match.competition,
      homeScore: home ? scoreUs : scoreThem,
      awayScore: home ? scoreThem : scoreUs,
    };
  }
  return {
    id: e.id,
    type: e.type,
    state,
    teamId: e.team.id,
    teamName: e.team.name,
    categoryCode: e.team.teamCategory.code,
    categoryName: e.team.teamCategory.name,
    title: e.title,
    startAt: wallClockToInstant(e.startAt, club.timezone).toISOString(),
    endAt: e.endAt ? wallClockToInstant(e.endAt, club.timezone).toISOString() : null,
    location: e.location,
    match,
  };
}

/** Odseky čistého textu: rozdelené prázdnym riadkom, orezané, bez prázdnych. */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function toArticleListItem(a: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
}): PublicArticleListItemDto {
  return { id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, publishedAt: (a.publishedAt as Date).toISOString() };
}

export function toArticleDto(a: Parameters<typeof toArticleListItem>[0] & { body: string }): PublicArticleDto {
  return { ...toArticleListItem(a), paragraphs: splitParagraphs(a.body) };
}

/** data URL → { mime, buffer }; null ak nejde o povolený obrázok v base64. */
export function decodePhotoDataUrl(dataUrl: string | null | undefined): { mime: string; buffer: Buffer } | null {
  if (!dataUrl) return null;
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1]!.toLowerCase();
  if (!PHOTO_MIME.has(mime)) return null;
  const buffer = Buffer.from(m[2]!, 'base64');
  if (buffer.length === 0) return null;
  return { mime: mime === 'image/jpg' ? 'image/jpeg' : mime, buffer };
}
