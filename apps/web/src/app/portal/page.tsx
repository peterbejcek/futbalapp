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
interface RegCard {
  id: string;
  firstName: string;
  lastName: string;
  registrationNumber: string | null;
  registrationValidUntil: string;
  team: string | null;
  daysLeft: number;
  expired: boolean;
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
      <RegistrationCards staff={staff} />
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

function RegistrationCards({ staff }: { staff: boolean }) {
  const [cards, setCards] = useState<RegCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<RegCard[]>('/members/registration-cards')
      .then(setCards)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || cards.length === 0) return null;

  const expiredCount = cards.filter((c) => c.expired).length;
  const soonCount = cards.filter((c) => !c.expired && c.daysLeft <= 30).length;
  // vedeniu/trénerovi zobraz najkritickejšie (max 12), sebe/deťom všetky
  const shown = staff ? cards.slice(0, 12) : cards;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-club-800">
          {staff ? 'Platnosť registračných preukazov' : 'Registračný preukaz'}
        </h2>
        {staff && (expiredCount > 0 || soonCount > 0) && (
          <span className="text-xs text-gray-500">
            {expiredCount > 0 && <span className="font-semibold text-red-600">{expiredCount} po platnosti</span>}
            {expiredCount > 0 && soonCount > 0 && ' · '}
            {soonCount > 0 && <span className="text-amber-600">{soonCount} do 30 dní</span>}
          </span>
        )}
      </div>
      <ul className="divide-y divide-club-100 rounded-lg border border-club-100 bg-white">
        {shown.map((c) => {
          const until = new Date(c.registrationValidUntil).toLocaleDateString('sk-SK');
          const badgeCls = c.expired
            ? 'bg-red-100 text-red-700'
            : c.daysLeft <= 30
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-600';
          return (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <span className="font-medium text-club-900">
                  {c.lastName} {c.firstName}
                </span>
                {staff && c.team && <span className="ml-2 text-xs text-gray-500">{c.team}</span>}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
                  {c.expired ? `po platnosti (${until})` : `do ${until}`}
                </span>
                {!c.expired && (
                  <span className="text-xs text-gray-400">
                    {c.daysLeft} {c.daysLeft === 1 ? 'deň' : c.daysLeft < 5 ? 'dni' : 'dní'}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {staff && cards.length > shown.length && (
        <p className="text-xs text-gray-500">
          Zobrazených {shown.length} z {cards.length}. Celý zoznam v{' '}
          <Link href="/portal/clenovia" className="text-club-600 hover:underline">
            Členovia
          </Link>
          .
        </p>
      )}
    </section>
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
