import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageTop from '@/components/verejne/PageTop';
import { getArticle } from '@/lib/verejne/public-api';
import { fmtDate } from '@/lib/verejne/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  return a ? { title: a.title, description: a.excerpt } : { title: 'Článok nenájdený' };
}

export default async function ClanokPage({ params }: Props) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  return (
    <>
      <PageTop label={fmtDate(a.publishedAt)} title={a.title} desc={a.excerpt} />
      <section className="section">
        <div className="prose" style={{ maxWidth: 760 }}>
          {a.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <Link className="btn outline" href="/novinky">← Všetky novinky</Link>
        </div>
      </section>
    </>
  );
}
