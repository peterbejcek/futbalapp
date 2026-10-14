import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import SourceNote, { ExtLink } from '@/components/verejne/SourceNote';

export const metadata: Metadata = { title: 'Kontakt', description: 'Kontakt na FK Košická Nová Ves: Agátová 1, 040 14 Košice, telefón, e-mail, IČO.' };

export default function KontaktPage() {
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="SME TU PRE VÁS." desc="Náš klub, jeho príbeh a ľudia. Informácie z pôvodného klubového webu."><ClubTabs /></PageTop>
      <section className="section">
        <div className="contact-grid">
          <article className="aside-panel">
            <span className="label">NÁŠ DOMOV</span>
            <h3>AGÁTOVÁ 1</h3>
            <p>040 14 Košice<br />Košická Nová Ves</p>
            <ExtLink href="https://www.google.com/maps/search/?api=1&query=FK+Kosicka+Nova+Ves+Agatova+1">Otvoriť mapu ↗</ExtLink>
          </article>
          <article className="aside-panel">
            <span className="label">KLUB</span>
            <h3>OZVITE SA NÁM</h3>
            <p><a href="tel:+421903903936">+421 903 903 936</a><br /><a href="mailto:fkknv1935@gmail.com">fkknv1935@gmail.com</a></p>
            <p>IČO: 31 942 059</p>
          </article>
          <article className="aside-panel">
            <span className="label">PRE HRÁČOV A RODIČOV</span>
            <h3>KLUBOVÝ PORTÁL</h3>
            <p>Registrácia, dochádzka a komunikácia s klubom.</p>
            <Link href="/registracia">Registrácia do portálu ↗</Link>
            <Link href="/prihlasenie">Prihlásenie ↗</Link>
          </article>
        </div>
        <SourceNote path="kontakty.html" />
      </section>
    </>
  );
}
