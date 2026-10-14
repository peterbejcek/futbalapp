import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageTop from '@/components/verejne/PageTop';
import DemoNotice from '@/components/verejne/DemoNotice';
import { eventHeading } from '@/components/verejne/EventRow';
import { getPublicData } from '@/lib/verejne/data-source';
import { fmtDate, fmtTime, isMatchType } from '@/lib/verejne/format';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = await getPublicData().getEvent(id);
  if (!e) return { title: 'Udalosť nenájdená' };
  return { title: `${eventHeading(e)} · ${e.teamName}`, description: `${fmtDate(e.startAt)} o ${fmtTime(e.startAt)}${e.location ? ` · ${e.location}` : ''}` };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const e = await getPublicData().getEvent(id);
  if (!e) notFound();
  const match = isMatchType(e.type);
  const m = e.match;
  const finished = match && m && m.state === 'FINISHED' && m.scoreUs != null && m.scoreThem != null;

  return (
    <>
      <PageTop label={`${match ? 'ZÁPAS' : 'TRÉNING'} · ${e.teamName}`} title={eventHeading(e)} desc={match && m ? `${m.isHome ? 'Doma' : 'Vonku'}${m.competition ? ` · ${m.competition}` : ''}` : 'Tréningový proces'} />
      <section className="section">
        <div className="detail-row"><span>Dátum</span><b>{fmtDate(e.startAt)}</b></div>
        <div className="detail-row"><span>Čas</span><b>{fmtTime(e.startAt)}</b></div>
        <div className="detail-row"><span>Miesto</span><b>{e.location ?? 'Neuvedené'}</b></div>
        <div className="detail-row"><span>Mužstvo</span><b>{e.teamName}</b></div>
        {finished && <div className="detail-row"><span>Skóre</span><b>{m!.scoreUs}:{m!.scoreThem}</b></div>}
        <div className="dialog-actions">
          <a className="btn" href={`/kalendar/${encodeURIComponent(e.id)}/ics`}>Pridať do kalendára ↓</a>
          <Link className="btn outline" href="/kalendar">Späť na program</Link>
        </div>
        <DemoNotice />
      </section>
    </>
  );
}
