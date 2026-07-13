'use client';

import { useEffect, useState } from 'react';
import { API_URL, api, getToken } from '@/lib/api';

interface Me {
  roles: Array<{ role: string }>;
  children: Array<{ id: string; firstName: string; lastName: string }>;
}

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
}

export default function SportAllowancePage() {
  const [children, setChildren] = useState<MemberRow[]>([]);
  const [memberId, setMemberId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api<Me>('/auth/me')
      .then(async (me) => {
        const isStaff = me.roles.some((r) => r.role === 'ADMIN' || r.role === 'MANAGER');
        // vedenie vyberá z celého adresára, rodič zo svojich detí
        const list = isStaff ? await api<MemberRow[]>('/members') : me.children;
        setChildren(list);
        if (list.length > 0) setMemberId(list[0]!.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function download() {
    if (!memberId) return;
    setError(null);
    setDownloading(true);
    try {
      const response = await fetch(
        `${API_URL}/reports/sport-allowance/${memberId}?from=${year}-01&to=${year}-12`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? `Chyba servera (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sportovy-prispevok-${year}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stiahnutie zlyhalo');
    } finally {
      setDownloading(false);
    }
  }

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-club-900">Športový príspevok</h1>
      <div className="max-w-xl rounded-lg border border-club-100 bg-white p-6">
        <p className="text-sm text-gray-600">
          Stiahnite si potvrdenie o zaplatených členských poplatkoch — podklad pre príspevok na športovú
          činnosť dieťaťa od zamestnávateľa (§ 152b Zákonníka práce).
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dieťa / člen</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none"
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.lastName} {child.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rok</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={download}
            disabled={downloading || !memberId}
            className="w-full rounded-md bg-club-600 px-4 py-2 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
          >
            {downloading ? 'Generujem PDF…' : 'Stiahnuť potvrdenie (PDF)'}
          </button>
        </div>
      </div>
    </div>
  );
}
