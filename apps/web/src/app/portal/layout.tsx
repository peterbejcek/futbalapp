'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getToken, setToken } from '@/lib/api';
import { canManage, isStaff, useMe } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  show: (ctx: { staff: boolean; manage: boolean }) => boolean;
}

const navigation: NavItem[] = [
  { href: '/portal', label: 'Prehľad', show: () => true },
  { href: '/portal/clenovia', label: 'Členovia', show: ({ manage }) => manage },
  { href: '/portal/udalosti', label: 'Kalendár', show: () => true },
  { href: '/portal/platby', label: 'Platby', show: ({ staff }) => staff },
  { href: '/portal/registracie', label: 'Registrácie', show: ({ staff }) => staff },
  { href: '/portal/chat', label: 'Komunikácia', show: () => true },
  { href: '/portal/prispevok', label: 'Príspevok', show: () => true },
  { href: '/portal/nastavenia', label: 'Nastavenia', show: ({ staff }) => staff },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useMe();

  useEffect(() => {
    if (!getToken()) router.replace('/prihlasenie');
  }, [router]);

  const ctx = { staff: isStaff(me), manage: canManage(me) };
  const items = navigation.filter((item) => item.show(ctx));

  return (
    <div className="min-h-screen bg-club-50">
      <header className="bg-club-800 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/portal" className="font-semibold">
              FKKNV portál
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    pathname === item.href ? 'font-semibold text-white' : 'text-club-200 hover:text-white'
                  }
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
