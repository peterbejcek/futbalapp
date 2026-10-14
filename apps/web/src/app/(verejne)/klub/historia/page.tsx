import type { Metadata } from 'next';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import { ContentPage } from '@/components/verejne/Content';
import { getPage } from '@/lib/verejne/public-api';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'História klubu', description: 'História FK Košická Nová Ves podľa údajov z klubového portálu.', path: '/klub/historia' });

export default async function Page() {
  const page = await getPage('historia');
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="HISTÓRIA KLUBU." desc="Z histórie nášho klubu."><ClubTabs /></PageTop>
      <section className="section">
        <ContentPage page={page} />
      </section>
    </>
  );
}
