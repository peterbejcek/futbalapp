import Image from 'next/image';
import Link from 'next/link';
import type { PublicEvent } from '@/lib/verejne/types';
import { fmtDay, fmtTime } from '@/lib/verejne/format';

const monthShort = (iso: string) =>
  new Intl.DateTimeFormat('sk-SK', { month: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(iso)).replace('.', '').toUpperCase();

export default function MatchCard({ event, featured }: { event: PublicEvent; featured?: boolean }) {
  const m = event.match;
  const opponent = m?.opponent ?? event.title;
  const abbr = opponent.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase();
  return (
    <Link className={`match-card${featured ? ' featured' : ''}`} href={`/kalendar?tim=${event.categoryCode}`}>
      <div className="match-top">
        <span className="label">{featured ? 'NAJBLIŽŠÍ VÝKOP' : 'ĎALŠÍ ZÁPAS'}</span>
        <span className="tag">{event.teamName}</span>
      </div>
      <div className="match-clubs">
        <Image src="/logo.png" alt="" width={31} height={49} />
        <span className="club-name">FK Košická<br />Nová Ves</span>
        <span className="versus">VS</span>
        <span className="club-icon" aria-hidden="true">{abbr}</span>
        <span className="club-name">{opponent}</span>
      </div>
      <div className="match-bottom">
        <b>{fmtDay(event.startAt)}. {monthShort(event.startAt)} · {fmtTime(event.startAt)}</b>
        <span>{m ? (m.isHome ? 'DOMA' : 'VONKU') : ''} &nbsp; ↗</span>
      </div>
    </Link>
  );
}
