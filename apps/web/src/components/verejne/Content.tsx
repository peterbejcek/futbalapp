import type { ReactNode } from 'react';
import type { PublicPageDto } from '@fkknv/shared';
import { CLUB_BASE, ExtLink } from './SourceNote';

/** Neutrálny stav, keď obsah chýba alebo je len koncept (404 / prázdne). */
export function Pending() {
  return (
    <div className="empty">
      <p>Aktuálne informácie pripravujeme.</p>
      <p>
        Dovtedy nájdete informácie na <ExtLink href={CLUB_BASE}>pôvodnom webe klubu ↗</ExtLink>
      </p>
    </div>
  );
}

/** Odznak „Archív“. */
export function ArchiveBadge() {
  return <span className="state-badge archive">Archív</span>;
}

/** Zreteľný banner archívneho obsahu (stránka s ARCHIVED stavom). */
export function ArchiveBanner({ sourceNote, sourceUrl, text = 'Archívny obsah z pôvodného webu klubu – údaje nemusia byť aktuálne', sourceLabel = 'Pôvodný zdroj' }: { sourceNote?: string | null; sourceUrl?: string | null; text?: string; sourceLabel?: string }) {
  return (
    <aside className="archive-banner" role="note" aria-label="Archívny obsah">
      <strong><ArchiveBadge /> {text}</strong>
      {sourceNote && <p>{sourceNote}</p>}
      {sourceUrl && <p><ExtLink href={sourceUrl}>{sourceLabel} ↗</ExtLink></p>}
    </aside>
  );
}

/** Telo obsahovej stránky z DB (čistý text; React ho escapuje). */
export function PageBody({ page }: { page: PublicPageDto }) {
  return (
    <div className="prose">
      {page.sections.map((s, i) => (
        <div key={i}>
          {s.heading && <h2>{s.heading}</h2>}
          {s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
        </div>
      ))}
    </div>
  );
}

/** Obsahová stránka: banner pre ARCHIVED + telo; pri chýbajúcej stránke neutrálny stav. */
export function ContentPage({ page, children }: { page: PublicPageDto | null; children?: ReactNode }) {
  if (!page) return <Pending />;
  return (
    <>
      {page.status === 'ARCHIVED' && <ArchiveBanner sourceNote={page.sourceNote} sourceUrl={page.sourceUrl} />}
      <PageBody page={page} />
      {children}
    </>
  );
}
