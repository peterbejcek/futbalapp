import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import { CLUB_BASE, ExtLink } from '@/components/verejne/SourceNote';

export const metadata: Metadata = { title: 'Galéria', description: 'Klubové fotoalbumy FK Košická Nová Ves a vizuálny koncept novej generácie.' };

const ALBUMS: [string, string, string][] = [
  ['galeria-klub.html', 'Klub', 'Zázemie a klubový život'],
  ['galeria-historia.html', 'História', 'Spomienky a dobové fotografie'],
  ['galeria-zapasy.html', 'Zápasy', 'Futbalové momenty z klubového archívu'],
  ['galeria-hraci.html', 'Hráči', 'Pôvodná hráčska fotogaléria'],
];

export default function GaleriaPage() {
  return (
    <>
      <PageTop label="MOMENTY, KTORÉ OSTÁVAJÚ" title="FUTBAL V OBRAZOCH." desc="Klubové albumy z pôvodného webu a vizuálny koncept novej generácie." />
      <section className="section">
        <div className="gallery-grid">
          <div className="gallery-tile">
            <span className="label">VIZUÁLNY KONCEPT · AI</span>
            <h2>NOVÁ GENERÁCIA</h2>
            <p>AI vizuál, fiktívni hráči v koncepte klubového dresu.</p>
          </div>
          {ALBUMS.map(([u, h, p]) => (
            <ExtLink key={u} href={CLUB_BASE + u} className="gallery-tile">
              <span className="label">KLUBOVÝ ARCHÍV</span><h2>{h}</h2><p>{p} ↗</p>
            </ExtLink>
          ))}
        </div>
      </section>
    </>
  );
}
