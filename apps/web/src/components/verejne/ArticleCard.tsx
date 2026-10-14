import Link from 'next/link';
import type { PublicArticleListItemDto } from '@fkknv/shared';
import { fmtDate } from '@/lib/verejne/format';
import { ArchiveBadge } from './Content';
import { ExtLink } from './SourceNote';

export default function ArticleCard({ article, tz }: { article: PublicArticleListItemDto; tz?: string }) {
  return (
    <article className="news-card article-card">
      <Link className="news-card-link" href={`/novinky/${encodeURIComponent(article.slug)}`}>
        <div className="news-art" aria-hidden="true"><span>{article.isArchive ? 'ARCHÍV' : 'KLUB'}</span></div>
        <div className="news-content">
          <small>{fmtDate(article.publishedAt, tz)}</small> {article.isArchive && <ArchiveBadge />}
          <h3>{article.title}</h3>
          <p>{article.excerpt}</p>
          <span className="text-link">Čítať viac <span className="arrow" aria-hidden="true">↗</span></span>
        </div>
      </Link>
      {article.sourceUrl && <p className="news-card-src"><ExtLink href={article.sourceUrl}>Pôvodný oznam ↗</ExtLink></p>}
    </article>
  );
}
