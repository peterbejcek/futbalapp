import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import { ContentPage } from '@/components/verejne/Content';
import { getPage } from '@/lib/verejne/public-api';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'Podpora a financovanie', description: 'Archív dotácií a financovania FK Košická Nová Ves.', path: '/klub/podpora' });

export default async function Page() {
  const page = await getPage('podpora');
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="PODPORA A FINANCOVANIE." desc="Dotácie, partnerstvá a financovanie klubu."><ClubTabs /></PageTop>
      <section className="section">
        <ContentPage page={page} />
      </section>
    </>
  );
}
