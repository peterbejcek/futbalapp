import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageTop from '@/components/verejne/PageTop';
import DemoNotice from '@/components/verejne/DemoNotice';
import { getPublicData } from '@/lib/verejne/data-source';
import { fmtDate } from '@/lib/verejne/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicData().getArticle(slug);
  return a ? { title: a.title, description: a.excerpt } : { title: 'Článok nenájdený' };
}

export default async function ClanokPage({ params }: Props) {
  const { slug } = await params;
  const a = await getPublicData().getArticle(slug);
  if (!a) notFound();
  return (
    <>
      <PageTop label={`${a.tag ? `${a.tag} · ` : ''}${fmtDate(a.publishedAt)}`} title={a.title} desc={a.excerpt} />
      <section className="section">
        <div className="prose" style={{ maxWidth: 760 }}>
          {a.body.map((p, i) => <p key={i}>{p}</p>)}
          <Link className="btn outline" href="/novinky">← Všetky novinky</Link>
        </div>
        <DemoNotice />
      </section>
    </>
  );
}
