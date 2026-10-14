import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import { ContentPage } from '@/components/verejne/Content';
import { CLUB_BASE, ExtLink } from '@/components/verejne/SourceNote';
import { getPage } from '@/lib/verejne/public-api';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'Klub', description: 'FK Košická Nová Ves: informácie o klube, jeho ľuďoch a zverejňovaných dokumentoch.', path: '/klub' });

export default async function KlubPage() {
  const page = await getPage('o-klube');
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="TU SME DOMA." desc="Náš klub, jeho príbeh a ľudia."><ClubTabs /></PageTop>
      <section className="section">
        <div className="club-body">
          <div>
            <ContentPage page={page} />
          </div>
          <aside className="aside-panel" aria-labelledby="klub-aside">
            <h2 id="klub-aside">VŠETKO O FK KNV</h2>
            <Link href="/klub/historia">História klubu ↗</Link>
            <Link href="/klub/funkcionari">Funkcionári a tréneri ↗</Link>
            <Link href="/klub/zverejnovanie">Zmluvy a zverejňovanie ↗</Link>
            <Link href="/klub/podpora">Podpora a financovanie ↗</Link>
            <Link href="/klub/kontakt">Kontakt ↗</Link>
            <ExtLink href={CLUB_BASE}>Pôvodný web klubu ↗</ExtLink>
            <ExtLink href="https://vsfz.futbalnet.sk/">Správy a aktuality VsFZ ↗</ExtLink>
          </aside>
        </div>
      </section>
    </>
  );
}
