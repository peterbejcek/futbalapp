import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import DemoNotice from '@/components/verejne/DemoNotice';
import ArticleCard from '@/components/verejne/ArticleCard';
import { getPublicData } from '@/lib/verejne/data-source';

export const metadata: Metadata = { title: 'Novinky', description: 'Novinky a oznamy z FK Košická Nová Ves.' };
export const dynamic = 'force-dynamic';

export default async function NovinkyPage() {
  const articles = (await getPublicData().listArticles()).slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="NOVINKY." desc="Oznamy a články z klubu." />
      <section className="section">
        {articles.length === 0 ? (
          <div className="empty">Zatiaľ tu nie sú žiadne články.</div>
        ) : (
          <div className="news-grid">{articles.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        )}
        <DemoNotice />
      </section>
    </>
  );
}
