import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/**
 * Integrácia s Veo (športová kamera) — https://developer.veo.co.uk
 *
 * Prihlásenie „password grant": z klubového Veo účtu (email + heslo) a
 * Client ID (vydáva Veo na požiadanie) získame bearer token, ktorým čítame
 * zoznam nahrávok účtu. Veo nevie filtrovať server-side podľa dátumu/tímov,
 * preto načítame posledné videá a spárujeme ich lokálne podľa dátumu zápasu
 * a názvov tímov v názve/popise videa.
 *
 * Konfigurácia (infra/.env → docker-compose api environment):
 *   VEO_CLIENT_ID, VEO_USERNAME, VEO_PASSWORD
 */

const TOKEN_URL = 'https://tokenapi.veo.co.uk/oauth2/token';
const API_BASE = 'https://api.veo.co.uk/api';

export interface VeoCandidate {
  url: string;
  title: string;
  recordedAt: string | null;
  /** skóre zhody (vyššie = lepšie) — na zoradenie kandidátov */
  score: number;
}

/** Odstráni diakritiku a zjednoduší reťazec na porovnávanie. */
function normalize(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Rozdelí názov na významové tokeny (bez krátkych spojok). */
function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !['vs', 'fk', 'tj', 'sk', 'ts'].includes(t));
}

/** Nájde v ľubovoľne zanorenom objekte prvý reťazec s odkazom na Veo zápas. */
function findVeoUrl(obj: unknown, depth = 0): string | null {
  if (depth > 4 || obj == null) return null;
  if (typeof obj === 'string') {
    return /veo\.co\/matches\//i.test(obj) ? obj : null;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const u = findVeoUrl(it, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const u = findVeoUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

/** Vyberie prvú hodnotu spomedzi možných názvov polí. */
function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase())) {
      const v = obj[k];
      if (typeof v === 'string' && v) return v;
      if (typeof v === 'number') return String(v);
    }
  }
  return null;
}

@Injectable()
export class VeoService {
  private readonly logger = new Logger(VeoService.name);
  private token: { value: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return !!(process.env.VEO_CLIENT_ID && process.env.VEO_USERNAME && process.env.VEO_PASSWORD);
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Veo integrácia nie je nastavená (chýba VEO_CLIENT_ID / VEO_USERNAME / VEO_PASSWORD).',
      );
    }
    const body = new URLSearchParams({
      Username: process.env.VEO_USERNAME as string,
      Password: process.env.VEO_PASSWORD as string,
      Grant_type: 'password',
      Client_Id: process.env.VEO_CLIENT_ID as string,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Veo token zlyhal: ${res.status} ${text.slice(0, 200)}`);
      throw new BadRequestException('Prihlásenie do Veo zlyhalo (skontrolujte údaje v .env).');
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new BadRequestException('Veo nevrátilo prístupový token.');
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
    };
    return this.token.value;
  }

  /** Načíta posledné videá klubového účtu (stránkovane, zopár strán). */
  private async fetchVideos(maxPages = 3, pageSize = 50): Promise<Array<Record<string, unknown>>> {
    const token = await this.getToken();
    const all: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= maxPages; page++) {
      const url = `${API_BASE}/videos/v3/get-all?createdByMe=true&pageSize=${pageSize}&pageNumber=${page}&orderBy=UPLOADEDSTAMP&orderByDirection=DESC`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Veo get-all zlyhal: ${res.status} ${text.slice(0, 200)}`);
        break;
      }
      const json = (await res.json()) as unknown;
      const items = Array.isArray(json)
        ? json
        : ((json as Record<string, unknown>)?.videos as unknown[]) ||
          ((json as Record<string, unknown>)?.items as unknown[]) ||
          ((json as Record<string, unknown>)?.data as unknown[]) ||
          ((json as Record<string, unknown>)?.results as unknown[]) ||
          [];
      const rows = (items as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
      all.push(...rows);
      if (rows.length < pageSize) break;
    }
    return all;
  }

  /**
   * Nájde kandidátov na video zo zápasu podľa dátumu a názvov tímov.
   * @param matchDate dátum zápasu (event.startAt)
   * @param terms zoznam reťazcov na porovnanie (náš klub, súper, kategória)
   */
  async findCandidates(matchDate: Date, terms: string[]): Promise<VeoCandidate[]> {
    const videos = await this.fetchVideos();
    const want = new Set(terms.flatMap((t) => tokens(t)));
    const dayMs = 86_400_000;

    const candidates: VeoCandidate[] = [];
    for (const v of videos) {
      const title = pick(v, ['title', 'name', 'displaytitle', 'matchtitle']) ?? '';
      const description = pick(v, ['description', 'notes']) ?? '';
      const dateStr =
        pick(v, ['recordedstamp', 'starttime', 'startstamp', 'matchstamp', 'recordedat', 'timestamp', 'uploadedstamp']) ??
        null;
      const url = findVeoUrl(v);
      if (!url) continue;

      const hay = new Set([...tokens(title), ...tokens(description)]);
      let overlap = 0;
      for (const w of want) if (hay.has(w)) overlap++;

      let score = overlap * 10;
      const recordedAt = dateStr ? new Date(dateStr) : null;
      if (recordedAt && !isNaN(recordedAt.getTime())) {
        const diffDays = Math.abs(recordedAt.getTime() - matchDate.getTime()) / dayMs;
        if (diffDays <= 1.5) score += 50;
        else if (diffDays <= 3) score += 20;
        else score -= Math.min(30, diffDays);
      }

      if (score > 0) {
        candidates.push({
          url,
          title: title || 'Veo video',
          recordedAt: recordedAt && !isNaN(recordedAt.getTime()) ? recordedAt.toISOString() : dateStr,
          score,
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 5);
  }
}
