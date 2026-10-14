import Link from 'next/link';
import type { PublicEvent } from '@/lib/verejne/types';
import { fmtDay, fmtMonthShort, fmtTime, isMatchType } from '@/lib/verejne/format';

export function eventHeading(e: PublicEvent): string {
  return isMatchType(e.type) && e.match ? `FK KNV — ${e.match.opponent}` : e.title;
}

export function eventSubline(e: PublicEvent): string {
  const time = fmtTime(e.startAt);
  if (isMatchType(e.type) && e.match) {
    const m = e.match;
    const where = m.isHome ? 'Doma' : 'Vonku';
    const score = m.state === 'FINISHED' && m.scoreUs != null && m.scoreThem != null ? ` · ${m.scoreUs}:${m.scoreThem}` : '';
    return `${time} · ${where}${score}`;
  }
  return `${time} · Tréning`;
}

/** Riadok udalosti v programe; odkazuje na detail udalosti. */
export default function EventRow({ event: e }: { event: PublicEvent }) {
  const match = isMatchType(e.type);
  return (
    <Link href={`/kalendar/${encodeURIComponent(e.id)}`} className="list-event">
      <span className="event-date">
        {fmtDay(e.startAt)}
        <small>{fmtMonthShort(e.startAt)}</small>
      </span>
      <span className={`event-type ${match ? 'match' : 'training'}`}>
        {match ? 'ZÁPAS' : 'TRÉNING'}
        <br />
        <b>{e.teamName}</b>
      </span>
      <span>
        <h3>{eventHeading(e)}</h3>
        <p>{eventSubline(e)}</p>
      </span>
      <span className="event-place">{e.location ?? ''}</span>
      <span className="event-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
