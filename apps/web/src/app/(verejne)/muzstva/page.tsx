import type { Metadata } from 'next';
import Link from 'next/link';
import { getTeams } from '@/lib/verejne/public-api';
import { groupByCategory } from '@/lib/verejne/format';
import PageTop from '@/components/verejne/PageTop';
import TeamTabs from '@/components/verejne/TeamTabs';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Naše mužstvá',
  description: 'Od prípravky po mužov. Vyber si kategóriu a spoznaj svoj tím FK Košická Nová Ves.',
};

export default async function MuzstvaPage() {
  const { teams } = await getTeams();
  const cats = groupByCategory(teams);
  return (
    <>
      <PageTop label="JEDEN KLUB · VŠETKY GENERÁCIE" title="NAŠE MUŽSTVÁ." desc="Od prípravky po mužov. Vyber si kategóriu a spoznaj svoj tím.">
        <TeamTabs label="Kategórie" items={cats.map((c) => ({ href: `/muzstva/${c.code.toLowerCase()}`, label: c.name, active: false }))} />
      </PageTop>
      <section className="section">
        {cats.length ? (
          <div className="people-grid">
            {cats.map((c) => (
              <Link key={c.code} className="person" href={`/muzstva/${c.code.toLowerCase()}`}>
                <span className="label">{c.code}</span>
                <h3>{c.name}</h3>
                <p>{c.teams.map((t) => t.name).join(' · ')}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Zatiaľ nie sú zverejnené žiadne mužstvá.</div>
        )}
      </section>
    </>
  );
}
