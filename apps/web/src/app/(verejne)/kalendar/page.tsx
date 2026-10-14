import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import DemoNotice from '@/components/verejne/DemoNotice';
import EventRow from '@/components/verejne/EventRow';
import CalendarFilters, { calendarHref, type CalendarState } from '@/components/verejne/CalendarFilters';
import { getPublicData } from '@/lib/verejne/data-source';

export const metadata: Metadata = {
  title: 'Zápasy a tréningy',
  description: 'Program zápasov a tréningov FK Košická Nová Ves podľa mesiaca a mužstva.',
};
export const dynamic = 'force-dynamic';

const TZ = 'Europe/Bratislava';
const MONTHS = ['JANUÁR', 'FEBRUÁR', 'MAREC', 'APRÍL', 'MÁJ', 'JÚN', 'JÚL', 'AUGUST', 'SEPTEMBER', 'OKTÓBER', 'NOVEMBER', 'DECEMBER'];

const monthKey = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: TZ }).formatToParts(d);
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
};
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
};
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function KalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const data = getPublicData();
  const [teams, season] = await Promise.all([data.getTeams(), data.getActiveSeason()]);

  const cats = new Map<string, string>();
  for (const t of teams) {
    const code = String(t.categoryCode).toLowerCase();
    if (!cats.has(code)) cats.set(code, t.categoryName);
  }

  const typRaw = first(sp.typ);
  const typ = typRaw === 'match' || typRaw === 'training' ? typRaw : undefined;
  const timRaw = first(sp.tim)?.toLowerCase();
  const tim = timRaw && cats.has(timRaw) ? timRaw : undefined;
  const mesRaw = first(sp.mesiac);
  const mesiac = mesRaw && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesRaw) ? mesRaw : monthKey(new Date());

  const state: CalendarState = { typ, tim, mesiac };
  const categoryCode = tim ? teams.find((t) => String(t.categoryCode).toLowerCase() === tim)?.categoryCode : undefined;
  const all = await data.getEvents({ type: typ, categoryCode });
  const events = all.filter((e) => monthKey(new Date(e.startAt)) === mesiac);

  const [y, m] = mesiac.split('-').map(Number);

  return (
    <>
      <PageTop label={`SEZÓNA ${season.name}`} title="VŽDY PRI HRE." desc="Zápasy aj tréningy na jednom mieste. Vyber si mužstvo a naplánuj si futbalový týždeň." />
      <section className="section">
        <CalendarFilters state={state} teams={[...cats].map(([code, name]) => ({ code, name }))} />
        <div className="monthbar">
          <Link href={calendarHref({ ...state, mesiac: shiftMonth(mesiac, -1) })} aria-label="Predchádzajúci mesiac" className="btn outline">←</Link>
          <h2>{MONTHS[m - 1]} {y}</h2>
          <Link href={calendarHref({ ...state, mesiac: shiftMonth(mesiac, 1) })} aria-label="Nasledujúci mesiac" className="btn outline">→</Link>
        </div>
        <div>
          {events.length ? events.map((e) => <EventRow key={e.id} event={e} />) : <div className="empty">Pre tento výber nie sú v tomto mesiaci žiadne udalosti.</div>}
        </div>
        <DemoNotice />
      </section>
    </>
  );
}
