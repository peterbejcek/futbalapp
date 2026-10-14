import type { PublicDocumentDto } from '@fkknv/shared';
import { downloadName, fmtBytes, fmtPlainDate } from '@/lib/verejne/format';
import { publicApiUrl } from '@/lib/verejne/public-api';
import { ArchiveBadge } from './Content';
import { ExtLink } from './SourceNote';

/** Položka zoznamu dokumentov: tlačidlo Stiahnuť, alebo – bez súboru – odkaz na pôvodný zdroj. */
export default function DocumentRow({ doc: d }: { doc: PublicDocumentDto }) {
  const size = fmtBytes(d.sizeBytes);
  const meta = [d.documentDate ? fmtPlainDate(d.documentDate) : null, size].filter(Boolean).join(' · ');
  return (
    <li className="doc-row">
      <div className="doc-info">
        <h3>{d.title} {d.status === 'ARCHIVED' && <ArchiveBadge />}</h3>
        {d.description && <p>{d.description}</p>}
        {meta && <p className="source">{meta}</p>}
        {d.sourceNote && <p className="source">{d.sourceNote}</p>}
      </div>
      <div className="doc-actions">
        {d.downloadUrl ? (
          <a className="btn" href={publicApiUrl(d.downloadUrl)} download={downloadName(d.title, d.mimeType)}>
            Stiahnuť<span className="sr-only">: {d.title}</span> ↓
          </a>
        ) : d.sourceUrl ? (
          <ExtLink className="btn outline" href={d.sourceUrl}>Pôvodný zdroj ↗</ExtLink>
        ) : null}
        {d.downloadUrl && d.sourceUrl && <p className="source"><ExtLink href={d.sourceUrl}>Pôvodný zdroj ↗</ExtLink></p>}
      </div>
    </li>
  );
}
