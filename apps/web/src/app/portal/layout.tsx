'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';
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
  { href: '/portal/tabulka', label: 'Tabuľka', show: () => true },
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
  const [pendingRegs, setPendingRegs] = useState(0);

  useEffect(() => {
    if (!getToken()) router.replace('/prihlasenie');
  }, [router]);

  const staff = isStaff(me);
  // počet nevybavených registrácií — na zvýraznenie položky menu
  useEffect(() => {
    if (!staff) return;
    api<Array<{ id: string }>>('/registration/pending')
      .then((r) => setPendingRegs(r.length))
      .catch(() => {});
  }, [staff, pathname]);

  const ctx = { staff, manage: canManage(me) };
  const items = navigation.filter((item) => item.show(ctx));

  return (
    <div className="min-h-screen bg-club-50">
      <header className="bg-club-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/portal" className="flex items-center gap-2 font-semibold">
              <Image src="/logo.png" alt="FKKNV" width={24} height={38} className="h-8 w-auto" />
              FKKNV portál
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              {items.map((item) => {
                const highlightRegs = item.href === '/portal/registracie' && pendingRegs > 0;
                if (highlightRegs) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex items-center gap-1 rounded-full bg-brandred-500 px-3 py-0.5 font-semibold text-white shadow-sm hover:bg-brandred-600"
                    >
                      {item.label}
                      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-brandred-600">
                        {pendingRegs}
                      </span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      pathname === item.href ? 'font-semibold text-white' : 'text-club-200 hover:text-white'
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {me && (
              <Link href="/portal/heslo" className="text-club-100 hover:text-white" title="Zmena hesla">
                {me.firstName} {me.lastName}
              </Link>
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
