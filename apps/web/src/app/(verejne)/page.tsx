import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getPublicData } from '@/lib/verejne/data-source';
import { fmtDate } from '@/lib/verejne/format';
import MatchCard from '@/components/verejne/MatchCard';
import PlayerCard from '@/components/verejne/PlayerCard';
import DemoNotice from '@/components/verejne/DemoNotice';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'FK Košická Nová Ves — Naša štvrť. Náš futbal.' },
  description: 'FK Košická Nová Ves: mužstvá, zápasy, tréningy a príbeh klubu od roku 1935.',
};

export default async function Home() {
  const data = getPublicData();
  const [matches, teams, articles] = await Promise.all([data.getEvents({ type: 'match' }), data.getTeams(), data.listArticles()]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sorted = [...matches].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const future = sorted.filter((e) => new Date(e.startAt) >= startOfToday);
  const nextMatches = (future.length ? future : sorted.slice(-3)).slice(0, 3);

  const u15 = teams.filter((t) => t.categoryCode === 'U15').sort((a, b) => a.sortOrder - b.sortOrder);
  let u15Name = 'U15';
  let players: Awaited<ReturnType<typeof data.getSquad>> = [];
  for (const t of u15) {
    const squad = await data.getSquad(t.id);
    if (squad.length) {
      players = squad.slice(0, 3);
      u15Name = t.categoryName;
      break;
    }
  }

  const news = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 2);

  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <div>
          <div className="eyebrow">KOŠICKÁ NOVÁ VES · OD ROKU 1935</div>
          <h1>NAŠA ŠTVRŤ.<br />NÁŠ <em>FUTBAL.</em></h1>
          <p>Veľké sny sa začínajú na našom ihrisku.<br />Zaži futbal, ktorý nás spája.</p>
          <div className="hero-actions">
            <Link className="btn" href="/muzstva">Spoznaj naše tímy <span>↗</span></Link>
            <Link className="btn outline" href="/kalendar">Program zápasov <span>→</span></Link>
          </div>
        </div>
        <div className="hero-number"><strong>1935</strong><small>TRADÍCIA, KTORÁ ŽIJE.</small></div>
        <span className="hero-caption">AI vizualizácia · fiktívni hráči · koncept dresu FK KNV</span>
      </section>

      <div className="strip">
        <span>JEDEN KLUB. SPOLOČNÁ VÁŠEŇ.</span>
        <strong>Od prvého kopu až po A-tím.</strong>
        <Link href="/klub">Spoznaj FK KNV ↗</Link>
      </div>

      <section className="section">
        <div className="section-head">
          <div><h2>NA RADE JE FUTBAL.</h2><p>Najbližšie zápasy našich mužstiev</p></div>
          <Link href="/kalendar" className="text-link">Celý kalendár <span>↗</span></Link>
        </div>
        {nextMatches.length ? (
          <div className="match-grid">
            {nextMatches.map((e, i) => <MatchCard key={e.id} event={e} featured={i === 0} />)}
          </div>
        ) : (
          <div className="empty">Zatiaľ nie sú naplánované žiadne zápasy.</div>
        )}
        <DemoNotice />
      </section>

      <section className="section alt">
        <div className="team-intro">
          <div>
            <div className="eyebrow">BUDÚCNOSŤ MÁ NAŠE FARBY</div>
            <h2>MALÝ KLUB.<br /><span>VEĽKÉ SNY.</span></h2>
            <p>Spoznaj novú generáciu FK KNV. Tímová hra, priateľstvá a chuť posúvať sa ďalej.</p>
            <div className="team-tabs"><span className="tag">{u15Name.toUpperCase()}</span></div>
            <Link href="/muzstva" className="text-link">Preskúmaj mužstvá <span>↗</span></Link>
          </div>
          <div>
            {players.length ? (
              <div className="players">{players.map((p) => <PlayerCard key={p.id} player={p} />)}</div>
            ) : (
              <div className="empty">Súpiska bude čoskoro doplnená.</div>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div><h2>ŽIVOT NÁŠHO KLUBU.</h2><p>Príbehy, tradícia a ľudia, ktorí nás spájajú</p></div>
          <Link href="/novinky" className="text-link">Všetky rubriky <span>↗</span></Link>
        </div>
        <div className="news-grid">
          <Link className="news-card" href="/klub/historia">
            <div className="news-art history"><span>1935</span></div>
            <div className="news-content">
              <small>KLUB · HISTÓRIA</small>
              <h3>Naša hra má<br />hlboké korene.</h3>
              <span className="text-link">Príbeh klubu <span className="arrow">↗</span></span>
            </div>
          </Link>
          {news.map((a, i) => (
            <Link key={a.id} className="news-card" href={`/novinky/${a.slug}`}>
              {a.coverUrl ? (
                <div className="news-art cover" style={{ backgroundImage: `url(${a.coverUrl})` }} role="img" aria-label={a.title} />
              ) : (
                <div className={`news-art${i === 0 ? ' support' : ''}`}>
                  {i === 0 ? <span>SPOLU.</span> : <Image src="/logo.png" alt="Erb FK KNV" width={80} height={122} />}
                </div>
              )}
              <div className="news-content">
                <small>{(a.tag ?? 'NOVINKY').toUpperCase()} · {fmtDate(a.publishedAt)}</small>
                <h3>{a.title}</h3>
                <span className="text-link">Čítať viac <span className="arrow">↗</span></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="join-banner">
        <div>
          <h2>TVOJE MIESTO JE NA IHRISKU.</h2>
          <p>Pridaj sa k FK Košická Nová Ves. Ďalšia kapitola môže byť aj tvoja.</p>
        </div>
        <Link className="btn" href="/registracia">Chcem hrať za KNV <span>↗</span></Link>
      </section>
    </>
  );
}
