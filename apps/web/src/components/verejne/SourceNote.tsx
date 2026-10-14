import type { ReactNode } from 'react';
import { CLUB_WEB } from '@/lib/verejne/site';

export const CLUB_BASE = CLUB_WEB;

/** Externý odkaz (nová karta, bez referrera) s oznamom pre čítačky obrazovky. */
export function ExtLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener">
      {children}
      <span className="sr-only"> (otvorí sa v novom okne)</span>
    </a>
  );
}
