import Link from 'next/link';
import type { PublicEvent } from '@/lib/verejne/types';
import { fmtDay, fmtMonthShort, fmtTime, isMatchType } from '@/lib/verejne/format';

export default function TeamEventRow({ event }: { event: PublicEvent }) {
  const match = isMatchType(event.type);
  return (
    <Link className="list-event" href={`/kalendar/${event.id}`}>
      <span className="event-date">{fmtDay(event.startAt)}<small>{fmtMonthShort(event.startAt)}</small></span>
      <span className={`event-type ${match ? 'match' : 'training'}`}>{match ? 'ZÁPAS' : 'TRÉNING'}<br /><b>{event.teamName}</b></span>
      <span>
        <h3>{match && event.match ? `FK KNV — ${event.match.opponent}` : event.title}</h3>
        <p>{fmtTime(event.startAt)}{event.match ? ` · ${event.match.isHome ? 'Domáci zápas' : 'Zápas vonku'}` : ''}</p>
      </span>
      <span className="event-place">{event.location ?? ''}</span>
      <span className="event-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
