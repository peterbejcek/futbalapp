import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import EventRow from '@/components/verejne/EventRow';
import CalendarFilters, { calendarHref, type CalendarState } from '@/components/verejne/CalendarFilters';
import { getEvents, getTeams } from '@/lib/verejne/public-api';
import { DEFAULT_TZ, groupByCategory, monthKeyOf } from '@/lib/verejne/format';

export const metadata: Metadata = {
  title: 'Zápasy a tréningy',
  description: 'Program zápasov a tréningov FK Košická Nová Ves podľa mesiaca a mužstva.',
};
export const dynamic = 'force-dynamic';

const MONTHS = ['JANUÁR', 'FEBRUÁR', 'MAREC', 'APRÍL', 'MÁJ', 'JÚN', 'JÚL', 'AUGUST', 'SEPTEMBER', 'OKTÓBER', 'NOVEMBER', 'DECEMBER'];

const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function KalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { teams, season, club } = await getTeams();
  const tz = club.timezone || DEFAULT_TZ;
  const cats = groupByCategory(teams);

  const typRaw = first(sp.typ);
  const typ = typRaw === 'match' || typRaw === 'training' ? typRaw : undefined;
  const timRaw = first(sp.tim)?.toLowerCase();
  const cat = cats.find((c) => c.code.toLowerCase() === timRaw);
  const tymRaw = first(sp.tym);
  const squad = cat?.teams.find((t) => t.id === tymRaw);
  const mesRaw = first(sp.mesiac);
  const mesiac = mesRaw && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesRaw) ? mesRaw : monthKeyOf(new Date(), tz);

  const state: CalendarState = { typ, tim: cat?.code.toLowerCase(), tym: squad?.id, mesiac };
  const [y, m] = mesiac.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const { events: raw } = await getEvents({
    type: typ,
    categoryCode: cat?.code,
    teamId: squad?.id,
    from: `${mesiac}-01`,
    to: `${mesiac}-${String(lastDay).padStart(2, '0')}`,
    limit: 300,
  });
  const events = raw.filter((e) => monthKeyOf(new Date(e.startAt), tz) === mesiac).sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <>
      <PageTop label={`SEZÓNA ${season.name}`} title="VŽDY PRI HRE." desc="Zápasy aj tréningy na jednom mieste. Vyber si mužstvo a naplánuj si futbalový týždeň." />
      <section className="section">
        <CalendarFilters
          state={state}
          teams={cats.map((c) => ({ code: c.code.toLowerCase(), name: c.name }))}
          squads={cat?.teams.map((t) => ({ id: t.id, name: t.name }))}
        />
        <div className="monthbar">
          <Link href={calendarHref({ ...state, mesiac: shiftMonth(mesiac, -1) })} aria-label="Predchádzajúci mesiac" className="btn outline">←</Link>
          <h2>{MONTHS[m - 1]} {y}</h2>
          <Link href={calendarHref({ ...state, mesiac: shiftMonth(mesiac, 1) })} aria-label="Nasledujúci mesiac" className="btn outline">→</Link>
        </div>
        <div>
          {events.length ? events.map((e) => <EventRow key={e.id} event={e} tz={tz} />) : <div className="empty">Pre tento výber nie sú v tomto mesiaci žiadne udalosti.</div>}
        </div>
      </section>
    </>
  );
}
