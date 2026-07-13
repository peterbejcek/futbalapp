'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';

interface Me {
  firstName: string;
  lastName: string;
  roles: Array<{ role: string; teamCategory: { code: string } | null }>;
}

const navigation = [
  { href: '/portal', label: 'Prehľad' },
  { href: '/portal/clenovia', label: 'Členovia' },
  { href: '/portal/platby', label: 'Platby' },
  { href: '/portal/chat', label: 'Komunikácia' },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/prihlasenie');
      return;
    }
    api<Me>('/auth/me').then(setMe).catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen bg-club-50">
      <header className="bg-club-800 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="font-semibold">
              FKKNV portál
            </Link>
            <nav className="flex gap-4 text-sm">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={pathname === item.href ? 'font-semibold text-white' : 'text-club-200 hover:text-white'}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {me && (
              <span className="text-club-100">
                {me.firstName} {me.lastName}
              </span>
            )}
            <button
              onClick={() => {
                setToken(null);
                router.push('/prihlasenie');
              }}
              className="rounded border border-club-400 px-3 py-1 text-club-100 hover:bg-club-700"
            >
              Odhlásiť
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
