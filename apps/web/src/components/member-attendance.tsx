'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorText } from '@/components/ui';

interface Item {
  eventId: string;
  type: 'TRAINING' | 'MATCH';
  title: string;
  team: string | null;
  startAt: string;
  status: string;
}
interface Data {
  items: Item[];
  summary: Record<string, number>;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: 'Prítomný', cls: 'bg-club-600 text-white' },
  ABSENT: { label: 'Neprítomný', cls: 'bg-red-600 text-white' },
  EXCUSED: { label: 'Ospravedlnený', cls: 'bg-amber-500 text-white' },
  SICK: { label: 'Chorý', cls: 'bg-teal-600 text-white' },
  INJURED: { label: 'Zranený', cls: 'bg-purple-600 text-white' },
  UNKNOWN: { label: '—', cls: 'bg-gray-100 text-gray-500' },
};
const ORDER = ['PRESENT', 'ABSENT', 'EXCUSED', 'SICK', 'INJURED'];

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

/** Dochádzka hráča na tréningoch a zápasoch (karta hráča) — kompaktný prehľad. */
export function MemberAttendancePanel({ memberId }: { memberId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    api<Data>(`/members/${memberId}/attendance`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie dochádzky zlyhalo'));
  }, [memberId]);

  const rate = useMemo(() => {
    if (!data) return null;
    const total = Object.values(data.summary).reduce((a, b) => a + b, 0);
    return total ? Math.round(((data.summary.PRESENT ?? 0) / total) * 100) : null;
  }, [data]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <p className="text-xs text-gray-500">Načítavam…</p>;
  if (data.items.length === 0) return <p className="text-xs text-gray-500">Zatiaľ žiadna dochádzka.</p>;

  const shown = all ? data.items : data.items.slice(0, 15);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {rate != null && (
          <span className="rounded bg-club-50 px-2 py-1 font-semibold text-club-800">Účasť {rate}%</span>
        )}
        {ORDER.filter((s) => data.summary[s]).map((s) => (
          <span key={s} className={`rounded px-2 py-1 font-semibold ${STATUS[s]!.cls}`}>
            {STATUS[s]!.label}: {data.summary[s]}
          </span>
        ))}
      </div>
      <table className="w-full border-collapse">
        <tbody className="divide-y divide-club-100">
          {shown.map((i) => (
            <tr key={i.eventId}>
              <td className="whitespace-nowrap py-1 pr-2 text-gray-500">{fmt(i.startAt)}</td>
              <td className="py-1 pr-2">
                {i.type === 'MATCH' ? '⚽ ' : ''}
                {i.title}
              </td>
              <td className="py-1 text-right">
                <span className={`rounded px-1.5 py-0.5 font-medium ${(STATUS[i.status] ?? STATUS.UNKNOWN)!.cls}`}>
                  {(STATUS[i.status] ?? STATUS.UNKNOWN)!.label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.items.length > 15 && (
        <button onClick={() => setAll(!all)} className="text-club-600 hover:underline">
          {all ? 'Zobraziť menej' : `Zobraziť všetko (${data.items.length})`}
        </button>
      )}
    </div>
  );
}
