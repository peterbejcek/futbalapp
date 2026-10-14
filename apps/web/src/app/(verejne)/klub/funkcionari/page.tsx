import type { Metadata } from 'next';
import type { PublicPersonDto } from '@fkknv/shared';
import PageTop from '@/components/verejne/PageTop';
import ClubTabs from '@/components/verejne/ClubTabs';
import PersonCard from '@/components/verejne/PersonCard';
import { Pending } from '@/components/verejne/Content';
import { getPeople } from '@/lib/verejne/public-api';
import { pageMeta } from '@/lib/verejne/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'Funkcionári a tréneri', description: 'Vedenie klubu a tréneri FK Košická Nová Ves.', path: '/klub/funkcionari' });

const GROUPS: Array<{ key: PublicPersonDto['group']; heading: string }> = [
  { key: 'MANAGEMENT', heading: 'VEDENIE KLUBU' },
  { key: 'COACH', heading: 'TRÉNERI' },
  { key: 'OTHER', heading: 'ĎALŠÍ ĽUDIA V KLUBE' },
];

export default async function FunkcionariPage() {
  const people = await getPeople();
  const current = people.filter((p) => p.status === 'PUBLISHED');
  const archive = people.filter((p) => p.status === 'ARCHIVED');
  return (
    <>
      <PageTop label="FK KOŠICKÁ NOVÁ VES" title="ĽUDIA ZA KLUBOM." desc="Vedenie klubu a tréneri."><ClubTabs /></PageTop>
      <section className="section">
        {people.length === 0 && <Pending />}
        {GROUPS.map((g) => {
          const list = current.filter((p) => p.group === g.key);
          return list.length ? (
            <div key={g.key} className="people-section">
              <h2>{g.heading}</h2>
              <div className="people-grid">{list.map((p) => <PersonCard key={p.id} person={p} />)}</div>
            </div>
          ) : null;
        })}
        {archive.length > 0 && (
          <div className="people-section archive-section">
            <h2>ARCHÍV – PÔVODNÉ ÚDAJE, NEMUSIA BYŤ AKTUÁLNE</h2>
            <p>Údaje prevzaté z pôvodného webu klubu. Ich platnosť nebola potvrdená.</p>
            {GROUPS.map((g) => {
              const list = archive.filter((p) => p.group === g.key);
              return list.length ? (
                <div key={g.key}>
                  <h3 className="people-sub">{g.heading}</h3>
                  <div className="people-grid">{list.map((p) => <PersonCard key={p.id} person={p} />)}</div>
                </div>
              ) : null;
            })}
          </div>
        )}
      </section>
    </>
  );
}
