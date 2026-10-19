import type { SportnetMatchResult } from './sportnet-match.parser';

export interface RecordedEvent {
  id: string;
  type: string;
  memberId: string | null;
  note: string | null;
  minute: number;
  createdAt: Date;
}
export interface RosterMember {
  id: string;
  firstName: string;
  lastName: string;
}
export interface PlannedAdd {
  type: 'GOAL' | 'PENALTY_SCORED' | 'GOAL_CONCEDED';
  memberId: string | null;
  note: string | null;
  minute: number;
  label: string;
}
export interface SyncPlan {
  scoreUs: number;
  scoreThem: number;
  add: PlannedAdd[];
  remove: Array<{ id: string; label: string }>;
  /** Čitateľný zoznam úprav (prázdny = bez rozdielov). */
  changes: string[];
}

export function normalizeName(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' '); // poradie mena a priezviska nehrá rolu
}

const GOAL_TYPES = ['GOAL', 'PENALTY_SCORED'];

/**
 * Porovná výsledok a gólové udalosti z futbalnetu so zapísanými a vráti plán úprav.
 * Futbalnet je zdroj pravdy pre skóre a strelcov. Ak zoznam našich strelcov na
 * futbalnete nie je úplný (počet ≠ skóre), upravuje sa len počet gólov.
 * Minúty už zapísaných gólov sa nemenia (časomiera je presnejšia).
 */
export function planMatchSync(input: {
  isHome: boolean;
  parsed: SportnetMatchResult;
  recorded: RecordedEvent[];
  roster: RosterMember[];
  memberLabel: (id: string) => string;
}): SyncPlan | null {
  const { parsed, recorded, roster } = input;
  if (parsed.scoreHome === null || parsed.scoreAway === null) return null;
  const scoreUs = input.isHome ? parsed.scoreHome : parsed.scoreAway;
  const scoreThem = input.isHome ? parsed.scoreAway : parsed.scoreHome;
  const ourName = input.isHome ? parsed.homeName : parsed.awayName;
  const ourId = parsed.teams.find((t) => t.name === ourName)?.id;

  const add: PlannedAdd[] = [];
  const remove: Array<{ id: string; label: string }> = [];
  const changes: string[] = [];

  const byName = new Map<string, string>();
  for (const m of roster) byName.set(normalizeName(`${m.firstName} ${m.lastName}`), m.id);

  // --- naše góly ---
  const ourRecorded = recorded.filter((e) => GOAL_TYPES.includes(e.type));
  const ourSn = ourId ? parsed.goals.filter((g) => g.teamId === ourId) : [];
  const complete = ourSn.length === scoreUs && ourSn.length > 0;
  if (complete) {
    const key = (memberId: string | null, note: string | null) => (memberId ? `m:${memberId}` : `n:${normalizeName(note ?? '')}`);
    const desired = new Map<string, Array<{ memberId: string | null; name: string; minute: number; type: PlannedAdd['type'] }>>();
    for (const g of ourSn) {
      const memberId = g.ownGoal ? null : (byName.get(normalizeName(g.player)) ?? null);
      const name = g.ownGoal ? 'vlastný gól súpera' : g.player;
      const k = key(memberId, name);
      const arr = desired.get(k) ?? [];
      arr.push({ memberId, name, minute: g.minute, type: g.penalty ? 'PENALTY_SCORED' : 'GOAL' });
      desired.set(k, arr);
    }
    const have = new Map<string, RecordedEvent[]>();
    for (const e of ourRecorded) {
      const k = key(e.memberId, e.note);
      have.set(k, [...(have.get(k) ?? []), e]);
    }
    for (const k of new Set([...desired.keys(), ...have.keys()])) {
      const want = desired.get(k) ?? [];
      const got = (have.get(k) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (const d of want.slice(got.length)) {
        const who = d.memberId ? input.memberLabel(d.memberId) : d.name;
        add.push({ type: d.type, memberId: d.memberId, note: d.memberId ? null : d.name, minute: d.minute, label: who });
        changes.push(`Pridaný gól: ${who} (${d.minute}.)`);
      }
      for (const e of got.slice(want.length)) {
        const who = e.memberId ? input.memberLabel(e.memberId) : (e.note ?? 'neznámy strelec');
        remove.push({ id: e.id, label: who });
        changes.push(`Odstránený gól: ${who} (${e.minute}.) — na futbalnete nie je`);
      }
    }
  } else {
    const diff = scoreUs - ourRecorded.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        add.push({ type: 'GOAL', memberId: null, note: 'strelec neznámy (futbalnet)', minute: 0, label: 'strelec neznámy' });
      }
      changes.push(`Doplnených ${diff} gólov bez strelca (futbalnet strelcov neuvádza)`);
    } else if (diff < 0) {
      const extra = [...ourRecorded]
        .sort((a, b) => Number(!!a.memberId) - Number(!!b.memberId) || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, -diff);
      for (const e of extra) remove.push({ id: e.id, label: e.memberId ? input.memberLabel(e.memberId) : (e.note ?? 'gól') });
      changes.push(`Odstránených ${-diff} gólov navyše (skóre na futbalnete je ${scoreUs})`);
    }
  }

  // --- inkasované góly ---
  const conceded = recorded.filter((e) => e.type === 'GOAL_CONCEDED');
  const diffThem = scoreThem - conceded.length;
  if (diffThem > 0) {
    const theirMinutes = parsed.goals.filter((g) => ourId && g.teamId !== ourId).map((g) => g.minute);
    for (let i = 0; i < diffThem; i++) {
      add.push({ type: 'GOAL_CONCEDED', memberId: null, note: null, minute: theirMinutes[conceded.length + i] ?? 0, label: 'inkasovaný gól' });
    }
    changes.push(`Pridaných inkasovaných gólov: ${diffThem}`);
  } else if (diffThem < 0) {
    const extra = [...conceded].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, -diffThem);
    for (const e of extra) remove.push({ id: e.id, label: 'inkasovaný gól' });
    changes.push(`Odstránených inkasovaných gólov: ${-diffThem}`);
  }

  return { scoreUs, scoreThem, add, remove, changes };
}
