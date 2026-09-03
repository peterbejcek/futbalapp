'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  WEEKDAY_SHORT_SK,
  eventTypeColor,
  SURFACE_CODES,
  SURFACE_LABELS_SK,
  formatEventDateTimeSk,
  formatEventTimeSk,
  type SurfaceCode,
} from '@fkknv/shared';
import { api } from '@/lib/api';
import { canManage, canManageTeam, coachTeams, isStaff, useMe, type Me } from '@/lib/auth';
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
  surface: SurfaceCode | null;
  recurrenceGroupId: string | null;
  team: { id: string; name: string; teamCategory: { code: string } } | null;
  audienceTeams?: Array<{ id: string; name: string }>;
  match: {
    id: string;
    state: string;
    scoreUs: number | null;
    scoreThem: number | null;
    opponent: string;
    isHome: boolean;
    opponentLogo: string | null;
  } | null;
}

const typeLabels: Record<string, string> = {
  TRAINING: 'Tréning',
  MATCH: 'Zápas',
  TOURNAMENT: 'Turnaj',
  CLUB_EVENT: 'Podujatie',
  PARENT_MEETING: 'Rodičovské združenie',
};

/**
 * Odkaz na detail udalosti; `null` = detail sa neotvára.
 * Zápas otvorí každý, kto ho vidí; detail tréningu (dochádzku) len vedenie klubu
 * a tréner daného družstva. Rodičovské združenie a celoklubové podujatia nemajú
 * detail (všetky info sú na karte).
 */
function eventHref(me: Me | null, e: EventItem): string | null {
  if (e.match) return `/portal/zapasy/${e.match.id}`;
  if (e.type === 'PARENT_MEETING') return null;
  return canManageTeam(me, e.team?.id) ? `/portal/dochadzka/${e.id}` : null;
}

/** Komu je udalosť určená (rodičovské združenie): zoznam družstiev alebo „celý klub". */
function audienceLabel(e: EventItem): string | null {
  if (e.type !== 'PARENT_MEETING') return null;
  if (e.audienceTeams && e.audienceTeams.length > 0) return e.audienceTeams.map((t) => t.name).join(', ');
  return 'celý klub';
}

// logo nášho klubu (FK Košická Nová Ves) z futbalnetu
const OUR_LOGO = 'https://api.sportnet.online/data/ppo/fk-kosicka-nova-ves.futbalnet.sk/logo';

function Logo({ src, size = 20 }: { src: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className="inline-block object-contain align-text-bottom"
      onError={(ev) => (ev.currentTarget.style.visibility = 'hidden')}
    />
  );
}

/** Zápas ako mini-tabuľka: domáci hore, hostia dole (s logami a skóre). */
function MatchTeams({ e }: { e: EventItem }) {
  const m = e.match!;
  const our = { name: e.team?.name ?? 'FK KNV', logo: OUR_LOGO };
  const opp = { name: m.opponent, logo: m.opponentLogo };
  const home = m.isHome ? our : opp;
  const away = m.isHome ? opp : our;
  const hasScore = m.scoreUs !== null && m.scoreThem !== null;
  const homeScore = m.isHome ? m.scoreUs : m.scoreThem;
  const awayScore = m.isHome ? m.scoreThem : m.scoreUs;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2">
        {home.logo && <Logo src={home.logo} size={24} />}
        <span className="font-medium text-club-900">{home.name}</span>
        {hasScore && <span className="ml-auto text-lg font-bold text-club-800">{homeScore}</span>}
      </div>
      <div className="flex items-center gap-2">
        {away.logo && <Logo src={away.logo} size={24} />}
        <span className="font-medium text-club-900">{away.name}</span>
        {hasScore && <span className="ml-auto text-lg font-bold text-club-800">{awayScore}</span>}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const { me } = useMe();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [nominatedMatchIds, setNominatedMatchIds] = useState<Set<string>>(new Set());
  const [venues, setVenues] = useState<string[]>([]);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'month'>('list');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // tréner vidí len svoje družstvá; vedenie všetky
  const availableTeams = useMemo(() => {
    if (isStaff(me)) return teams;
    const coachIds = new Set(coachTeams(me).map((t) => t.id));
    return teams.filter((t) => coachIds.has(t.id));
  }, [teams, me]);

  const load = useCallback(async () => {
    try {
      const q = teamFilter ? `&team=${teamFilter}` : '';
      let url: string;
      if (view === 'month') {
        const from = new Date(month.getFullYear(), month.getMonth(), 1);
        const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
        url = `/events?from=${from.toISOString()}&to=${to.toISOString()}${q}`;
      } else {
        const from = new Date();
        from.setMonth(from.getMonth() - 1);
        url = `/events?from=${from.toISOString()}${q}`;
      }
      const list = await api<EventItem[]>(url);
      setEvents(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [teamFilter, view, month]);

  useEffect(() => {
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
    api<string[]>('/events/locations').then(setVenues).catch(() => {});
    api<Array<{ matchId: string }>>('/matches/my/nominated')
      .then((rows) => setNominatedMatchIds(new Set(rows.map((r) => r.matchId))))
      .catch(() => {});
    Promise.all([
      api<string[]>('/matches/opponents').catch(() => []),
      api<Array<{ name: string }>>('/clubs').catch(() => []),
    ])
      .then(([opp, clubs]) => {
        const names = new Set<string>([...opp, ...clubs.map((c) => c.name)]);
        setOpponents([...names].sort((a, b) => a.localeCompare(b, 'sk')));
      })
      .catch(() => {});
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
      <datalist id="venue-list">
        {venues.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="opponent-list">
        {opponents.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-club-900">Kalendár</h1>
        {canManage(me) && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setTrainingOpen(true)}>
              + Tréning
            </Button>
            <Button variant="ghost" onClick={() => setMeetingOpen(true)}>
              + Rodičovské
            </Button>
            <Button onClick={() => setMatchOpen(true)}>+ Zápas / turnaj</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* filter družstiev len pre vedenie/trénerov; rodič/hráč vidí len svoje družstvá */}
        {canManage(me) && (
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
        )}
        {/* prepínač zobrazenia */}
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-club-200">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 text-sm ${view === 'list' ? 'bg-club-600 text-white' : 'bg-white text-club-700'}`}
          >
            Najbližšie
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 text-sm ${view === 'month' ? 'bg-club-600 text-white' : 'bg-white text-club-700'}`}
          >
            Mesiac
          </button>
        </div>
      </div>

      {view === 'month' && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            ‹
          </Button>
          <input
            type="month"
            value={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, mo] = e.target.value.split('-').map(Number);
              if (y && mo) setMonth(new Date(y, mo - 1, 1));
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <Button variant="ghost" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            ›
          </Button>
          <Button variant="ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
            Dnes
          </Button>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {view === 'list' ? (
        <>
          <EventList me={me} nominated={nominatedMatchIds} title="Najbližšie" events={grouped.upcoming} empty="Žiadne naplánované udalosti." />
          {grouped.past.length > 0 && <EventList me={me} nominated={nominatedMatchIds} title="Odohrané" events={grouped.past.slice(0, 20)} empty="" />}
        </>
      ) : (
        <MonthView me={me} nominated={nominatedMatchIds} month={month} events={events} />
      )}

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
      <ParentMeetingModal
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        teams={availableTeams}
        canWholeClub={isStaff(me)}
        onDone={() => {
          setMeetingOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function EventList({
  me,
  nominated,
  title,
  events,
  empty,
}: {
  me: Me | null;
  nominated: Set<string>;
  title: string;
  events: EventItem[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-2 font-semibold text-club-800">{title}</h2>
      {events.length === 0 ? (
        empty ? <Card className="text-sm text-gray-500">{empty}</Card> : null
      ) : (
        <ul className="divide-y divide-club-100 rounded-lg border border-club-100 bg-white">
          {events.map((e) => {
            const href = eventHref(me, e);
            const c = eventTypeColor(e.type);
            const audience = audienceLabel(e);
            const isNominated = !!e.match && nominated.has(e.match.id);
            const body = (
              <>
                <span
                  className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: c.bg, color: c.text }}
                >
                  {typeLabels[e.type] ?? e.type}
                  {e.team ? ` · ${e.team.name}` : ''}
                  {e.recurrenceGroupId ? ' · séria' : ''}
                </span>
                {isNominated && (
                  <span className="ml-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Nominovaný
                  </span>
                )}
                <div className="mt-1 text-sm text-gray-600">
                  {formatEventDateTimeSk(e.startAt)}
                </div>
                {e.match ? <MatchTeams e={e} /> : <div className="mt-1 font-medium">{e.title}</div>}
                {audience && <div className="mt-1 text-xs text-club-700">Pre: {audience}</div>}
                {(e.location || e.surface) && (
                  <div className="mt-1 text-xs text-gray-500">
                    {e.location}
                    {e.location && e.surface ? ' · ' : ''}
                    {e.surface ? SURFACE_LABELS_SK[e.surface] : ''}
                  </div>
                )}
              </>
            );
            return (
              <li key={e.id}>
                {href ? (
                  <Link href={href} className="block px-4 py-3 hover:bg-club-50">
                    {body}
                  </Link>
                ) : (
                  <div className="block px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MonthView({
  me,
  nominated,
  month,
  events,
}: {
  me: Me | null;
  nominated: Set<string>;
  month: Date;
  events: EventItem[];
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const startWeekday = (new Date(year, m, 1).getDay() + 6) % 7; // Po = 0
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const byDay = new Map<number, EventItem[]>();
  for (const e of events) {
    // čas udalosti je vedený ako UTC „nástenný" čas → deň čítame z UTC komponentov
    const d = new Date(e.startAt);
    if (d.getUTCFullYear() === year && d.getUTCMonth() === m) {
      const arr = byDay.get(d.getUTCDate()) ?? [];
      arr.push(e);
      byDay.set(d.getUTCDate(), arr);
    }
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === m && today.getDate() === d;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
          {['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div
              key={i}
              className={`min-h-[6rem] rounded border p-1 ${d ? 'border-club-100 bg-white' : 'border-transparent'}`}
            >
              {d && (
                <>
                  <div className={`mb-1 text-xs font-semibold ${isToday(d) ? 'text-club-700' : 'text-gray-400'}`}>{d}</div>
                  <div className="space-y-1">
                    {(byDay.get(d) ?? [])
                      .slice()
                      .sort((a, b) => a.startAt.localeCompare(b.startAt))
                      .map((e) => {
                        const href = eventHref(me, e);
                        const c = eventTypeColor(e.type);
                        const time = formatEventTimeSk(e.startAt);
                        const isNominated = !!e.match && nominated.has(e.match.id);
                        const label = `${e.match ? `⚽ ${e.match.opponent}` : `${typeLabels[e.type] ?? e.type}${e.team ? ` ${e.team.name}` : ''}`}${isNominated ? ' ✓' : ''}`;
                        return href ? (
                          <Link
                            key={e.id}
                            href={href}
                            title={`${time} · ${label}`}
                            className="block truncate rounded px-1 py-0.5 text-[11px]"
                            style={{ backgroundColor: c.bg, color: c.text }}
                          >
                            {time} {label}
                          </Link>
                        ) : (
                          <div
                            key={e.id}
                            title={`${time} · ${label}`}
                            className="block truncate rounded px-1 py-0.5 text-[11px]"
                            style={{ backgroundColor: c.bg, color: c.text }}
                          >
                            {time} {label}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
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
  const [surface, setSurface] = useState('');
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
          body: JSON.stringify({ title, teamId, weekdays, startTime, endTime, from, until, location: location || undefined, surface: surface || undefined }),
        });
      } else {
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({ type: 'TRAINING', title, teamId, startAt: `${date}T${startTime}:00.000Z`, location: location || undefined, surface: surface || undefined }),
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
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Ihrisko KNV" list="venue-list" />
        </div>
        <div>
          <label className={labelCls}>Povrch</label>
          <select value={surface} onChange={(e) => setSurface(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {SURFACE_CODES.map((s) => (
              <option key={s} value={s}>
                {s} — {SURFACE_LABELS_SK[s]}
              </option>
            ))}
          </select>
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
  const [surface, setSurface] = useState('');
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
          startAt: `${date}T${time}:00.000Z`,
          location: location || undefined,
          surface: surface || undefined,
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
          <input value={opponent} onChange={(e) => setOpponent(e.target.value)} className={inputCls} list="opponent-list" />
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
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} list="venue-list" />
        </div>
        <div>
          <label className={labelCls}>Povrch</label>
          <select value={surface} onChange={(e) => setSurface(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {SURFACE_CODES.map((s) => (
              <option key={s} value={s}>
                {s} — {SURFACE_LABELS_SK[s]}
              </option>
            ))}
          </select>
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

/** Rodičovské združenie: pre vybrané družstvá alebo celý klub. */
function ParentMeetingModal({
  open,
  onClose,
  teams,
  canWholeClub,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  canWholeClub: boolean;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('Rodičovské združenie');
  const [wholeClub, setWholeClub] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('17:00');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // tréner nemôže robiť celoklubové združenie
  useEffect(() => {
    if (!canWholeClub && wholeClub) setWholeClub(false);
  }, [canWholeClub, wholeClub]);

  function toggleTeam(id: string) {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/events', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PARENT_MEETING',
          title,
          startAt: `${date}T${time}:00.000Z`,
          location: location || undefined,
          audienceTeamIds: wholeClub ? [] : teamIds,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  const valid = !!date && (wholeClub || teamIds.length > 0);

  return (
    <Modal open={open} onClose={onClose} title="Nové rodičovské združenie">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Názov</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Pre koho</label>
          {canWholeClub && (
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={wholeClub} onChange={(e) => setWholeClub(e.target.checked)} />
              Celý klub (všetky družstvá)
            </label>
          )}
          {!wholeClub && (
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2">
              {teams.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={teamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                  {t.name}
                </label>
              ))}
              {teams.length === 0 && <p className="text-sm text-gray-400">Žiadne družstvá.</p>}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">Vyberte jedno či viac družstiev, alebo celý klub.</p>
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
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} list="venue-list" placeholder="Klubovňa / ihrisko KNV" />
        </div>

        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !valid}>
            {busy ? 'Ukladám…' : 'Vytvoriť'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
