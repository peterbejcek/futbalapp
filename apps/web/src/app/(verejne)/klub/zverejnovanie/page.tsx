import type { Metadata } from 'next';
import Link from 'next/link';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import DocumentRow from '@/components/verejne/DocumentRow';
import { ContentPage, Pending } from '@/components/verejne/Content';
import { getDocuments, getPage } from '@/lib/verejne/public-api';
import { DOC_CATEGORY_LABEL, DOC_CATEGORY_ORDER } from '@/lib/verejne/format';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'Zverejňovanie', description: 'Zmluvy, dotácie a ďalšie dokumenty FK Košická Nová Ves zverejňované v záujme transparentnosti.', path: '/klub/zverejnovanie' });

export default async function ZverejnovaniePage() {
  const [page, docs] = await Promise.all([getPage('zverejnovanie'), getDocuments()]);
  const groups = DOC_CATEGORY_ORDER.map((c) => ({
    code: c,
    items: docs.filter((d) => d.category === c).sort((a, b) => (b.documentDate ?? '').localeCompare(a.documentDate ?? '')),
  })).filter((g) => g.items.length);
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="OTVORENÝ KLUB." desc="Dokumenty a informácie zverejňované v záujme transparentnosti."><ClubTabs /></PageTop>
      <section className="section">
        {page && <ContentPage page={page} />}
        {groups.length === 0 && !page && <Pending />}
        {groups.map((g) => (
          <div key={g.code} className="doc-group">
            <h2>{DOC_CATEGORY_LABEL[g.code]}</h2>
            <ul className="doc-list">{g.items.map((d) => <DocumentRow key={d.id} doc={d} />)}</ul>
          </div>
        ))}
        <p className="pub-note"><Link href="/dokumenty/ochrana-osobnych-udajov">Ochrana osobných údajov</Link></p>
      </section>
    </>
  );
}
