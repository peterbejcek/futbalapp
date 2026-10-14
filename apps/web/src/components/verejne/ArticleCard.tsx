import Link from 'next/link';
import type { PublicArticleListItemDto } from '@fkknv/shared';
import { fmtDate } from '@/lib/verejne/format';

export default function ArticleCard({ article, tz }: { article: PublicArticleListItemDto; tz?: string }) {
  return (
    <Link className="news-card news-card-link" href={`/novinky/${encodeURIComponent(article.slug)}`}>
      <div className="news-art"><span>KLUB</span></div>
      <div className="news-content">
        <small>{fmtDate(article.publishedAt, tz)}</small>
        <h3>{article.title}</h3>
        <p>{article.excerpt}</p>
        <span className="text-link">Čítať viac <span className="arrow">↗</span></span>
      </div>
    </Link>
  );
}
