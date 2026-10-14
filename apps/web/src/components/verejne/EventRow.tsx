import Link from 'next/link';
import type { PublicEventDto } from '@fkknv/shared';
import { eventHeading, eventScore, fmtDay, fmtMonthShort, fmtTime, isMatchType } from '@/lib/verejne/format';
import StateBadge from './StateBadge';

function subline(e: PublicEventDto, tz: string): string {
  const time = fmtTime(e.startAt, tz);
  if (isMatchType(e.type) && e.match) {
    const score = eventScore(e);
    return `${time} · ${e.match.isHome ? 'Doma' : 'Vonku'}${score ? ` · ${score}` : ''}${e.match.competition ? ` · ${e.match.competition}` : ''}`;
  }
  return `${time} · Tréning`;
}

/** Riadok udalosti v programe; odkazuje na detail udalosti. Tréning je bez skóre. */
export default function EventRow({ event: e, tz }: { event: PublicEventDto; tz: string }) {
  const match = isMatchType(e.type);
  return (
    <Link href={`/kalendar/${encodeURIComponent(e.id)}`} className="list-event">
      <span className="event-date">
        {fmtDay(e.startAt, tz)}
        <small>{fmtMonthShort(e.startAt, tz)}</small>
      </span>
      <span className={`event-type ${match ? 'match' : 'training'}`}>
        {match ? 'ZÁPAS' : 'TRÉNING'}
        <br />
        <b>{e.teamName}</b>
      </span>
      <span>
        <h3>{eventHeading(e)}</h3>
        <p>
          {subline(e, tz)} <StateBadge state={e.state} />
        </p>
      </span>
      <span className="event-place">{e.location ?? ''}</span>
      <span className="event-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
