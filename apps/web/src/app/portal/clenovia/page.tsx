'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

interface Guardian {
  user: { firstName: string; lastName: string; email: string; phone: string | null };
}
interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  status: string;
  futbalnetId?: string | null;
  healthNotes?: string | null;
  memberships: Array<{ team: { name: string; teamCategory: { code: string } } }>;
  guardians: Guardian[];
}
interface Team {
  id: string;
  name: string;
  teamCategory: { code: string };
}

function MembersTable() {
  const searchParams = useSearchParams();
  const { me } = useMe();
  const staff = isStaff(me);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamFilter, setTeamFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [creating, setCreating] = useState(false);

  const categoryParam = searchParams.get('category') ?? '';

  const load = useCallback(async () => {
    try {
      const parts: string[] = [];
      if (categoryParam) parts.push(`category=${categoryParam}`);
      if (teamFilter) parts.push(`team=${teamFilter}`);
      const q = parts.length ? `?${parts.join('&')}` : '';
      setMembers(await api<MemberRow[]>(`/members${q}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [categoryParam, teamFilter]);

  useEffect(() => {
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Družstvo:</label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">Všetky</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {staff && <Button onClick={() => setCreating(true)}>+ Nový člen</Button>}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-club-50 text-left text-club-800">
            <tr>
              <th className="px-4 py-3">Hráč</th>
              <th className="px-4 py-3">Ročník</th>
              <th className="px-4 py-3">Družstvo</th>
              <th className="px-4 py-3">Rodič / kontakt</th>
              <th className="px-4 py-3">Stav</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-club-100">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-medium">
                  {m.lastName} {m.firstName}
                </td>
                <td className="px-4 py-3">{new Date(m.birthDate).getFullYear()}</td>
                <td className="px-4 py-3">{m.memberships[0]?.team.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {m.guardians[0]
                    ? `${m.guardians[0].user.firstName} ${m.guardians[0].user.lastName} · ${m.guardians[0].user.email}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      m.status === 'ACTIVE'
                        ? 'rounded bg-club-100 px-2 py-0.5 text-xs text-club-800'
                        : 'rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600'
                    }
                  >
                    {m.status === 'ACTIVE' ? 'Aktívny' : m.status === 'GUEST' ? 'Hosť' : 'Neaktívny'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(m)} className="text-club-600 hover:underline">
                    Upraviť
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Žiadni členovia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <MemberModal
          member={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onDone={() => {
            setEditing(null);
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function MemberModal({
  member,
  onClose,
  onDone,
}: {
  member: MemberRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [firstName, setFirstName] = useState(member?.firstName ?? '');
  const [lastName, setLastName] = useState(member?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(member?.birthDate?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(member?.status ?? 'ACTIVE');
  const [futbalnetId, setFutbalnetId] = useState(member?.futbalnetId ?? '');
  const [healthNotes, setHealthNotes] = useState(member?.healthNotes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const body = JSON.stringify({
      firstName,
      lastName,
      birthDate,
      status,
      futbalnetId: futbalnetId || undefined,
      healthNotes: healthNotes || undefined,
    });
    try {
      if (member) await api(`/members/${member.id}`, { method: 'PATCH', body });
      else await api('/members', { method: 'POST', body });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={member ? 'Upraviť člena' : 'Nový člen'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Meno</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Priezvisko</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dátum narodenia</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Stav</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="ACTIVE">Aktívny</option>
              <option value="INACTIVE">Neaktívny</option>
              <option value="GUEST">Hosť</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Registračné číslo (futbalnet)</label>
          <input value={futbalnetId} onChange={(e) => setFutbalnetId(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Zdravotné poznámky</label>
          <textarea value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !firstName || !lastName || !birthDate}>
            {busy ? 'Ukladám…' : 'Uložiť'}
          </Button>
        </div>
      </div>
    </Modal>
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
