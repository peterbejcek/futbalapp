import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import SourceNote from '@/components/verejne/SourceNote';

export const metadata: Metadata = { title: 'Funkcionári a tréneri', description: 'Vedenie klubu FK Košická Nová Ves a zoznam trénerov podľa pôvodného klubového webu.' };

const LEADERS: [string, string, string][] = [
  ['Ing. Milan Lesňák', 'Predseda FK', '+421915628912'],
  ['Miroslav Eperješi', 'Manažér FK', '+421903903936'],
  ['Martin Horizral', 'Člen výboru', ''],
  ['Ing. Michal Krcho', 'Člen výboru', ''],
];
const COACHES: [string, string][] = [
  ['Gejza Farkaš', 'Dorast U17'],
  ['Peter Dziak', 'Žiaci U15'],
  ['Vladimír Urban', 'Žiaci U13'],
  ['Ing. Marián Kéda', 'Prípravka U11 a U10'],
  ['Stanislav Lellák', 'Prípravka U10 a U9'],
];

export default function FunkcionariPage() {
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="ĽUDIA ZA KLUBOM." desc="Náš klub, jeho príbeh a ľudia. Informácie z pôvodného klubového webu."><ClubTabs /></PageTop>
      <section className="section">
        <p className="demo">Zoznam podľa pôvodného webu · aktuálne obsadenie pre 2026/27 nepotvrdené</p>
        <h2>VEDENIE KLUBU</h2>
        <div className="people-grid" style={{ marginTop: 24 }}>
          {LEADERS.map(([n, r, p]) => (
            <article className="person" key={n}>
              <span className="label">{r}</span><h3>{n}</h3>
              {p && <a href={`tel:${p}`}>{p}</a>}
            </article>
          ))}
        </div>
        <h2 style={{ marginTop: 48 }}>TRÉNERI · ZDROJOVÝ ZOZNAM</h2>
        <div className="people-grid" style={{ marginTop: 24 }}>
          {COACHES.map(([n, r]) => (
            <article className="person" key={n}><span className="label">{r}</span><h3>{n}</h3></article>
          ))}
        </div>
        <SourceNote path="funkcionari-treneri.html" />
      </section>
    </>
  );
}
