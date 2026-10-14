import type { PublicPersonDto } from '@fkknv/shared';
import { ArchiveBadge } from './Content';
import { ExtLink } from './SourceNote';

/** Karta osoby z verejného API; archívne údaje sú označené odznakom a zdrojom. */
export default function PersonCard({ person: p }: { person: PublicPersonDto }) {
  return (
    <article className="person">
      <span className="label">{p.role}</span> {p.status === 'ARCHIVED' && <ArchiveBadge />}
      <h3>{p.name}</h3>
      {p.teamNote && <p>{p.teamNote}</p>}
      {p.phone && <a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`}>{p.phone}</a>}
      {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
      {p.sourceNote && <p className="source">{p.sourceNote}</p>}
      {p.sourceUrl && <p className="source"><ExtLink href={p.sourceUrl}>Pôvodný zdroj ↗</ExtLink></p>}
    </article>
  );
}
