import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import { ContentPage } from '@/components/verejne/Content';
import { ExtLink } from '@/components/verejne/SourceNote';
import { getPage } from '@/lib/verejne/public-api';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'Kontakt', description: 'Kontakt na FK Košická Nová Ves a odkazy na registráciu a prihlásenie do klubového portálu.', path: '/klub/kontakt' });

export default async function KontaktPage() {
  const page = await getPage('kontakt');
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="SME TU PRE VÁS." desc="Kontakt na klub a vstup do klubového portálu."><ClubTabs /></PageTop>
      <section className="section">
        <ContentPage page={page} />
        <div className="contact-grid">
          <article className="aside-panel">
            <span className="label">PRE HRÁČOV A RODIČOV</span>
            <h2>KLUBOVÝ PORTÁL</h2>
            <p>Registrácia, dochádzka a komunikácia s klubom.</p>
            <Link href="/registracia">Registrácia ↗</Link>
            <Link href="/prihlasenie">Prihlásenie ↗</Link>
          </article>
          <article className="aside-panel">
            <span className="label">NÁJDETE NÁS</span>
            <h2>MAPA</h2>
            <p>Klub nájdete na mape.</p>
            <ExtLink href="https://www.google.com/maps/search/?api=1&query=FK+Ko%C5%A1ick%C3%A1+Nov%C3%A1+Ves">Otvoriť mapu ↗</ExtLink>
          </article>
        </div>
      </section>
    </>
  );
}
