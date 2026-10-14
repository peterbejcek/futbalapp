import type { Metadata } from 'next';
import { SITE_NAME } from './site';

const LOGO = { url: '/logo.png', width: 250, height: 400, alt: 'Erb FK Košická Nová Ves' };

/**
 * Spoločné SEO metadáta verejnej stránky. `title` sa v <title> doplní šablónou layoutu;
 * openGraph/twitter dostanú plný názov (nededia sa z layoutu, preto ich skladáme tu).
 * `path` je relatívna cesta (resolvuje sa cez metadataBase).
 */
export function pageMeta(opts: { title: string; description: string; path: string; type?: 'website' | 'article'; publishedTime?: string }): Metadata {
  const full = `${opts.title} · ${SITE_NAME}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: full,
      description: opts.description,
      url: opts.path,
      siteName: SITE_NAME,
      locale: 'sk_SK',
      type: opts.type ?? 'website',
      ...(opts.type === 'article' && opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      images: [LOGO],
    },
    twitter: { card: 'summary', title: full, description: opts.description, images: [LOGO.url] },
  };
}
