'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  status: string;
  memberships: Array<{ teamCategory: { code: string } }>;
  guardians: Array<{ user: { firstName: string; lastName: string; email: string; phone: string | null } }>;
}

function MembersTable() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') ?? '';
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = category ? `?category=${category}` : '';
    api<MemberRow[]>(`/members${query}`)
      .then(setMembers)
      .catch((e) => setError(e.message));
  }, [category]);

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-club-50 text-left text-club-800">
          <tr>
            <th className="px-4 py-3">Hráč</th>
            <th className="px-4 py-3">Ročník</th>
            <th className="px-4 py-3">Kategória</th>
            <th className="px-4 py-3">Rodič / kontakt</th>
            <th className="px-4 py-3">Stav</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-club-100">
          {members.map((member) => (
            <tr key={member.id}>
              <td className="px-4 py-3 font-medium">
                {member.lastName} {member.firstName}
              </td>
              <td className="px-4 py-3">{new Date(member.birthDate).getFullYear()}</td>
              <td className="px-4 py-3">{member.memberships[0]?.teamCategory.code ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">
                {member.guardians[0]
                  ? `${member.guardians[0].user.firstName} ${member.guardians[0].user.lastName} · ${member.guardians[0].user.email}`
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    member.status === 'ACTIVE'
                      ? 'rounded bg-club-100 px-2 py-0.5 text-xs text-club-800'
                      : 'rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600'
                  }
                >
                  {member.status === 'ACTIVE' ? 'Aktívny' : member.status === 'GUEST' ? 'Hosť' : 'Neaktívny'}
                </span>
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                Žiadni členovia{category ? ` v kategórii ${category}` : ''}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-club-900">Členovia</h1>
      <Suspense>
        <MembersTable />
      </Suspense>
    </div>
  );
}
