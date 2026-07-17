'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { coachTeams, isParent, isPlayer, isStaff, useMe } from '@/lib/auth';
import { Card } from '@/components/ui';

interface EventItem {
  id: string;
  type: string;
  title: string;
  startAt: string;
  location: string | null;
  team: { name: string } | null;
  match: { id: string } | null;
}
interface Payment {
  periodLabel: string;
  amountCents: number;
  paidCents: number;
  status: string;
}

const typeLabels: Record<string, string> = {
  TRAINING: 'Tréning',
  MATCH: 'Zápas',
  TOURNAMENT: 'Turnaj',
  CLUB_EVENT: 'Podujatie',
};

export default function DashboardPage() {
  const { me } = useMe();
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    const from = new Date().toISOString();
    api<EventItem[]>(`/events?from=${from}`).then((l) => setEvents(l.slice(0, 8))).catch(() => {});
  }, []);

  const staff = isStaff(me);
  const teams = coachTeams(me);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-club-900">
          Vitajte{me ? `, ${me.firstName}` : ''}
        </h1>
        <p className="text-sm text-gray-500">
          {staff
            ? 'Prehľad klubu — členovia, platby a udalosti.'
            : teams.length > 0
              ? `Tréner družstiev: ${teams.map((t) => t.name).join(', ')}`
              : isParent(me)
                ? 'Prehľad vašich detí a klubu.'
                : 'Váš prehľad.'}
        </p>
      </div>

      {staff && <StaffTiles />}
      {isParent(me) && me && <ChildrenPayments children={me.children} />}
      {isPlayer(me) && me?.memberId && <MyPayments memberId={me.memberId} />}

      <section>
        <h2 className="mb-3 font-semibold text-club-800">Najbližšie udalosti</h2>
        {events.length === 0 ? (
          <Card className="text-sm text-gray-500">Zatiaľ žiadne naplánované udalosti.</Card>
        ) : (
          <ul className="divide-y divide-club-100 rounded-lg border border-club-100 bg-white">
            {events.map((e) => {
              const href = e.match ? `/portal/zapasy/${e.match.id}` : `/portal/dochadzka/${e.id}`;
              return (
                <li key={e.id}>
                  <Link href={href} className="flex items-center justify-between px-4 py-3 hover:bg-club-50">
                    <div>
                      <span className="mr-2 rounded bg-club-100 px-2 py-0.5 text-xs font-medium text-club-800">
                        {typeLabels[e.type] ?? e.type}
                        {e.team ? ` · ${e.team.name}` : ''}
                      </span>
                      <span className="font-medium">{e.title}</span>
                      {e.location && <span className="ml-2 text-sm text-gray-500">{e.location}</span>}
                    </div>
                    <time className="text-sm text-gray-600">
                      {new Date(e.startAt).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StaffTiles() {
  const [members, setMembers] = useState<number | null>(null);
  const [debtors, setDebtors] = useState<number | null>(null);
  useEffect(() => {
    api<unknown[]>('/members').then((m) => setMembers(m.length)).catch(() => {});
    api<unknown[]>('/finance/debtors').then((d) => setDebtors(d.length)).catch(() => {});
  }, []);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tile label="Aktívnych členov" value={members} href="/portal/clenovia" />
      <Tile label="Dlžníkov" value={debtors} href="/portal/platby" danger={!!debtors} />
      <Tile label="Registrácie" value={null} href="/portal/registracie" hint="Na schválenie" />
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  danger,
  hint,
}: {
  label: string;
  value: number | null;
  href: string;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-club-300">
        <div className={`text-3xl font-bold ${danger ? 'text-red-600' : 'text-club-700'}`}>
          {value ?? (hint ? '→' : '…')}
        </div>
        <div className="text-sm text-gray-500">{label}</div>
      </Card>
    </Link>
  );
}

function ChildrenPayments({ children }: { children: Array<{ id: string; firstName: string; lastName: string }> }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-club-800">Moje deti</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {children.map((c) => (
          <MyPayments key={c.id} memberId={c.id} name={`${c.firstName} ${c.lastName}`} />
        ))}
      </div>
    </section>
  );
}

function MyPayments({ memberId, name }: { memberId: string; name?: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    api<Payment[]>(`/finance/members/${memberId}/payments`)
      .then(setPayments)
      .catch(() => setError(true));
  }, [memberId]);

  const owed = payments.filter((p) => p.status !== 'PAID' && p.status !== 'WAIVED');
  return (
    <Card>
      {name && <p className="mb-2 font-semibold text-club-900">{name}</p>}
      {error ? (
        <p className="text-sm text-gray-500">Platby sa nepodarilo načítať.</p>
      ) : owed.length === 0 ? (
        <p className="text-sm text-club-700">Všetko uhradené ✓</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {owed.map((p) => (
            <li key={p.periodLabel} className="flex justify-between">
              <span className="text-gray-600">{p.periodLabel}</span>
              <span className={p.status === 'OVERDUE' ? 'font-semibold text-red-600' : 'text-amber-600'}>
                {((p.amountCents - p.paidCents) / 100).toFixed(2)} € {p.status === 'OVERDUE' ? '· po splatnosti' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
