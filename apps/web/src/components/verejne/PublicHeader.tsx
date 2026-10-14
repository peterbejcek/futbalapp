'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export const PUBLIC_NAV = [
  { href: '/', label: 'Domov' },
  { href: '/muzstva', label: 'Mužstvá' },
  { href: '/kalendar', label: 'Zápasy & tréningy' },
  { href: '/klub', label: 'Klub' },
  { href: '/novinky', label: 'Novinky' },
  { href: '/galeria', label: 'Galéria' },
];

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

export default function PublicHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <header>
      <Link className="brand" href="/">
        <Image src="/logo.png" alt="Erb FK Košická Nová Ves" width={42} height={67} priority />
        <span>FK KOŠICKÁ<br />NOVÁ VES<small>OD ROKU 1935</small></span>
      </Link>
      <button className="mobile-toggle" aria-label="Otvoriť menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>☰</button>
      <nav aria-label="Hlavná navigácia" className={open ? 'open' : ''}>
        {PUBLIC_NAV.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(path, n.href) ? 'active' : ''}>{n.label}</Link>
        ))}
        <Link href="/portal" className="portal nav-portal">Klubový portál <span>↗</span></Link>
      </nav>
      <Link className="portal" href="/portal">Klubový portál <span>↗</span></Link>
    </header>
  );
}
