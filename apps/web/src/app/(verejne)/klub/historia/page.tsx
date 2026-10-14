import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import SourceNote, { CLUB_BASE, ExtLink } from '@/components/verejne/SourceNote';

export const metadata: Metadata = { title: 'História klubu', description: 'Príbeh FK Košická Nová Ves od roku 1935.' };

const MILESTONES = [
  ['1935', 'Začiatok príbehu', 'Jozef Balogh a ďalší športoví nadšenci založili futbalový klub. Hralo sa na dnešnej Agátovej ulici.'],
  ['1947–48', 'Sokol Košická Nová Ves', 'Obnovený klub niesol názov Sokol. Pri jeho zrode stáli Ján Drenčák, Ján Lengyel a Ondrej Lengyel.'],
  ['1974', 'Nový domov futbalu', '29. augusta bol otvorený nový štadión zápasom Košickej Novej Vsi s VSS Košice.'],
  ['1997', 'Meno, ktoré nosíme dnes', 'Klub pôsobí pod názvom Futbalový klub Košická Nová Ves.'],
];

export default function HistoriaPage() {
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="PRÍBEH OD ROKU 1935." desc="Náš klub, jeho príbeh a ľudia. Informácie z pôvodného klubového webu."><ClubTabs /></PageTop>
      <section className="section">
        <div className="club-body">
          <div className="prose">
            <h2>KAŽDÁ GENERÁCIA ZANECHÁ STOPU.</h2>
            {MILESTONES.map(([y, h, p]) => (
              <div className="person" key={y}><span className="label">{y}</span><h3>{h}</h3><p>{p}</p></div>
            ))}
            <SourceNote path="historia.html" />
          </div>
          <aside className="aside-panel">
            <h3>FUTBAL, KTORÝ SPÁJA</h3>
            <p>Tradícia prvomájového zápasu „Horný a dolný koniec“ siaha podľa klubovej histórie do roku 1951.</p>
            <ExtLink href={`${CLUB_BASE}historia.html`}>Celá história a dobové fotografie ↗</ExtLink>
          </aside>
        </div>
      </section>
    </>
  );
}
