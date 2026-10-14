import Image from 'next/image';
import Link from 'next/link';
import type { PublicEventDto } from '@fkknv/shared';
import { eventScore, fmtDay, fmtMonthOnly, fmtTime } from '@/lib/verejne/format';
import StateBadge from './StateBadge';

const abbrOf = (name: string) => name.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase();

function Side({ name, ours }: { name: string; ours: boolean }) {
  return (
    <>
      {ours ? <Image src="/logo.png" alt="" width={31} height={49} /> : <span className="club-icon" aria-hidden="true">{abbrOf(name)}</span>}
      <span className="club-name">{name}</span>
    </>
  );
}

export default function MatchCard({ event, tz, featured, label }: { event: PublicEventDto; tz: string; featured?: boolean; label?: string }) {
  const m = event.match;
  const home = m?.homeName ?? event.title;
  const away = m?.awayName ?? '';
  const score = eventScore(event);
  return (
    <Link className={`match-card${featured ? ' featured' : ''}`} href={`/kalendar/${encodeURIComponent(event.id)}`}>
      <div className="match-top">
        <span className="label">{label ?? (featured ? 'NAJBLIŽŠÍ VÝKOP' : 'ĎALŠÍ ZÁPAS')}</span>
        <span>
          <StateBadge state={event.state} /> <span className="tag">{event.teamName}</span>
        </span>
      </div>
      <div className="match-clubs">
        <Side name={home} ours={!m || m.isHome} />
        {score ? <span className="versus score">{score}</span> : <span className="versus">VS</span>}
        {m && <Side name={away} ours={!m.isHome} />}
      </div>
      <div className="match-bottom">
        <b>{fmtDay(event.startAt, tz)}. {fmtMonthOnly(event.startAt, tz)} · {fmtTime(event.startAt, tz)}</b>
        <span>{m ? (m.isHome ? 'DOMA' : 'VONKU') : ''} &nbsp; ↗</span>
      </div>
    </Link>
  );
}
