'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MATCH_EVENT_LABELS_SK, type MatchEventType } from '@fkknv/shared';
import { api } from '@/lib/api';
import { canManage, isStaff, useMe } from '@/lib/auth';
import { Button, Card } from '@/components/ui';
import { EventAdminActions } from '@/components/event-admin-actions';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}
interface Nomination {
  id: string;
  member: Member;
}
interface MatchEventRow {
  id: string;
  minute: number;
  type: MatchEventType;
  member: Member | null;
}
interface MatchDetail {
  id: string;
  opponent: string;
  isHome: boolean;
  scoreUs: number | null;
  scoreThem: number | null;
  state: string;
  event: { id: string; title: string; startAt: string; endAt: string | null; location: string | null; team: { id: string; name: string } | null };
  nominations: Nomination[];
  events: MatchEventRow[];
}

// akcie viazané na hráča vs tímové
const PLAYER_ACTIONS: MatchEventType[] = ['GOAL', 'ASSIST', 'PENALTY_SCORED', 'PENALTY_MISSED', 'YELLOW', 'RED', 'FOUL', 'SHOT'];
const TEAM_ACTIONS: MatchEventType[] = ['GOAL_CONCEDED', 'CORNER'];

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useMe();
  const manage = canManage(me);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [roster, setRoster] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Nomination | null>(null);
  const [minute, setMinute] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await api<MatchDetail>(`/matches/${id}`);
      setMatch(m);
      if (m.event.team) setRoster(await api<Member[]>(`/members?team=${m.event.team.id}`));
      if (m.state === 'LIVE') {
        const mins = Math.floor((Date.now() - new Date(m.event.startAt).getTime()) / 60000);
        setMinute(Math.max(0, Math.min(mins, 120)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setState(state: string) {
    await api(`/matches/${id}/state`, { method: 'POST', body: JSON.stringify({ state }) });
    await load();
  }

  async function toggleNomination(member: Member, on: boolean) {
    if (on) await api(`/matches/${id}/nominations`, { method: 'POST', body: JSON.stringify({ memberId: member.id }) });
    else await api(`/matches/${id}/nominations/${member.id}`, { method: 'DELETE' });
    await load();
  }

  async function record(type: MatchEventType, needsPlayer: boolean) {
    if (needsPlayer && !selected) {
      setError('Najprv vyberte hráča v nominácii.');
      return;
    }
    setError(null);
    await api(`/matches/${id}/events`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: crypto.randomUUID(),
        minute,
        type,
        memberId: needsPlayer ? selected!.member.id : undefined,
      }),
    });
    setSelected(null);
    await load();
  }

  if (!match) {
    return (
      <div>
        <Link href="/portal/udalosti" className="text-sm text-club-600 hover:underline">
          ← Kalendár
        </Link>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const nominatedIds = new Set(match.nominations.map((n) => n.member.id));

  return (
    <div className="space-y-5">
      <Link href="/portal/udalosti" className="text-sm text-club-600 hover:underline">
        ← Kalendár
      </Link>

      <Card className="text-center">
        <p className="text-sm text-gray-500">{match.event.title}</p>
        <p className="my-1 text-5xl font-extrabold text-club-800">
          {match.scoreUs ?? 0} : {match.scoreThem ?? 0}
        </p>
        <p className="text-sm font-semibold text-club-600">
          {match.state === 'LIVE' ? '● NAŽIVO' : match.state === 'FINISHED' ? 'Ukončený' : match.state === 'CANCELLED' ? 'Zrušený' : 'Plánovaný'}
          {' · '}
          {new Date(match.event.startAt).toLocaleString('sk-SK')}
          {match.event.location ? ` · ${match.event.location}` : ''}
        </p>
        {manage && (
          <div className="mt-3 flex justify-center gap-2">
            {match.state === 'PLANNED' && <Button onClick={() => setState('LIVE')}>Začať zápas</Button>}
            {match.state === 'LIVE' && (
              <Button variant="danger" onClick={() => setState('FINISHED')}>
                Ukončiť zápas
              </Button>
            )}
          </div>
        )}
        {isStaff(me) && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <EventAdminActions
              eventId={match.event.id}
              startAt={match.event.startAt}
              endAt={match.event.endAt}
              kind="match"
              matchId={match.id}
              matchState={match.state}
              onChanged={load}
            />
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Nominácia */}
        <Card>
          <h2 className="mb-3 font-semibold text-club-800">
            Nominácia ({match.nominations.length}
            {roster.length ? ` / ${roster.length}` : ''})
          </h2>
          {manage ? (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {roster.map((m) => {
                const on = nominatedIds.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => toggleNomination(m, !on)}
                      className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm ${
                        on ? 'bg-club-50 font-medium text-club-800' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>
                        {m.lastName} {m.firstName}
                      </span>
                      <span className={on ? 'text-club-600' : 'text-gray-400'}>{on ? '✓ v nominácii' : '+'}</span>
                    </button>
                  </li>
                );
              })}
              {roster.length === 0 && <li className="text-sm text-gray-500">Družstvo nemá hráčov.</li>}
            </ul>
          ) : (
            <ul className="space-y-1 text-sm">
              {match.nominations.map((n) => (
                <li key={n.id}>
                  {n.member.lastName} {n.member.firstName}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Živý zápis */}
        <Card>
          <h2 className="mb-3 font-semibold text-club-800">Priebeh zápasu</h2>
          {manage && match.state === 'LIVE' && (
            <div className="mb-4 space-y-3 rounded-md bg-club-50 p-3">
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setMinute((m) => Math.max(0, m - 1))} className="h-8 w-8 rounded-full bg-white text-lg font-bold text-club-800">
                  −
                </button>
                <span className="min-w-20 text-center text-lg font-bold">{minute}. min</span>
                <button onClick={() => setMinute((m) => m + 1)} className="h-8 w-8 rounded-full bg-white text-lg font-bold text-club-800">
                  +
                </button>
              </div>
              {selected && (
                <p className="text-center text-sm text-club-700">
                  Vybraný: <strong>{selected.member.lastName}</strong> (ťuknite na akciu)
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {PLAYER_ACTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => record(t, true)}
                    className="rounded border border-club-200 bg-white px-2 py-2 text-xs font-semibold text-club-900 hover:border-club-400"
                  >
                    {MATCH_EVENT_LABELS_SK[t]}
                  </button>
                ))}
                {TEAM_ACTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => record(t, false)}
                    className="rounded border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400"
                  >
                    {MATCH_EVENT_LABELS_SK[t]}
                  </button>
                ))}
              </div>
              {match.nominations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {match.nominations.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelected(selected?.id === n.id ? null : n)}
                      className={`rounded px-2 py-1 text-xs ${
                        selected?.id === n.id ? 'bg-club-600 text-white' : 'bg-white text-club-700'
                      }`}
                    >
                      {n.member.lastName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {match.events.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-club-50 py-1">
                <span className="w-10 font-semibold text-club-600">{e.minute}'</span>
                <span>
                  {MATCH_EVENT_LABELS_SK[e.type]}
                  {e.member ? ` — ${e.member.lastName}` : ''}
                </span>
              </li>
            ))}
            {match.events.length === 0 && <li className="text-gray-500">Zatiaľ žiadne udalosti.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
