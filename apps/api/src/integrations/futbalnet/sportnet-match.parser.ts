/**
 * Parser stránky jedného zápasu na sportnet.sme.sk (futbalnet).
 * Stránka je Next.js (SSR) — dáta zápasu sú v RSC payloade (úvodzovky escapované
 * ako \"). Z objektu zápasu berieme skóre, tímy a gólové udalosti z protokolu.
 */
export interface SportnetGoal {
  teamId: string;
  player: string;
  /** minúta zápasu (z `eventTime` mm:ss) */
  minute: number;
  penalty: boolean;
  ownGoal: boolean;
}

export interface SportnetMatchResult {
  homeName: string;
  awayName: string;
  scoreHome: number | null;
  scoreAway: number | null;
  teams: Array<{ id: string; name: string }>;
  goals: SportnetGoal[];
}

/** Vráti podreťazec od `start` (znak `[` alebo `{`) po zodpovedajúcu uzatváraciu zátvorku. */
function balanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function jsonAfter(text: string, marker: string, from: number): unknown | null {
  const idx = text.indexOf(marker, from);
  if (idx === -1) return null;
  const raw = balanced(text, idx + marker.length - 1);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseSportnetMatch(html: string): SportnetMatchResult | null {
  const text = html.replace(/\\"/g, '"');
  const p = text.indexOf('"protocol":{');
  if (p === -1) return null;

  const rawEvents = jsonAfter(text, '"events":[', p);
  const rawTeams = jsonAfter(text, '"teams":[', p);
  const teams = (Array.isArray(rawTeams) ? rawTeams : [])
    .map((t) => ({ id: String((t as { _id?: unknown })._id ?? ''), name: String((t as { name?: unknown }).name ?? '') }))
    .filter((t) => t.id && t.name);

  const names = (key: 'homeTeam' | 'awayTeam') => new RegExp(`"${key}":\\{"name":"([^"]+)"`).exec(text.slice(p))?.[1] ?? null;
  const homeName = names('homeTeam');
  const awayName = names('awayTeam');
  if (!homeName || !awayName) return null;

  const sc = /"score":\[(\d+|null),(\d+|null)\]/.exec(text.slice(p));
  const num = (v: string | undefined) => (v && v !== 'null' ? Number(v) : null);

  const goals: SportnetGoal[] = [];
  for (const e of Array.isArray(rawEvents) ? rawEvents : []) {
    const ev = e as { eventType?: string; type?: string; player?: { name?: string }; team?: string; eventTime?: string };
    if (ev.eventType !== 'goal' || !ev.team) continue;
    const type = ev.type ?? '';
    goals.push({
      teamId: ev.team,
      player: ev.player?.name?.trim() ?? '',
      minute: Math.max(0, parseInt(ev.eventTime ?? '0', 10) || 0),
      penalty: /penalt/i.test(type),
      ownGoal: /own/i.test(type),
    });
  }

  return { homeName, awayName, scoreHome: num(sc?.[1]), scoreAway: num(sc?.[2]), teams, goals };
}

/** ID zápasu a appSpace z odkazu `…/futbalnet/z/<appSpace>/zapas/<id>/`. */
export function parseSportnetMatchUrl(url: string): { id: string; appSpace: string } | null {
  const m = /\/futbalnet\/z\/([^/]+)\/zapas\/([a-f0-9]{24})/.exec(url);
  return m ? { appSpace: m[1]!, id: m[2]! } : null;
}
