'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Debtor {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    guardians: Array<{ user: { email: string; phone: string | null } }>;
    memberships: Array<{ teamCategory: { code: string } }>;
  };
  owedCents: number;
  periods: string[];
}

export default function PaymentsPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Debtor[]>('/finance/debtors')
      .then(setDebtors)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-club-900">Platby — dlžníci</h1>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!error && debtors.length === 0 && (
        <p className="rounded-lg border border-club-100 bg-white p-6 text-sm text-gray-500">
          Žiadne členské po splatnosti. 🎉
        </p>
      )}
      {debtors.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-club-50 text-left text-club-800">
              <tr>
                <th className="px-4 py-3">Hráč</th>
                <th className="px-4 py-3">Kategória</th>
                <th className="px-4 py-3">Kontakt na rodiča</th>
                <th className="px-4 py-3">Nezaplatené obdobia</th>
                <th className="px-4 py-3 text-right">Dlh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-club-100">
              {debtors.map((debtor) => (
                <tr key={debtor.member.id}>
                  <td className="px-4 py-3 font-medium">
                    {debtor.member.lastName} {debtor.member.firstName}
                  </td>
                  <td className="px-4 py-3">{debtor.member.memberships[0]?.teamCategory.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{debtor.member.guardians[0]?.user.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{debtor.periods.join(', ')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">
                    {(debtor.owedCents / 100).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
