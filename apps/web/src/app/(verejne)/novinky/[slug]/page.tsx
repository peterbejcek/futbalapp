import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageTop from '@/components/verejne/PageTop';
import { ArchiveBanner } from '@/components/verejne/Content';
import { ExtLink } from '@/components/verejne/SourceNote';
import { getArticle } from '@/lib/verejne/public-api';
import { fmtDate } from '@/lib/verejne/format';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = `/novinky/${encodeURIComponent(slug)}`;
  try {
    const a = await getArticle(slug);
    return a
      ? pageMeta({ title: a.title, description: a.excerpt, path, type: 'article', publishedTime: a.publishedAt })
      : { title: 'Článok nenájdený', robots: { index: false } };
  } catch {
    return pageMeta({ title: 'Novinky', description: 'Novinky a oznamy z FK Košická Nová Ves.', path });
  }
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
          {a.isArchive && <ArchiveBanner text="Archívny oznam – nemusí byť aktuálny" sourceUrl={a.sourceUrl} sourceLabel="Pôvodný oznam" />}
          {a.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {!a.isArchive && a.sourceUrl && <p className="source"><ExtLink href={a.sourceUrl}>Pôvodný oznam ↗</ExtLink></p>}
          <Link className="btn outline" href="/novinky">← Všetky novinky</Link>
        </div>
      </section>
    </>
  );
}
