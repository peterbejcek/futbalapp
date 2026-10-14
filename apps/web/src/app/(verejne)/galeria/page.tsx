import type { Metadata } from 'next';
import Image from 'next/image';
import PageTop from '@/components/verejne/PageTop';
import { CLUB_BASE, ExtLink } from '@/components/verejne/SourceNote';
import { pageMeta } from '@/lib/verejne/seo';

export const metadata: Metadata = pageMeta({ title: 'Galéria', description: 'Archív fotoalbumov FK Košická Nová Ves na pôvodnom webe klubu a ilustračná grafika vytvorená pomocou AI.', path: '/galeria' });

const ALBUMS: [string, string, string][] = [
  ['galeria-klub.html', 'Klub', 'Zázemie a klubový život'],
  ['galeria-historia.html', 'História', 'Spomienky a dobové fotografie'],
  ['galeria-zapasy.html', 'Zápasy', 'Futbalové momenty z klubového archívu'],
  ['galeria-hraci.html', 'Hráči', 'Pôvodná hráčska fotogaléria'],
];

export default function GaleriaPage() {
  return (
    <>
      <PageTop label="MOMENTY, KTORÉ OSTÁVAJÚ" title="FUTBAL V OBRAZOCH." desc="Fotoalbumy sú archívom klubu na pôvodnom webe; odkazy vás tam presmerujú. Fotografie sem nekopírujeme." />
      <section className="section">
        <ul className="gallery-grid plain-list">
          <li className="gallery-tile art">
            <Image className="tile-bg" src="/verejne/hero-blue-crest.png" alt="Ilustračná grafika futbalistov v modrých dresoch (vytvorená pomocou AI)" fill sizes="(max-width: 800px) 100vw, 50vw" quality={70} />
            <span className="label">VIZUÁLNY KONCEPT · AI</span>
            <h2>NOVÁ GENERÁCIA</h2>
            <p>Ilustrácia vytvorená pomocou AI, fiktívni hráči v koncepte klubového dresu. Nejde o členov klubu.</p>
          </li>
          {ALBUMS.map(([u, h, p]) => (
            <li key={u} className="gallery-tile-li">
              <ExtLink href={CLUB_BASE + u} className="gallery-tile">
                <span className="label">KLUBOVÝ ARCHÍV</span><h2>{h}</h2><p>{p} ↗</p>
              </ExtLink>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
