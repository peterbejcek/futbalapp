import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { CSSProperties } from 'react';
import './public.css';
import PublicHeader from '@/components/verejne/PublicHeader';
import PublicFooter from '@/components/verejne/PublicFooter';

const body = Barlow({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });
const head = Barlow_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700', '800', '900'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'FK Košická Nová Ves — Naša štvrť. Náš futbal.', template: '%s · FK Košická Nová Ves' },
  description: 'FK Košická Nová Ves: mužstvá, zápasy, tréningy a príbeh klubu od roku 1935.',
};

/** Verejný web. Všetky štýly sú scoped pod `.fk-pub` (public.css), takže neovplyvnia portál. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const fonts = { '--head': `${head.style.fontFamily}, 'Arial Narrow', Impact, sans-serif`, '--body': `${body.style.fontFamily}, Arial, sans-serif` } as CSSProperties;
  return (
    <div className="fk-pub" style={fonts}>
      <PublicHeader />
      <main id="app">{children}</main>
      <PublicFooter />
    </div>
  );
}
