import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import SourceNote, { CLUB_BASE, ExtLink } from '@/components/verejne/SourceNote';

export const metadata: Metadata = { title: 'Zverejňovanie', description: 'Dokumenty a informácie klubu FK Košická Nová Ves zverejňované v záujme transparentnosti.' };

const DOCS: [string, string, string, string][] = [
  ['01', 'Zverejňovanie zmlúv', 'Pôvodný register ↗', 'zverejnovanie-zmluv.html'],
  ['02', 'Dotácie a podpora mesta Košice', 'Klubový web ↗', ''],
  ['03', 'Podklady k prestrešeniu tenisových kurtov', 'Zmluva a dodatok ↗', ''],
];

export default function ZverejnovaniePage() {
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="OTVORENÝ KLUB." desc="Náš klub, jeho príbeh a ľudia. Informácie z pôvodného klubového webu."><ClubTabs /></PageTop>
      <section className="section">
        <div className="club-body">
          <div>
            <h2>DOKUMENTY A TRANSPARENTNOSŤ</h2>
            <p>Prístup k pôvodným dokumentom a informáciám klubu.</p>
            <div className="documents">
              {DOCS.map(([n, t, s, path]) => (
                <ExtLink key={n} href={CLUB_BASE + path}><span>{n}</span><strong>{t}</strong><span>{s}</span></ExtLink>
              ))}
              <Link href="/dokumenty/ochrana-osobnych-udajov"><span>04</span><strong>Ochrana osobných údajov</strong><span>Dokument ↗</span></Link>
            </div>
            <SourceNote path="zverejnovanie-zmluv.html" />
          </div>
          <aside className="aside-panel">
            <h3>PODPORTE MLÁDEŽ</h3>
            <p>Klubový web uvádza možnosti pomoci cez partnerstvá, materiál a služby.</p>
            <p>Historické daňové tlačivá a termíny nepovažujte za aktuálne.</p>
            <Link href="/klub/kontakt">Dohodnúť podporu s klubom ↗</Link>
          </aside>
        </div>
      </section>
    </>
  );
}
