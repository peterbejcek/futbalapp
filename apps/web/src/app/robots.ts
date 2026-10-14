import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/verejne/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/portal', '/prihlasenie', '/reset-hesla'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
