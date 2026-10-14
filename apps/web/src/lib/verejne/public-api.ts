import type {
  PublicArticleDto,
  PublicArticleListItemDto,
  PublicDocumentCategory,
  PublicDocumentDto,
  PublicEventDetailDto,
  PublicEventsDto,
  PublicPageDto,
  PublicPersonDto,
  PublicSquadDto,
  PublicTeamsDto,
} from '@fkknv/shared';

/**
 * Server-side klient verejného API (GET /api/v1/public/*), bez tokenu.
 * Pri sieťovej chybe, 5xx alebo neplatnej odpovedi hodí PublicDataUnavailableError
 * (zachytí ju error.tsx), pri 404 vráti null. Nikdy nevracia náhradné/fiktívne dáta.
 */

export class PublicDataUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PublicDataUnavailableError';
  }
}

const DEFAULT_BASE = 'http://localhost:3001/api/v1';
const TIMEOUT_MS = 8000;

/** Interná adresa API pre server-side volania (v dockeri http://api:3001/api/v1). */
const internalBase = () => (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE).replace(/\/+$/, '');

type Query = Record<string, string | number | undefined>;

async function request<T>(path: string, query?: Query): Promise<T | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v));
  const url = `${internalBase()}/public${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    throw new PublicDataUnavailableError(`Verejné API je nedostupné: ${path}`, { cause });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new PublicDataUnavailableError(`Verejné API vrátilo ${res.status}: ${path}`);
  try {
    return (await res.json()) as T;
  } catch (cause) {
    throw new PublicDataUnavailableError(`Neplatná odpoveď verejného API: ${path}`, { cause });
  }
}

function ensure<T>(data: T | null, valid: (d: T) => boolean, path: string): T | null {
  if (data !== null && !valid(data)) throw new PublicDataUnavailableError(`Neplatná odpoveď verejného API: ${path}`);
  return data;
}

export interface EventsQuery {
  categoryCode?: string;
  teamId?: string;
  type?: 'match' | 'training';
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  limit?: number;
}

export async function getTeams(): Promise<PublicTeamsDto> {
  const d = ensure(await request<PublicTeamsDto>('/teams'), (x) => Array.isArray(x.teams) && !!x.club, '/teams');
  if (!d) throw new PublicDataUnavailableError('Verejné API nevrátilo zoznam mužstiev');
  return d;
}

export async function getSquad(teamId: string): Promise<PublicSquadDto | null> {
  return ensure(await request<PublicSquadDto>(`/teams/${encodeURIComponent(teamId)}/squad`), (x) => Array.isArray(x.players) && !!x.team, '/squad');
}

export async function getEvents(query: EventsQuery = {}): Promise<PublicEventsDto> {
  const d = ensure(await request<PublicEventsDto>('/events', { ...query }), (x) => Array.isArray(x.events) && !!x.club, '/events');
  if (!d) throw new PublicDataUnavailableError('Verejné API nevrátilo zoznam udalostí');
  return d;
}

export async function getEvent(id: string): Promise<PublicEventDetailDto | null> {
  return ensure(await request<PublicEventDetailDto>(`/events/${encodeURIComponent(id)}`), (x) => !!x.event && !!x.club, '/events/:id');
}

export async function getArticles(): Promise<PublicArticleListItemDto[]> {
  const d = await request<PublicArticleListItemDto[]>('/articles');
  if (!Array.isArray(d)) throw new PublicDataUnavailableError('Verejné API nevrátilo zoznam článkov');
  return d;
}

export async function getArticle(slug: string): Promise<PublicArticleDto | null> {
  return ensure(await request<PublicArticleDto>(`/articles/${encodeURIComponent(slug)}`), (x) => Array.isArray(x.paragraphs), '/articles/:slug');
}

export async function getPages(): Promise<PublicPageDto[]> {
  const d = await request<PublicPageDto[]>('/pages');
  if (!Array.isArray(d)) throw new PublicDataUnavailableError('Verejné API nevrátilo zoznam stránok');
  return d;
}

/** Obsahová stránka podľa slugu; null ak neexistuje alebo je to koncept (404). */
export async function getPage(slug: string): Promise<PublicPageDto | null> {
  return ensure(await request<PublicPageDto>(`/pages/${encodeURIComponent(slug)}`), (x) => Array.isArray(x.sections), '/pages/:slug');
}

export async function getPeople(): Promise<PublicPersonDto[]> {
  const d = await request<PublicPersonDto[]>('/people');
  if (!Array.isArray(d)) throw new PublicDataUnavailableError('Verejné API nevrátilo zoznam osôb');
  return d;
}

export async function getDocuments(category?: PublicDocumentCategory): Promise<PublicDocumentDto[]> {
  const d = await request<PublicDocumentDto[]>('/documents', { category });
  if (!Array.isArray(d)) throw new PublicDataUnavailableError('Verejné API nevrátilo zoznam dokumentov');
  return d;
}

/** Absolútna URL pre BROWSER: origin verejnej adresy API + relatívna cesta ('/api/v1/public/...'). */
export function publicApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  let origin: string;
  try {
    origin = new URL(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE).origin;
  } catch {
    origin = new URL(DEFAULT_BASE).origin;
  }
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Absolútna URL fotky pre BROWSER (photoUrl = '/api/v1/public/players/:id/photo'). */
export const publicPhotoSrc = publicApiUrl;
