import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageTop from '@/components/verejne/PageTop';
import StateBadge from '@/components/verejne/StateBadge';
import { pageMeta } from '@/lib/verejne/seo';
import { getEvent } from '@/lib/verejne/public-api';
import { DEFAULT_TZ, STATE_LABEL, eventHeading, eventScore, fmtDate, fmtTime, isMatchType } from '@/lib/verejne/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = await getEvent(id);
  if (!d) return { title: 'Udalosť nenájdená', robots: { index: false } };
  const tz = d.club.timezone || DEFAULT_TZ;
  const e = d.event;
  return pageMeta({
    title: `${eventHeading(e)} · ${e.teamName}`,
    description: `${fmtDate(e.startAt, tz)} o ${fmtTime(e.startAt, tz)}${e.location ? ` · ${e.location}` : ''}`,
    path: `/kalendar/${encodeURIComponent(id)}`,
  });
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const d = await getEvent(id);
  if (!d) notFound();
  const tz = d.club.timezone || DEFAULT_TZ;
  const e = d.event;
  const match = isMatchType(e.type);
  const m = e.match;
  const score = eventScore(e);

  return (
    <>
      <PageTop label={`${match ? 'ZÁPAS' : 'TRÉNING'} · ${e.teamName}`} title={eventHeading(e)} desc={match && m ? `${m.isHome ? 'Doma' : 'Vonku'}${m.competition ? ` · ${m.competition}` : ''}` : 'Tréningový proces'} />
      <section className="section">
        {m && (
          <>
            <div className="detail-row"><span>Domáci</span><b>{m.homeName}</b></div>
            <div className="detail-row"><span>Hostia</span><b>{m.awayName}</b></div>
          </>
        )}
        <div className="detail-row"><span>Dátum</span><b>{fmtDate(e.startAt, tz)}</b></div>
        <div className="detail-row"><span>Čas</span><b>{fmtTime(e.startAt, tz)}</b></div>
        <div className="detail-row"><span>Miesto</span><b>{e.location ?? 'Neuvedené'}</b></div>
        <div className="detail-row"><span>Mužstvo</span><b>{e.teamName}</b></div>
        <div className="detail-row"><span>Stav</span><b>{STATE_LABEL[e.state] ? <StateBadge state={e.state} /> : 'Naplánovaný'}</b></div>
        {match && score && <div className="detail-row"><span>Skóre</span><b>{score}</b></div>}
        <div className="dialog-actions">
          <a className="btn" href={`/kalendar/${encodeURIComponent(e.id)}/ics`}>Pridať do kalendára ↓</a>
          <Link className="btn outline" href="/kalendar">Späť na program</Link>
        </div>
      </section>
    </>
  );
}
