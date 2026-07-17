'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WEEKDAY_SHORT_SK } from '@fkknv/shared';
import { api } from '@/lib/api';
import { canManage, coachTeams, isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

interface Team {
  id: string;
  name: string;
  teamCategory: { code: string; name: string; sortOrder: number };
}
interface EventItem {
  id: string;
  type: string;
  title: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  recurrenceGroupId: string | null;
  team: { name: string; teamCategory: { code: string } } | null;
  match: { id: string; state: string; scoreUs: number | null; scoreThem: number | null } | null;
}

const typeLabels: Record<string, string> = {
  TRAINING: 'Tréning',
  MATCH: 'Zápas',
  TOURNAMENT: 'Turnaj',
  CLUB_EVENT: 'Podujatie',
};

export default function EventsPage() {
  const { me } = useMe();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  // tréner vidí len svoje družstvá; vedenie všetky
  const availableTeams = useMemo(() => {
    if (isStaff(me)) return teams;
    const coachIds = new Set(coachTeams(me).map((t) => t.id));
    return teams.filter((t) => coachIds.has(t.id));
  }, [teams, me]);

  const load = useCallback(async () => {
    try {
      const from = new Date();
      from.setMonth(from.getMonth() - 1);
      const q = teamFilter ? `&team=${teamFilter}` : '';
      const list = await api<EventItem[]>(`/events?from=${from.toISOString()}${q}`);
      setEvents(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [teamFilter]);

  useEffect(() => {
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: events.filter((e) => new Date(e.startAt).getTime() >= now - 3 * 3600_000),
      past: events.filter((e) => new Date(e.startAt).getTime() < now - 3 * 3600_000).reverse(),
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-club-900">Kalendár</h1>
        {canManage(me) && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setTrainingOpen(true)}>
              + Tréning
            </Button>
            <Button onClick={() => setMatchOpen(true)}>+ Zápas / turnaj</Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Družstvo:</label>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
          <option value="">Všetky</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorText>{error}</ErrorText>

      <EventList title="Najbližšie" events={grouped.upcoming} empty="Žiadne naplánované udalosti." />
      {grouped.past.length > 0 && <EventList title="Odohrané" events={grouped.past.slice(0, 20)} empty="" />}

      <TrainingModal
        open={trainingOpen}
        onClose={() => setTrainingOpen(false)}
        teams={availableTeams}
        onDone={() => {
          setTrainingOpen(false);
          void load();
        }}
      />
      <MatchModal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        teams={availableTeams}
        onDone={() => {
          setMatchOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function EventList({ title, events, empty }: { title: string; events: EventItem[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-club-800">{title}</h2>
      {events.length === 0 ? (
        empty ? <Card className="text-sm text-gray-500">{empty}</Card> : null
      ) : (
        <ul className="divide-y divide-club-100 rounded-lg border border-club-100 bg-white">
          {events.map((e) => {
            const href = e.match ? `/portal/zapasy/${e.match.id}` : `/portal/dochadzka/${e.id}`;
            return (
              <li key={e.id}>
                <Link href={href} className="flex items-center justify-between px-4 py-3 hover:bg-club-50">
                  <div>
                    <span className="mr-2 rounded bg-club-100 px-2 py-0.5 text-xs font-medium text-club-800">
                      {typeLabels[e.type] ?? e.type}
                      {e.team ? ` · ${e.team.name}` : ''}
                      {e.recurrenceGroupId ? ' · séria' : ''}
                    </span>
                    <span className="font-medium">{e.title}</span>
                    {e.location && <span className="ml-2 text-sm text-gray-500">{e.location}</span>}
                    {e.match && e.match.scoreUs !== null && (
                      <span className="ml-2 text-sm font-semibold text-club-700">
                        {e.match.scoreUs}:{e.match.scoreThem}
                      </span>
                    )}
                  </div>
                  <time className="text-sm text-gray-600">
                    {new Date(e.startAt).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TrainingModal({
  open,
  onClose,
  teams,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  onDone: () => void;
}) {
  const [recurring, setRecurring] = useState(true);
  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState('Tréning');
  const [location, setLocation] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([2, 5]);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:00');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && teams[0] && !teamId) setTeamId(teams[0].id);
  }, [open, teams, teamId]);

  function toggleDay(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (recurring) {
        await api('/events/recurring', {
          method: 'POST',
          body: JSON.stringify({ title, teamId, weekdays, startTime, endTime, from, until, location: location || undefined }),
        });
      } else {
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({ type: 'TRAINING', title, teamId, startAt: `${date}T${startTime}`, location: location || undefined }),
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nový tréning">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant={recurring ? 'primary' : 'ghost'} onClick={() => setRecurring(true)}>
            Opakovaný
          </Button>
          <Button variant={!recurring ? 'primary' : 'ghost'} onClick={() => setRecurring(false)}>
            Jednorazový
          </Button>
        </div>
        <div>
          <label className={labelCls}>Družstvo</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputCls}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Názov</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>

        {recurring ? (
          <>
            <div>
              <label className={labelCls}>Dni v týždni</label>
              <div className="mt-1 flex gap-1">
                {WEEKDAY_SHORT_SK.map((lbl, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`h-9 w-9 rounded text-sm font-medium ${
                      weekdays.includes(i) ? 'bg-club-600 text-white' : 'bg-club-50 text-club-700'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Od (dátum)</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Do (dátum)</label>
                <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className={labelCls}>Dátum</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Začiatok</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Koniec</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Miesto</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Ihrisko KNV" />
        </div>

        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !teamId}>
            {busy ? 'Ukladám…' : recurring ? 'Vytvoriť sériu' : 'Vytvoriť'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MatchModal({
  open,
  onClose,
  teams,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  onDone: () => void;
}) {
  const [teamId, setTeamId] = useState('');
  const [type, setType] = useState<'MATCH' | 'TOURNAMENT'>('MATCH');
  const [opponent, setOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && teams[0] && !teamId) setTeamId(teams[0].id);
  }, [open, teams, teamId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const team = teams.find((t) => t.id === teamId);
      await api('/events', {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: isHome ? `${team?.name} vs ${opponent}` : `${opponent} vs ${team?.name}`,
          teamId,
          startAt: `${date}T${time}`,
          location: location || undefined,
          opponent,
          isHome,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nový zápas / turnaj">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Družstvo</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputCls}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Typ</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'MATCH' | 'TOURNAMENT')} className={inputCls}>
              <option value="MATCH">Zápas</option>
              <option value="TOURNAMENT">Turnaj</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Doma / vonku</label>
            <select value={isHome ? '1' : '0'} onChange={(e) => setIsHome(e.target.value === '1')} className={inputCls}>
              <option value="1">Doma</option>
              <option value="0">Vonku</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Súper</label>
          <input value={opponent} onChange={(e) => setOpponent(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dátum</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Čas</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Miesto</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !teamId || !opponent || !date}>
            {busy ? 'Ukladám…' : 'Vytvoriť'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
