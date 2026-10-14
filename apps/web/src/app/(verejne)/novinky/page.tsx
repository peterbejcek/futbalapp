import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import ArticleCard from '@/components/verejne/ArticleCard';
import { getArticles } from '@/lib/verejne/public-api';
import { pageMeta } from '@/lib/verejne/seo';

export const metadata: Metadata = pageMeta({ title: 'Novinky', description: 'Novinky a oznamy z FK Košická Nová Ves.', path: '/novinky' });
export const dynamic = 'force-dynamic';

export default async function NovinkyPage() {
  const articles = (await getArticles(200)).slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const current = articles.filter((a) => !a.isArchive);
  const archive = articles.filter((a) => a.isArchive);
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="NOVINKY." desc="Oznamy a články z klubu." />
      <section className="section">
        <h2 className="sr-only">Aktuálne novinky</h2>
        {current.length ? (
          <div className="news-grid">{current.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        ) : (
          <div className="empty">{archive.length ? 'Aktuálne novinky zatiaľ nie sú.' : 'Zatiaľ tu nie sú žiadne články.'}</div>
        )}
      </section>
      {archive.length > 0 && (
        <section className="section alt" aria-labelledby="archiv-oznamov">
          <div className="section-head">
            <div>
              <h2 id="archiv-oznamov">ARCHÍV OZNAMOV.</h2>
              <p>Archívne oznamy z pôvodného webu klubu – nemusia byť aktuálne.</p>
            </div>
          </div>
          <div className="news-grid">{archive.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        </section>
      )}
    </>
  );
}
