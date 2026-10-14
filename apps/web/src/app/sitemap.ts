import type { MetadataRoute } from 'next';
import { getArticles, getTeams } from '@/lib/verejne/public-api';
import { groupByCategory } from '@/lib/verejne/format';
import { SITE_URL } from '@/lib/verejne/site';

// Generuje sa pri požiadavke (API nemusí byť dostupné pri builde).
export const dynamic = 'force-dynamic';

const STATIC_ROUTES = [
  '/', '/muzstva', '/kalendar', '/klub', '/klub/historia', '/klub/funkcionari', '/klub/zverejnovanie', '/klub/kontakt', '/klub/podpora',
  '/novinky', '/galeria', '/klubovy-portal', '/registracia', '/podpora', '/dokumenty/ochrana-osobnych-udajov',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((p) => ({ url: `${SITE_URL}${p === '/' ? '' : p}` }));
  // Pri výpadku API (alebo jeho časti) ostanú aspoň statické trasy.
  const [teams, articles] = await Promise.allSettled([getTeams(), getArticles()]);
  if (teams.status === 'fulfilled') {
    for (const c of groupByCategory(teams.value.teams)) entries.push({ url: `${SITE_URL}/muzstva/${encodeURIComponent(c.code.toLowerCase())}` });
  }
  if (articles.status === 'fulfilled') {
    for (const a of articles.value) entries.push({ url: `${SITE_URL}/novinky/${encodeURIComponent(a.slug)}`, lastModified: new Date(a.publishedAt) });
  }
  return entries;
}
