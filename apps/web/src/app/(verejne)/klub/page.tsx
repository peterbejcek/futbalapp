import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import SourceNote, { CLUB_BASE, ExtLink } from '@/components/verejne/SourceNote';

export const metadata: Metadata = { title: 'Klub', description: 'FK Košická Nová Ves: tradícia, komunita a futbal od roku 1935.' };

export default function KlubPage() {
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="TU SME DOMA." desc="Náš klub, jeho príbeh a ľudia. Informácie z pôvodného klubového webu."><ClubTabs /></PageTop>
      <section className="section">
        <div className="club-body">
          <div className="prose">
            <span className="history-year">1935.</span>
            <h2>TRADÍCIA. KOMUNITA. FUTBAL.</h2>
            <p>FK Košická Nová Ves má svoje korene v roku 1935. Klub vyrástol na Agátovej ulici a jeho príbeh je spojený s ľuďmi, ktorí futbalom žili celé generácie.</p>
            <p>Na jednom mieste nájdete A-mužstvo, dorast, žiakov aj prípravku. Tento web prepája klubovú históriu s novým portálom pre hráčov, rodičov a trénerov.</p>
            <Link className="btn" href="/klub/historia">Spoznaj náš príbeh ↗</Link>
            <SourceNote path="historia.html" />
          </div>
          <aside className="aside-panel">
            <h3>VŠETKO O FK KNV</h3>
            <Link href="/klub/funkcionari">Funkcionári a tréneri ↗</Link>
            <Link href="/klub/zverejnovanie">Zmluvy a zverejňovanie ↗</Link>
            <ExtLink href={`${CLUB_BASE}statut.c189.html`}>Štatút mládeže · pôvodný web ↗</ExtLink>
            <Link href="/klub/kontakt">Kontakty a klubový areál ↗</Link>
            <ExtLink href="https://vsfz.futbalnet.sk/">Správy a aktuality VsFZ ↗</ExtLink>
          </aside>
        </div>
      </section>
    </>
  );
}
