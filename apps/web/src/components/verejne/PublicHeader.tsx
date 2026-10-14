'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  // Escape zatvorí menu a vráti fokus na tlačidlo.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <header>
      <Link className="brand" href="/">
        <Image src="/logo.png" alt="Erb FK Košická Nová Ves" width={42} height={67} priority />
        <span>FK KOŠICKÁ<br />NOVÁ VES<small>OD ROKU 1935</small></span>
      </Link>
      <button ref={toggleRef} type="button" className="mobile-toggle" aria-label="Hlavné menu" aria-expanded={open} aria-controls="hlavna-navigacia" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>
      <nav id="hlavna-navigacia" aria-label="Hlavná navigácia" className={open ? 'open' : ''} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        {PUBLIC_NAV.map((n) => {
          const active = isActive(path, n.href);
          return <Link key={n.href} href={n.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>{n.label}</Link>;
        })}
        <Link href="/portal" className="portal nav-portal">Klubový portál <span aria-hidden="true">↗</span></Link>
      </nav>
      <Link className="portal" href="/portal">Klubový portál <span aria-hidden="true">↗</span></Link>
    </header>
  );
}
