import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { CSSProperties } from 'react';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';

const body = Barlow({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });
const head = Barlow_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700', '800', '900'], display: 'swap' });

export const metadata: Metadata = {
  title: 'FK Košická Nová Ves — klubový portál',
  description: 'Portál FK Košická Nová Ves: členovia, platby, tréningy, zápasy a komunikácia na jednom mieste.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className="fk-app" style={{ '--body-font': body.style.fontFamily, '--head-font': head.style.fontFamily } as CSSProperties}>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
