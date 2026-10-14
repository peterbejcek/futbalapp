import Link from 'next/link';

export interface CalendarState {
  typ?: 'match' | 'training';
  tim?: string; // categoryCode lowercase
  tym?: string; // teamId družstva v kategórii
  mesiac: string; // YYYY-MM
}

export function calendarHref(s: CalendarState): string {
  const p = new URLSearchParams();
  if (s.typ) p.set('typ', s.typ);
  if (s.tim) p.set('tim', s.tim);
  if (s.tim && s.tym) p.set('tym', s.tym);
  p.set('mesiac', s.mesiac);
  return `/kalendar?${p.toString()}`;
}

const TYPES: Array<{ key: CalendarState['typ']; label: string }> = [
  { key: undefined, label: 'Všetko' },
  { key: 'match', label: 'Zápasy' },
  { key: 'training', label: 'Tréningy' },
];

/** Filtre typu a mužstva; všetko cez odkazy s query (bez klientskeho JS). */
export default function CalendarFilters({ state, teams, squads = [] }: { state: CalendarState; teams: Array<{ code: string; name: string }>; squads?: Array<{ id: string; name: string }> }) {
  return (
    <div className="toolbar">
      <div className="filter" role="group" aria-label="Typ udalosti">
        {TYPES.map((t) => (
          <Link key={t.label} href={calendarHref({ ...state, typ: t.key })} className={state.typ === t.key ? 'active' : ''} aria-current={state.typ === t.key ? 'true' : undefined}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="filter" role="group" aria-label="Mužstvo">
        <Link href={calendarHref({ ...state, tim: undefined, tym: undefined })} className={!state.tim ? 'active' : ''} aria-current={!state.tim ? 'true' : undefined}>
          Všetky mužstvá
        </Link>
        {teams.map((t) => (
          <Link key={t.code} href={calendarHref({ ...state, tim: t.code, tym: undefined })} className={state.tim === t.code ? 'active' : ''} aria-current={state.tim === t.code ? 'true' : undefined}>
            {t.name}
          </Link>
        ))}
      </div>
      {squads.length > 1 && (
        <div className="filter" role="group" aria-label="Družstvo">
          <Link href={calendarHref({ ...state, tym: undefined })} className={!state.tym ? 'active' : ''} aria-current={!state.tym ? 'true' : undefined}>
            Všetky družstvá
          </Link>
          {squads.map((t) => (
            <Link key={t.id} href={calendarHref({ ...state, tym: t.id })} className={state.tym === t.id ? 'active' : ''} aria-current={state.tym === t.id ? 'true' : undefined}>
              {t.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
