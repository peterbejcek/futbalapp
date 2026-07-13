import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FK Košická Nová Ves — klubový portál',
  description: 'Portál FK Košická Nová Ves: členovia, platby, tréningy, zápasy a komunikácia na jednom mieste.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
