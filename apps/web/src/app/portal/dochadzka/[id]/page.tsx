'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Card } from '@/components/ui';

interface AttendanceRow {
  id: string;
  status: string;
  member: { id: string; firstName: string; lastName: string };
}
interface EventDetail {
  id: string;
  title: string;
  startAt: string;
  location: string | null;
  team: { name: string } | null;
  attendances: AttendanceRow[];
}

const STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED', 'INJURED'] as const;
const labels: Record<string, string> = {
  PRESENT: 'Prítomný',
  ABSENT: 'Neprítomný',
  EXCUSED: 'Ospravedlnený',
  INJURED: 'Zranený',
  UNKNOWN: '—',
};
const colors: Record<string, string> = {
  PRESENT: 'bg-club-600 text-white',
  ABSENT: 'bg-red-600 text-white',
  EXCUSED: 'bg-amber-500 text-white',
  INJURED: 'bg-purple-600 text-white',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEvent(await api<EventDetail>(`/events/${id}/attendance`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(row: AttendanceRow, status: string) {
    setEvent((prev) =>
      prev ? { ...prev, attendances: prev.attendances.map((a) => (a.id === row.id ? { ...a, status } : a)) } : prev,
    );
    await api(`/events/${id}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ memberId: row.member.id, status }),
    }).catch(() => load());
  }

  const present = event?.attendances.filter((a) => a.status === 'PRESENT').length ?? 0;

  return (
    <div className="space-y-5">
      <Link href="/portal/udalosti" className="text-sm text-club-600 hover:underline">
        ← Kalendár
      </Link>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {event && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-club-900">{event.title}</h1>
            <p className="text-sm text-gray-500">
              {event.team?.name} · {new Date(event.startAt).toLocaleString('sk-SK')} · Prítomní: {present}/
              {event.attendances.length}
            </p>
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-club-100">
              {event.attendances.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">
                    {row.member.lastName} {row.member.firstName}
                  </span>
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(row, s)}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          row.status === s ? colors[s] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {labels[s]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
              {event.attendances.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-500">
                  Žiadni hráči — družstvo zatiaľ nemá priradených členov.
                </li>
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
