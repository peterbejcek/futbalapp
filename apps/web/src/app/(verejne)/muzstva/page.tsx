import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORY_CODES } from '@fkknv/shared';
import { getPublicData } from '@/lib/verejne/data-source';
import PageTop from '@/components/verejne/PageTop';
import TeamTabs from '@/components/verejne/TeamTabs';
import DemoNotice from '@/components/verejne/DemoNotice';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Naše mužstvá',
  description: 'Od prípravky po mužov. Vyber si kategóriu a spoznaj svoj tím FK Košická Nová Ves.',
};

export default async function MuzstvaPage() {
  const teams = await getPublicData().getTeams();
  const cats = [...new Map(teams.map((t) => [t.categoryCode, t.categoryName])).entries()].sort(
    (a, b) => CATEGORY_CODES.indexOf(a[0]) - CATEGORY_CODES.indexOf(b[0]),
  );
  return (
    <>
      <PageTop label="JEDEN KLUB · VŠETKY GENERÁCIE" title="NAŠE MUŽSTVÁ." desc="Od prípravky po mužov. Vyber si kategóriu a spoznaj svoj tím.">
        <TeamTabs label="Kategórie" items={cats.map(([code, name]) => ({ href: `/muzstva/${code.toLowerCase()}`, label: name, active: false }))} />
      </PageTop>
      <section className="section">
        {cats.length ? (
          <div className="people-grid">
            {cats.map(([code, name]) => (
              <Link key={code} className="person" href={`/muzstva/${code.toLowerCase()}`}>
                <span className="label">{code}</span>
                <h3>{name}</h3>
                <p>{teams.filter((t) => t.categoryCode === code).map((t) => t.name).join(' · ')}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Mužstvá budú čoskoro doplnené.</div>
        )}
        <DemoNotice />
      </section>
    </>
  );
}
