import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CATEGORY_CODES } from '@fkknv/shared';
import { getPublicData } from '@/lib/verejne/data-source';
import PageTop from '@/components/verejne/PageTop';
import TeamTabs from '@/components/verejne/TeamTabs';
import PlayerCard from '@/components/verejne/PlayerCard';
import TeamEventRow from '@/components/verejne/TeamEventRow';
import DemoNotice from '@/components/verejne/DemoNotice';

export const dynamic = 'force-dynamic';

type Params = Promise<{ kod: string }>;
type Search = Promise<{ tim?: string | string[]; zalozka?: string | string[] }>;

async function categoryTeams(kod: string) {
  const all = await getPublicData().getTeams();
  return all.filter((t) => t.categoryCode.toLowerCase() === kod.toLowerCase()).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kod } = await params;
  const teams = await categoryTeams(kod);
  if (!teams.length) return { title: 'Mužstvo sa nenašlo' };
  return { title: `${teams[0].categoryName} — mužstvá`, description: `Súpiska a program mužstva ${teams[0].categoryName} FK Košická Nová Ves.` };
}

export default async function MuzstvoPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { kod } = await params;
  const sp = await searchParams;
  const teams = await categoryTeams(kod);
  if (!teams.length) notFound();

  const data = getPublicData();
  const code = teams[0].categoryCode;
  const timParam = Array.isArray(sp.tim) ? sp.tim[0] : sp.tim;
  const program = (Array.isArray(sp.zalozka) ? sp.zalozka[0] : sp.zalozka) === 'program';
  const team = teams.find((t) => t.id === timParam) ?? teams[0];

  const [season, allCats, squad, events] = await Promise.all([
    data.getActiveSeason(),
    data.getTeams(),
    program ? Promise.resolve([]) : data.getSquad(team.id),
    program ? data.getEvents({ categoryCode: code }) : Promise.resolve([]),
  ]);
  const cats = [...new Map(allCats.map((t) => [t.categoryCode, t.categoryName])).entries()].sort(
    (a, b) => CATEGORY_CODES.indexOf(a[0]) - CATEGORY_CODES.indexOf(b[0]),
  );
  const base = `/muzstva/${kod.toLowerCase()}`;
  const q = (tim: string | null, zal: boolean) => {
    const p = new URLSearchParams();
    if (tim) p.set('tim', tim);
    if (zal) p.set('zalozka', 'program');
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const rows = events.filter((e) => e.teamId === team.id).sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <>
      <PageTop label="JEDEN KLUB · VŠETKY GENERÁCIE" title="NAŠE MUŽSTVÁ." desc="Od prípravky po mužov. Vyber si kategóriu a spoznaj svoj tím.">
        <TeamTabs label="Kategórie" items={cats.map(([c, name]) => ({ href: `/muzstva/${c.toLowerCase()}`, label: name, active: c === code }))} />
      </PageTop>
      <section className="section">
        <div className="roster-header">
          <div>
            <span className="label">SEZÓNA {season.name}</span>
            <h2>{teams[0].categoryName}</h2>
          </div>
          <TeamTabs
            variant="filter"
            label="Záložky"
            items={[
              { href: q(timParam ? team.id : null, false), label: 'Súpiska', active: !program },
              { href: q(timParam ? team.id : null, true), label: 'Program tímu', active: program },
            ]}
          />
        </div>
        {teams.length > 1 && (
          <TeamTabs
            label="Družstvá"
            items={teams.map((t) => ({ href: q(t.id, program), label: t.name, active: t.id === team.id }))}
          />
        )}
        {program ? (
          rows.length ? (
            <div>{rows.map((e) => <TeamEventRow key={e.id} event={e} />)}</div>
          ) : (
            <div className="empty">Pre tento tím zatiaľ nie sú naplánované žiadne udalosti.</div>
          )
        ) : squad.length ? (
          <div className="roster-grid"><div className="players">{squad.map((p) => <PlayerCard key={p.id} player={p} />)}</div></div>
        ) : (
          <div className="empty">
            <h3>Súpiska {team.name}</h3>
            <p>Súpisku zatiaľ nemáme zverejnenú.</p>
          </div>
        )}
        <DemoNotice />
      </section>
    </>
  );
}
