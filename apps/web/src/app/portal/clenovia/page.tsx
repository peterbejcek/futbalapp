'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { isAdmin, isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

interface Guardian {
  user: { firstName: string; lastName: string; email: string; phone: string | null };
}
interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  status: string;
  futbalnetId?: string | null;
  healthNotes?: string | null;
  memberships: Array<{ team: { id: string; name: string; teamCategory: { code: string } } }>;
  user: { id: string; email: string; roles: Array<{ role: string; teamId: string | null }> } | null;
  guardians: Guardian[];
}
interface Team {
  id: string;
  name: string;
  teamCategory: { code: string };
}

const ROLE_LABELS: Record<string, string> = {
  PLAYER: 'Hráč',
  PARENT: 'Rodič',
  COACH: 'Tréner',
  MANAGER: 'Vedúci klubu',
  ADMIN: 'Admin',
};

/** Funkcia člena z rolí konta; hráč bez konta = Hráč podľa družstva. */
function memberFunctions(m: MemberRow): string[] {
  const roles = m.user?.roles.map((r) => r.role) ?? [];
  const labels = roles.map((r) => ROLE_LABELS[r] ?? r);
  if (labels.length === 0 && m.memberships.length > 0) return ['Hráč'];
  return labels.length ? labels : ['—'];
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
              <th className="px-4 py-3">Meno</th>
              <th className="px-4 py-3">Funkcia</th>
              <th className="px-4 py-3">Ročník</th>
              <th className="px-4 py-3">Družstvo</th>
              <th className="px-4 py-3">Konto</th>
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
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {memberFunctions(m).map((f, i) => (
                      <span key={i} className="rounded bg-club-100 px-1.5 py-0.5 text-xs text-club-800">
                        {f}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3">{m.birthDate ? new Date(m.birthDate).getFullYear() : '—'}</td>
                <td className="px-4 py-3">{m.memberships[0]?.team.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{m.user?.email ?? '—'}</td>
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
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
          teams={teams}
          canGrantAdmin={isAdmin(me)}
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

const ROLE_OPTIONS: Array<{ value: string; label: string; adminOnly?: boolean }> = [
  { value: 'PLAYER', label: 'Hráč' },
  { value: 'PARENT', label: 'Rodič' },
  { value: 'COACH', label: 'Tréner' },
  { value: 'MANAGER', label: 'Vedúci klubu', adminOnly: true },
  { value: 'ADMIN', label: 'Admin', adminOnly: true },
];

function MemberModal({
  member,
  teams,
  canGrantAdmin,
  onClose,
  onDone,
}: {
  member: MemberRow | null;
  teams: Team[];
  canGrantAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [firstName, setFirstName] = useState(member?.firstName ?? '');
  const [lastName, setLastName] = useState(member?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(member?.birthDate?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(member?.status ?? 'ACTIVE');
  const [futbalnetId, setFutbalnetId] = useState(member?.futbalnetId ?? '');
  const [healthNotes, setHealthNotes] = useState(member?.healthNotes ?? '');
  const [teamId, setTeamId] = useState(member?.memberships[0]?.team.id ?? '');
  const [roles, setRoles] = useState<string[]>(member?.user?.roles.map((r) => r.role) ?? []);
  const [email, setEmail] = useState(member?.user?.email ?? '');
  const [createAccount, setCreateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const hasAccount = !!member?.user;

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const wantAccount = hasAccount || createAccount;
    const body = JSON.stringify({
      firstName,
      lastName,
      birthDate: birthDate || undefined,
      status,
      futbalnetId: futbalnetId || undefined,
      healthNotes: healthNotes || undefined,
      teamId: teamId || undefined,
      roles: roles.length ? roles : undefined,
      account: wantAccount && email ? { email } : undefined,
    });
    try {
      const res = member
        ? await api<{ account: { tempPassword: string | null } | null }>(`/members/${member.id}`, { method: 'PATCH', body })
        : await api<{ account: { tempPassword: string | null } | null }>('/members', { method: 'POST', body });
      if (res.account?.tempPassword) {
        setTempPassword(res.account.tempPassword);
      } else {
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  // po vytvorení konta zobrazíme dočasné heslo (na odovzdanie), potom zavrieme
  if (tempPassword) {
    return (
      <Modal open onClose={onDone} title="Konto vytvorené">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Konto pre <strong>{email}</strong> bolo vytvorené. Odovzdajte používateľovi toto dočasné heslo — po
            prihlásení si ho môže zmeniť:
          </p>
          <div className="rounded-md border border-club-200 bg-club-50 p-4 text-center">
            <code className="text-lg font-bold tracking-wider text-club-800">{tempPassword}</code>
          </div>
          <p className="text-xs text-gray-500">Heslo sa zobrazí len teraz — poznačte si ho.</p>
          <div className="flex justify-end">
            <Button onClick={onDone}>Hotovo</Button>
          </div>
        </div>
      </Modal>
    );
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
            <p className="mt-1 text-xs text-gray-500">Pri hráčoch určuje vekovú kategóriu.</p>
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

        {/* Zaradenie do družstva (manuálne, prepíše automatické podľa veku) */}
        <div>
          <label className={labelCls}>Družstvo / skupina</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputCls}>
            <option value="">— nezaradený —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Ručné zaradenie prepíše automatické podľa veku.</p>
        </div>

        {/* Funkcia / roly */}
        <div>
          <label className={labelCls}>Funkcia / rola</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {ROLE_OPTIONS.filter((o) => !o.adminOnly || canGrantAdmin).map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                  roles.includes(o.value) ? 'border-club-600 bg-club-600 text-white' : 'border-gray-300 text-gray-700'
                }`}
              >
                <input type="checkbox" className="hidden" checked={roles.includes(o.value)} onChange={() => toggleRole(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {/* Konto na prihlásenie */}
        <div className="rounded-md bg-club-50 p-3">
          {hasAccount ? (
            <>
              <label className={labelCls}>Prihlasovací e-mail</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <p className="mt-1 text-xs text-gray-500">Konto už existuje. Zmena rolí sa uloží.</p>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
                Vytvoriť prihlasovacie konto
              </label>
              {createAccount && (
                <div className="mt-2">
                  <label className={labelCls}>E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="meno@email.sk" />
                  <p className="mt-1 text-xs text-gray-500">Vygeneruje sa dočasné heslo, ktoré zobrazíme na odovzdanie.</p>
                </div>
              )}
            </>
          )}
        </div>

        <details>
          <summary className="cursor-pointer text-sm text-gray-500">Ďalšie údaje</summary>
          <div className="mt-2 space-y-3">
            <div>
              <label className={labelCls}>Registračné číslo (futbalnet)</label>
              <input value={futbalnetId} onChange={(e) => setFutbalnetId(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Zdravotné poznámky</label>
              <textarea value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>
        </details>

        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !firstName || !lastName}>
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
