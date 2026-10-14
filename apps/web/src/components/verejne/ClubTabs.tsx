'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/klub', label: 'O klube' },
  { href: '/klub/historia', label: 'História' },
  { href: '/klub/funkcionari', label: 'Funkcionári a tréneri' },
  { href: '/klub/zverejnovanie', label: 'Zverejňovanie' },
  { href: '/klub/kontakt', label: 'Kontakt' },
];

export default function ClubTabs() {
  const path = usePathname().replace(/\/$/, '') || '/';
  return (
    <nav className="club-tabs" aria-label="Sekcie klubu">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''} aria-current={path === t.href ? 'page' : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
