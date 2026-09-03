'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MATCH_EVENT_LABELS_SK,
  SURFACE_LABELS_SK,
  formatEventDateTimeSk,
  type MatchEventType,
  type SurfaceCode,
} from '@fkknv/shared';
import { api } from '@/lib/api';
import { coachTeams, isStaff, useMe } from '@/lib/auth';
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
  stoppage: number | null;
  type: MatchEventType;
  member: Member | null;
}
interface MatchDetail {
  id: string;
  opponent: string;
  opponentLogo: string | null;
  isHome: boolean;
  scoreUs: number | null;
  scoreThem: number | null;
  state: string;
  event: {
    id: string;
    title: string;
    startAt: string;
    endAt: string | null;
    location: string | null;
    surface: SurfaceCode | null;
    team: { id: string; name: string } | null;
  };
  nominations: Nomination[];
  events: MatchEventRow[];
}

// logo nášho klubu (FK Košická Nová Ves) z futbalnetu
const OUR_LOGO = 'https://api.sportnet.online/data/ppo/fk-kosicka-nova-ves.futbalnet.sk/logo';

// akcie viazané na hráča vs tímové
const PLAYER_ACTIONS: MatchEventType[] = ['GOAL', 'ASSIST', 'PENALTY_SCORED', 'PENALTY_MISSED', 'YELLOW', 'RED', 'FOUL', 'SHOT'];
const TEAM_ACTIONS: MatchEventType[] = ['GOAL_CONCEDED', 'CORNER'];

function fmtMinute(minute: number, stoppage: number | null) {
  return stoppage ? `${minute}+${stoppage}` : `${minute}`;
}

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useMe();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [roster, setRoster] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Nomination | null>(null);
  const [minute, setMinute] = useState('0');
  const [stoppage, setStoppage] = useState('');
  const [scoreUs, setScoreUs] = useState('0');
  const [scoreThem, setScoreThem] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ recipients: number; missing: Array<{ id: string; name: string }> } | null>(null);

  // spravovať zápas/nomináciu môže vedenie, alebo tréner tohto družstva
  const manage = isStaff(me) || (!!match?.event.team && coachTeams(me).some((t) => t.id === match.event.team!.id));

  const load = useCallback(async () => {
    try {
      const m = await api<MatchDetail>(`/matches/${id}`);
      setMatch(m);
      if (m.event.team) setRoster(await api<Member[]>(`/members?team=${m.event.team.id}&role=PLAYER`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // skóre v poliach drž zosynchronizované s načítaným zápasom
  useEffect(() => {
    if (match) {
      setScoreUs(String(match.scoreUs ?? 0));
      setScoreThem(String(match.scoreThem ?? 0));
    }
  }, [match?.scoreUs, match?.scoreThem]);

  async function setState(state: string) {
    await api(`/matches/${id}/state`, { method: 'POST', body: JSON.stringify({ state }) });
    await load();
  }

  async function saveScore() {
    setError(null);
    await api(`/matches/${id}/score`, {
      method: 'POST',
      body: JSON.stringify({ scoreUs: Number(scoreUs) || 0, scoreThem: Number(scoreThem) || 0 }),
    });
    await load();
  }

  async function sendNominationEmail() {
    setNotifyBusy(true);
    setError(null);
    try {
      const res = await api<{ recipients: number; sent: number; missing: Array<{ id: string; name: string }> }>(
        `/matches/${id}/notify-nomination`,
        { method: 'POST' },
      );
      setNotifyResult({ recipients: res.recipients, missing: res.missing });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Odoslanie zlyhalo');
    } finally {
      setNotifyBusy(false);
    }
  }

  async function toggleNomination(member: Member, on: boolean) {
    if (on) await api(`/matches/${id}/nominations`, { method: 'POST', body: JSON.stringify({ memberId: member.id }) });
    else await api(`/matches/${id}/nominations/${member.id}`, { method: 'DELETE' });
    setNotifyResult(null);
    await load();
  }

  async function record(type: MatchEventType, needsPlayer: boolean) {
    if (needsPlayer && !selected) {
      setError('Najprv ťuknite na hráča v riadku „Hráč" nižšie.');
      return;
    }
    setError(null);
    await api(`/matches/${id}/events`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: crypto.randomUUID(),
        minute: Number(minute) || 0,
        stoppage: Number(stoppage) > 0 ? Number(stoppage) : undefined,
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
  const recording = manage && (match.state === 'LIVE' || match.state === 'FINISHED');

  return (
    <div className="space-y-5">
      <Link href="/portal/udalosti" className="text-sm text-club-600 hover:underline">
        ← Kalendár
      </Link>

      <Card className="text-center">
        <div className="mb-1 flex items-center justify-center gap-4">
          {/* poradie log podľa doma/vonku: doma = my vľavo, vonku = my vpravo */}
          {/* eslint-disable @next/next/no-img-element */}
          <img
            src={match.isHome ? OUR_LOGO : match.opponentLogo ?? OUR_LOGO}
            alt=""
            className="h-12 w-12 object-contain"
            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
          />
          <span className="text-xs font-medium text-gray-400">{match.isHome ? 'DOMA' : 'VONKU'}</span>
          <img
            src={match.isHome ? match.opponentLogo ?? OUR_LOGO : OUR_LOGO}
            alt=""
            className="h-12 w-12 object-contain"
            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
          />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <p className="text-sm text-gray-500">{match.event.title}</p>
        <p className="my-1 text-5xl font-extrabold text-club-800">
          {match.scoreUs ?? 0} : {match.scoreThem ?? 0}
        </p>
        <p className="text-sm font-semibold text-club-600">
          {match.state === 'LIVE' ? '● NAŽIVO' : match.state === 'FINISHED' ? 'Ukončený' : match.state === 'CANCELLED' ? 'Zrušený' : 'Plánovaný'}
          {' · '}
          {formatEventDateTimeSk(match.event.startAt)}
          {match.event.location ? ` · ${match.event.location}` : ''}
          {match.event.surface ? ` · ${SURFACE_LABELS_SK[match.event.surface]}` : ''}
        </p>

        {manage && (
          <div className="mt-3 flex items-end justify-center gap-2">
            <div>
              <label className="block text-xs text-gray-500">Domáci</label>
              <input
                type="number"
                min={0}
                value={scoreUs}
                onChange={(e) => setScoreUs(e.target.value)}
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center text-lg font-bold"
              />
            </div>
            <span className="pb-1 text-lg font-bold text-gray-400">:</span>
            <div>
              <label className="block text-xs text-gray-500">Hostia</label>
              <input
                type="number"
                min={0}
                value={scoreThem}
                onChange={(e) => setScoreThem(e.target.value)}
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center text-lg font-bold"
              />
            </div>
            <Button variant="ghost" onClick={saveScore}>
              Uložiť výsledok
            </Button>
          </div>
        )}

        {manage && (
          <div className="mt-3 flex justify-center gap-2">
            {match.state === 'PLANNED' && <Button onClick={() => setState('LIVE')}>Začať zápas</Button>}
            {match.state === 'LIVE' && (
              <Button variant="danger" onClick={() => setState('FINISHED')}>
                Ukončiť zápas
              </Button>
            )}
            {match.state === 'FINISHED' && (
              <Button variant="ghost" onClick={() => setState('LIVE')}>
                Znovu otvoriť
              </Button>
            )}
          </div>
        )}
        {(isStaff(me) || (match.event.team && coachTeams(me).some((t) => t.id === match.event.team!.id))) && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <EventAdminActions
              eventId={match.event.id}
              startAt={match.event.startAt}
              endAt={match.event.endAt}
              kind="match"
              title={match.event.title}
              location={match.event.location}
              surface={match.event.surface}
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
                      <span className={on ? 'text-club-600' : 'text-gray-400'}>{on ? '✓ v nominácii' : '+ pridať'}</span>
                    </button>
                  </li>
                );
              })}
              {roster.length === 0 && <li className="text-sm text-gray-500">Družstvo nemá hráčov.</li>}
            </ul>
          ) : null}
          {manage && (
            <div className="mt-3 border-t border-club-100 pt-3">
              <Button variant="ghost" onClick={sendNominationEmail} disabled={notifyBusy || match.nominations.length === 0}>
                {notifyBusy ? 'Odosielam…' : '✉ Rozposlať oznam e-mailom'}
              </Button>
              {notifyResult && (
                <div className="mt-2 rounded-md bg-club-50 p-3 text-sm text-gray-700">
                  <p>Oznam odoslaný na {notifyResult.recipients} e-mailových adries.</p>
                  {notifyResult.missing.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-amber-700">
                        Bez e-mailu (nedostali oznam) — chýba konto alebo rodič s e-mailom:
                      </p>
                      <ul className="mt-1 list-inside list-disc text-gray-600">
                        {notifyResult.missing.map((m) => (
                          <li key={m.id}>{m.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {!manage && (
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
          {recording && (
            <div className="mb-4 space-y-3 rounded-md bg-club-50 p-3">
              {/* minúta + nadstavenie */}
              <div className="flex flex-wrap items-end justify-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500">Minúta</label>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    className="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-lg font-bold"
                  />
                </div>
                <span className="pb-1 text-lg font-bold text-gray-400">+</span>
                <div>
                  <label className="block text-xs text-gray-500">Nadstavenie</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={stoppage}
                    onChange={(e) => setStoppage(e.target.value)}
                    placeholder="0"
                    className="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-lg font-bold"
                  />
                </div>
              </div>

              {/* výber hráča */}
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Hráč (pre gól, kartu, asistenciu…):</p>
                {match.nominations.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {match.nominations.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setSelected(selected?.id === n.id ? null : n)}
                        className={`rounded px-2 py-1 text-xs ${
                          selected?.id === n.id ? 'bg-club-600 text-white' : 'bg-white text-club-700 hover:bg-club-100'
                        }`}
                      >
                        {n.member.lastName}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Najprv pridajte hráčov do nominácie vľavo.</p>
                )}
                {selected && (
                  <p className="mt-1 text-center text-sm text-club-700">
                    Vybraný: <strong>{selected.member.lastName}</strong> — ťuknite na akciu
                  </p>
                )}
              </div>

              {/* akcie */}
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
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {match.events.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-club-50 py-1">
                <span className="w-12 font-semibold text-club-600">{fmtMinute(e.minute, e.stoppage)}'</span>
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
