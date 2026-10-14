import Link from 'next/link';
import type { PublicArticle } from '@/lib/verejne/types';
import { fmtDate } from '@/lib/verejne/format';

export default function ArticleCard({ article }: { article: PublicArticle }) {
  return (
    <Link className="news-card news-card-link" href={`/novinky/${article.slug}`}>
      <div className="news-art"><span>{(article.tag ?? 'KLUB').slice(0, 8)}</span></div>
      <div className="news-content">
        <small>{(article.tag ? `${article.tag} · ` : '') + fmtDate(article.publishedAt)}</small>
        <h3>{article.title}</h3>
        <p>{article.excerpt}</p>
        <span className="text-link">Čítať viac <span className="arrow">↗</span></span>
      </div>
    </Link>
  );
}
