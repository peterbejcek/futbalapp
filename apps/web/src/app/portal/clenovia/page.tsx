'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, apiUpload, API_URL } from '@/lib/api';
import { categoryColor } from '@fkknv/shared';
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
  registrationNumber?: string | null;
  healthNotes?: string | null;
  photoUrl?: string | null;
  socialCase?: boolean;
  licenseLevel?: string | null;
  registrationValidUntil?: string | null;
  homeClub?: string | null;
  guestClub?: string | null;
  clubAffiliation?: string | null;
  memberships: Array<{ team: { id: string; name: string; teamCategory: { code: string } } }>;
  user: { id: string; email: string; roles: Array<{ role: string; teamId: string | null }> } | null;
  guardians: Guardian[];
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  items: Array<{ name: string; action: 'created' | 'updated' | 'unchanged'; registrationValidUntil: string | null }>;
}

/** Farebné zvýraznenie platnosti preukazu: po platnosti / do 30 dní / ok. */
function cardBadge(iso: string | null | undefined) {
  if (!iso) return null;
  const until = new Date(iso);
  const days = Math.ceil((until.getTime() - Date.now()) / 86400000);
  const cls =
    days < 0
      ? 'bg-red-100 text-red-700'
      : days <= 30
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600';
  return { text: until.toLocaleDateString('sk-SK'), cls, expired: days < 0, days };
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

/** Odstráni diakritiku a zjednotí veľkosť písmen — pre vyhľadávanie. */
function stripDia(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

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
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [hideInactive, setHideInactive] = useState(false);
  const [sortBy, setSortBy] = useState<'lastName' | 'team' | 'card'>('lastName');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const categoryParam = searchParams.get('category') ?? '';

  const load = useCallback(async () => {
    try {
      const parts: string[] = [];
      if (categoryParam) parts.push(`category=${categoryParam}`);
      if (teamFilter) parts.push(`team=${teamFilter}`);
      if (roleFilter) parts.push(`role=${roleFilter}`);
      if (hideInactive) parts.push('hideInactive=true');
      const q = parts.length ? `?${parts.join('&')}` : '';
      setMembers(await api<MemberRow[]>(`/members${q}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [categoryParam, teamFilter, roleFilter, hideInactive]);

  // klientské vyhľadávanie podľa priezviska (bez ohľadu na diakritiku/veľkosť písmen)
  const searchNorm = stripDia(search).trim();
  const filteredMembers = searchNorm
    ? members.filter((m) => stripDia(m.lastName).includes(searchNorm))
    : members;

  // klientské zoradenie (priezvisko / družstvo / platnosť preukazu)
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (sortBy === 'team') {
      const ta = a.memberships[0]?.team.name ?? '';
      const tb = b.memberships[0]?.team.name ?? '';
      if (ta !== tb) return ta === '' ? 1 : tb === '' ? -1 : ta.localeCompare(tb, 'sk');
    } else if (sortBy === 'card') {
      const va = a.registrationValidUntil ? new Date(a.registrationValidUntil).getTime() : Infinity;
      const vb = b.registrationValidUntil ? new Date(b.registrationValidUntil).getTime() : Infinity;
      if (va !== vb) return va - vb; // najskôr končiaca platnosť hore, bez preukazu dole
    }
    // sekundárne (a primárne pre 'lastName') podľa priezviska, potom mena — slovenská abeceda
    return a.lastName.localeCompare(b.lastName, 'sk') || a.firstName.localeCompare(b.firstName, 'sk');
  });

  // klientská stránkovanie (pageSize === 0 znamená „Všetky")
  const total = sortedMembers.length;
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedMembers =
    pageSize === 0 ? sortedMembers : sortedMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  useEffect(() => {
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // po zmene filtrov/zoradenia/veľkosti sa vráť na prvú stranu
  useEffect(() => {
    setPage(1);
  }, [teamFilter, roleFilter, search, hideInactive, sortBy, pageSize, categoryParam]);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // umožní znovu vybrať ten istý súbor
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const res = await apiUpload<ImportResult>('/members/import', file);
      setImportResult(res);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import zlyhal');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Hľadať:</label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Priezvisko…"
                className="w-44 rounded-md border border-gray-300 px-2 py-1 pr-6 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Vymazať"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
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
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Funkcia:</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
              <option value="">Všetky</option>
              <option value="PLAYER">Hráč</option>
              <option value="PARENT">Rodič</option>
              <option value="COACH">Tréner</option>
              <option value="MANAGER">Vedúci klubu</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Zoradiť:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'lastName' | 'team' | 'card')}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="lastName">Priezvisko</option>
              <option value="team">Družstvo</option>
              <option value="card">Platnosť preukazu</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Na stránku:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>Všetky</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
            Skryť neaktívnych
          </label>
        </div>
        {staff && (
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onImportFile}
              className="hidden"
            />
            <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? 'Importujem…' : '⬆ Import z Excelu'}
            </Button>
            <Button onClick={() => setCreating(true)}>+ Nový člen</Button>
          </div>
        )}
      </div>

      {importResult && (
        <Card className="border-club-300 bg-club-50">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-club-900">
                Import dokončený: {importResult.created} pridaných, {importResult.updated} aktualizovaných,
                {' '}{importResult.unchanged} bez zmeny (spolu {importResult.total}).
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Hráči sa zaradili do družstva podľa ročníka (ručné výnimky ostávajú). Existujúci sa spárovali podľa
                registračného čísla (inak mena a dátumu narodenia) a len aktualizovali — duplicity nevznikajú.
                Prihlasovacie kontá doplníte cez „Upraviť" (e-mail).
              </p>
            </div>
            <button onClick={() => setImportResult(null)} className="text-sm text-club-600 hover:underline">
              Zavrieť
            </button>
          </div>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-club-50 text-left text-club-800">
            <tr>
              <th className="sticky left-0 z-20 whitespace-nowrap bg-club-50 px-3 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Meno</th>
              <th className="whitespace-nowrap px-3 py-2">Funkcia</th>
              <th className="whitespace-nowrap px-3 py-2">Ročník</th>
              <th className="whitespace-nowrap px-3 py-2">Reg. číslo</th>
              <th className="whitespace-nowrap px-3 py-2">Družstvo</th>
              <th className="whitespace-nowrap px-3 py-2">Materský klub</th>
              <th className="whitespace-nowrap px-3 py-2">Hosťujúci klub</th>
              <th className="whitespace-nowrap px-3 py-2">Klub. príslušnosť</th>
              <th className="whitespace-nowrap px-3 py-2">Preukaz do</th>
              <th className="whitespace-nowrap px-3 py-2">Konto</th>
              <th className="sticky right-0 z-20 whitespace-nowrap bg-club-50 px-3 py-2 text-right shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.15)]">Stav / akcie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-club-100">
            {pagedMembers.map((m) => (
              <tr key={m.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  {m.lastName} {m.firstName}
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {memberFunctions(m).map((f, i) => {
                      const cat = m.memberships[0]?.team.teamCategory.code;
                      const style =
                        f === 'Hráč' && cat
                          ? { backgroundColor: categoryColor(cat).bg, color: categoryColor(cat).text }
                          : undefined;
                      return (
                        <span
                          key={i}
                          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${style ? '' : 'bg-club-100 text-club-800'}`}
                          style={style}
                        >
                          {f}
                        </span>
                      );
                    })}
                  </span>
                </td>
                <td className="px-3 py-2">{m.birthDate ? new Date(m.birthDate).getFullYear() : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-club-800">{m.registrationNumber ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {(() => {
                    const names = [
                      ...new Set([
                        ...m.memberships.map((ms) => ms.team.name),
                        ...((m.user?.roles ?? [])
                          .filter((r) => r.role === 'COACH' && r.teamId)
                          .map((r) => teamNameById.get(r.teamId as string))
                          .filter(Boolean) as string[]),
                      ]),
                    ];
                    return names.length ? names.join(', ') : '—';
                  })()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{m.homeClub ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{m.guestClub ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{m.clubAffiliation ?? '—'}</td>
                <td className="px-3 py-2">
                  {(() => {
                    const b = cardBadge(m.registrationValidUntil);
                    return b ? (
                      <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${b.cls}`}>
                        {b.text}
                        {b.expired ? ' · po pl.' : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    );
                  })()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{m.user?.email ?? '—'}</td>
                <td className="sticky right-0 z-10 bg-white px-3 py-2 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${
                        m.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : m.status === 'GUEST'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {m.status === 'ACTIVE' ? 'Aktívny' : m.status === 'GUEST' ? 'Hosť' : 'Neaktívny'}
                    </span>
                    <button onClick={() => setEditing(m)} className="whitespace-nowrap text-club-600 hover:underline">
                      {staff ? 'Upraviť' : 'Detail'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pagedMembers.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  {members.length === 0 ? 'Žiadni členovia.' : 'Pre zadané priezvisko sa nič nenašlo.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {pageSize === 0
              ? `Zobrazených všetkých ${total}`
              : `Zobrazené ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} z ${total}`}
          </span>
          {pageSize !== 0 && pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                ‹ Predošlá
              </Button>
              <span className="whitespace-nowrap">
                Strana {currentPage} / {pageCount}
              </span>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
              >
                Ďalšia ›
              </Button>
            </div>
          )}
        </div>
      )}

      {(editing || creating) && (
        <MemberModal
          member={editing}
          teams={teams}
          canGrantAdmin={isAdmin(me)}
          staff={staff}
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
  staff,
  onClose,
  onDone,
}: {
  member: MemberRow | null;
  teams: Team[];
  canGrantAdmin: boolean;
  staff: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [firstName, setFirstName] = useState(member?.firstName ?? '');
  const [lastName, setLastName] = useState(member?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(member?.birthDate?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(member?.status ?? 'ACTIVE');
  const [registrationNumber, setRegistrationNumber] = useState(member?.registrationNumber ?? '');
  const [registrationValidUntil, setRegistrationValidUntil] = useState(
    member?.registrationValidUntil?.slice(0, 10) ?? '',
  );
  const [socialCase, setSocialCase] = useState(member?.socialCase ?? false);
  const [licenseLevel, setLicenseLevel] = useState(member?.licenseLevel ?? '');
  const [healthNotes, setHealthNotes] = useState(member?.healthNotes ?? '');
  const [teamIds, setTeamIds] = useState<string[]>(() => {
    const fromMemberships = member?.memberships.map((m) => m.team.id) ?? [];
    // tréner: jeho družstvá sú scope na konte (COACH rola s teamId), nie hráčske zaradenie
    const fromCoach =
      member?.user?.roles.filter((r) => r.role === 'COACH' && r.teamId).map((r) => r.teamId as string) ?? [];
    return [...new Set([...fromMemberships, ...fromCoach])];
  });
  const [homeClub, setHomeClub] = useState(member?.homeClub ?? '');
  const [guestClub, setGuestClub] = useState(member?.guestClub ?? '');
  const [clubAffiliation, setClubAffiliation] = useState(member?.clubAffiliation ?? '');
  const [roles, setRoles] = useState<string[]>(() => {
    const r = member?.user?.roles.map((x) => x.role) ?? [];
    // hráč bez explicitných rolí (má zaradenie do skupiny) → zvýrazni Hráč
    if (r.length === 0 && (member?.memberships.length ?? 0) > 0) return ['PLAYER'];
    return r;
  });
  const [email, setEmail] = useState(member?.user?.email ?? '');
  const [createAccount, setCreateAccount] = useState(false);
  const [childMemberIds, setChildMemberIds] = useState<string[]>([]);
  const [childSearch, setChildSearch] = useState('');
  const [players, setPlayers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [photoVer, setPhotoVer] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);

  const hasAccount = !!member?.user;
  const isParent = roles.includes('PARENT');
  const isCoach = roles.includes('COACH');
  // tréner/vedúci/admin potrebujú prihlasovacie konto (funkcia sa ukladá na konte)
  const needsAccount = roles.some((r) => ['COACH', 'MANAGER', 'ADMIN'].includes(r));

  async function onPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member) return;
    setPhotoBusy(true);
    setError(null);
    try {
      await apiUpload(`/members/${member.id}/photo`, file);
      member.photoUrl = `/members/${member.id}/photo`;
      setPhotoVer((v) => v + 1); // bust cache
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahranie fotky zlyhalo');
    } finally {
      setPhotoBusy(false);
    }
  }

  // pri funkcii Rodič načítaj hráčov na priradenie dieťaťa
  useEffect(() => {
    if (isParent && players.length === 0) {
      api<Array<{ id: string; firstName: string; lastName: string }>>('/members?role=PLAYER')
        .then(setPlayers)
        .catch(() => {});
    }
  }, [isParent, players.length]);

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }
  function toggleChild(id: string) {
    setChildMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function remove() {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/members/${member.id}`, { method: 'DELETE' });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Odstránenie zlyhalo');
      setBusy(false);
    }
  }

  // Admin: vygeneruj nové jednorazové heslo pre konto člena
  async function regeneratePassword() {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ email: string | null; tempPassword: string }>(`/members/${member.id}/reset-password`, {
        method: 'POST',
      });
      setTempPassword(res.tempPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vygenerovanie hesla zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const wantAccount = hasAccount || createAccount || needsAccount;
    const body = JSON.stringify({
      firstName,
      lastName,
      birthDate: birthDate || undefined,
      status,
      registrationNumber: registrationNumber || undefined,
      registrationValidUntil: registrationValidUntil || undefined,
      socialCase,
      licenseLevel: licenseLevel || undefined,
      healthNotes: healthNotes || undefined,
      homeClub: homeClub || undefined,
      guestClub: guestClub || undefined,
      clubAffiliation: clubAffiliation || undefined,
      teamIds,
      roles,
      account: wantAccount && email ? { email } : undefined,
      childMemberIds: isParent && childMemberIds.length ? childMemberIds : undefined,
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
      <Modal open onClose={onDone} title="Dočasné heslo">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Dočasné heslo pre <strong>{email}</strong>. Odovzdajte ho používateľovi — po prihlásení si ho môže
            zmeniť:
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

  // Tréner: hráča needituje — len náhľad + priradenie rodiča a žiadosť o presun
  if (member && !staff) {
    const clubs = [member.homeClub, member.guestClub, member.clubAffiliation].filter(Boolean);
    return (
      <Modal open onClose={onClose} title={`${member.lastName} ${member.firstName}`}>
        <div className="space-y-3 text-sm">
          <div className="space-y-1 rounded-md bg-club-50 p-3 text-gray-700">
            <p>
              <span className="text-gray-500">Družstvo: </span>
              {member.memberships.map((m) => m.team.name).join(', ') || '—'}
            </p>
            <p>
              <span className="text-gray-500">Funkcia: </span>
              {memberFunctions(member).join(', ')}
            </p>
            {member.registrationNumber && (
              <p>
                <span className="text-gray-500">Reg. číslo: </span>
                {member.registrationNumber}
              </p>
            )}
            {clubs.length > 0 && (
              <p>
                <span className="text-gray-500">Kluby: </span>
                {clubs.join(' · ')}
              </p>
            )}
          </div>

          {member.memberships.length > 0 && <GuardiansEditor childId={member.id} />}

          <p className="text-xs text-gray-500">
            Ako tréner môžete priradiť rodiča; o presun hráča požiadate v menu <strong>Presuny</strong>. Údaje hráča
            upravuje vedenie klubu.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Zavrieť
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={member ? 'Upraviť člena' : 'Nový člen'}>
      <div className="space-y-3">
        {/* Fotka hráča (na karte) */}
        <div className="flex items-center gap-4">
          {member?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_URL}${member.photoUrl}?v=${photoVer}`}
              alt="Fotka"
              className="h-20 w-20 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
              bez fotky
            </div>
          )}
          <div>
            {member ? (
              <label className="cursor-pointer text-sm text-club-600 hover:underline">
                {photoBusy ? 'Nahrávam…' : member.photoUrl ? 'Zmeniť fotku' : 'Nahrať fotku'}
                <input type="file" accept="image/*" onChange={onPhotoUpload} className="hidden" disabled={photoBusy} />
              </label>
            ) : (
              <p className="text-xs text-gray-400">Fotku nahráte po uložení člena.</p>
            )}
          </div>
        </div>

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
        <div>
          <label className={labelCls}>Registračné číslo</label>
          <input
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className={inputCls}
            placeholder="registračné číslo hráča"
          />
        </div>
        {/* Klubová príslušnosť (materský / hosťujúci klub) */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Materský klub</label>
            <input value={homeClub} onChange={(e) => setHomeClub(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Hosťujúci klub</label>
            <input value={guestClub} onChange={(e) => setGuestClub(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Klubová príslušnosť</label>
            <input value={clubAffiliation} onChange={(e) => setClubAffiliation(e.target.value)} className={inputCls} />
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

        {/* Zaradenie do skupín (viac naraz; prepíše automatické podľa veku) */}
        <div>
          <label className={labelCls}>Družstvá / skupiny</label>
          <div className="mt-1 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2">
            {teams.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={teamIds.includes(t.id)}
                  onChange={() =>
                    setTeamIds((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                  }
                />
                {t.name}
              </label>
            ))}
            {teams.length === 0 && <p className="text-sm text-gray-400">Žiadne družstvá.</p>}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Hráč môže byť vo viacerých skupinách. Ručné zaradenie prepíše automatické podľa veku.
          </p>
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
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500">Konto už existuje. Zmena rolí sa uloží.</p>
                {canGrantAdmin && member && (
                  <Button variant="ghost" onClick={regeneratePassword} disabled={busy}>
                    🔑 Vygenerovať heslo
                  </Button>
                )}
              </div>
            </>
          ) : needsAccount ? (
            <>
              <label className={labelCls}>E-mail (prihlasovacie konto)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="meno@email.sk" />
              <p className="mt-1 text-xs text-amber-700">
                Tréner a vedúci klubu potrebujú prihlasovacie konto — zadajte e-mail.
              </p>
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

        {/* Priradenie dieťaťa — pri funkcii Rodič */}
        {isParent && (
          <div className="rounded-md border border-club-100 p-3">
            <label className={labelCls}>Priradiť dieťa (hráča)</label>
            <p className="mb-2 text-xs text-gray-500">Vyžaduje konto rodiča (e-mail vyššie).</p>
            <input
              value={childSearch}
              onChange={(e) => setChildSearch(e.target.value)}
              placeholder="Hľadať podľa priezviska…"
              className={`${inputCls} mb-2`}
            />
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {(() => {
                const s = childSearch
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .trim();
                const list = players.filter(
                  (p) =>
                    !s ||
                    `${p.lastName} ${p.firstName}`
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .toLowerCase()
                      .includes(s),
                );
                if (list.length === 0)
                  return <p className="text-sm text-gray-400">{players.length ? 'Nič nenájdené.' : 'Žiadni hráči.'}</p>;
                return list.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={childMemberIds.includes(p.id)} onChange={() => toggleChild(p.id)} />
                    {p.lastName} {p.firstName}
                  </label>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Rodičia — priradenie k dieťaťu (vedenie alebo tréner družstva dieťaťa) */}
        {member && !isParent && (member.memberships.length > 0 || roles.includes('PLAYER')) && (
          <GuardiansEditor childId={member.id} />
        )}

        <div>
          <label className={labelCls}>
            {isCoach ? 'Platnosť licencie do' : 'Platnosť registračného preukazu do'}
          </label>
          <input
            type="date"
            value={registrationValidUntil}
            onChange={(e) => setRegistrationValidUntil(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Tréner: úroveň licencie (číslo licencie = registračné číslo vyššie) */}
        {isCoach && (
          <div>
            <label className={labelCls}>Úroveň licencie</label>
            <select value={licenseLevel} onChange={(e) => setLicenseLevel(e.target.value)} className={inputCls}>
              <option value="">— nezadané —</option>
              <option value="A_PRO">A PRO</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="GK">Brankár</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Číslo licencie zadajte do poľa „Registračné číslo".</p>
          </div>
        )}

        {/* Sociálny prípad — len vedúci klubu */}
        {staff && (
          <label className="flex items-start gap-2 rounded-md bg-club-50 p-3 text-sm text-gray-700">
            <input type="checkbox" checked={socialCase} onChange={(e) => setSocialCase(e.target.checked)} className="mt-0.5" />
            <span>
              Sociálny prípad
              <span className="block text-xs text-gray-500">Hráčovi sa nebude vytvárať členský poplatok.</span>
            </span>
          </label>
        )}

        <div>
          <label className={labelCls}>Zdravotné poznámky</label>
          <textarea value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)} rows={2} className={inputCls} />
        </div>

        <ErrorText>{error}</ErrorText>
        {staff && member && confirmDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 p-3">
            <span className="text-sm text-red-700">
              Natrvalo odstrániť člena {firstName} {lastName}? Vrátane členstiev, dochádzky a poplatkov. Nedá sa vrátiť.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Späť
              </Button>
              <Button variant="danger" onClick={remove} disabled={busy}>
                {busy ? 'Odstraňujem…' : 'Áno, odstrániť'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            {staff && member ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Odstrániť
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Zrušiť
              </Button>
              <Button onClick={submit} disabled={busy || !firstName || !lastName || (needsAccount && !hasAccount && !email)}>
                {busy ? 'Ukladám…' : 'Uložiť'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const RELATION_OPTIONS = [
  { value: 'MOTHER', label: 'Matka' },
  { value: 'FATHER', label: 'Otec' },
  { value: 'GUARDIAN', label: 'Zákonný zástupca' },
  { value: 'RELATIVE', label: 'Iný príbuzný' },
];
const RELATION_LABEL: Record<string, string> = Object.fromEntries(RELATION_OPTIONS.map((o) => [o.value, o.label]));

interface GuardianRow {
  user: { id: string; firstName: string; lastName: string };
  relation: string;
}
interface ParentOption {
  id: string;
  firstName: string;
  lastName: string;
  user: { email: string } | null;
}

/** Zoznam a priradenie rodičov k dieťaťu (vedenie / tréner družstva). */
function GuardiansEditor({ childId }: { childId: string }) {
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [parentId, setParentId] = useState('');
  const [relation, setRelation] = useState('GUARDIAN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await api<{ guardians: GuardianRow[] }>(`/members/${childId}`);
      setGuardians(m.guardians ?? []);
    } catch {
      /* ticho */
    }
  }, [childId]);

  useEffect(() => {
    void load();
    api<ParentOption[]>('/members/parents').then(setParents).catch(() => {});
  }, [load]);

  async function add() {
    if (!parentId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/members/${childId}/guardians`, {
        method: 'POST',
        body: JSON.stringify({ parentMemberId: parentId, relation }),
      });
      setParentId('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Priradenie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setBusy(true);
    try {
      await api(`/members/${childId}/guardians/${userId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zrušenie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  const available = parents.filter(
    (p) => !guardians.some((g) => `${g.user.firstName} ${g.user.lastName}` === `${p.firstName} ${p.lastName}`),
  );

  return (
    <div className="rounded-md border border-club-100 p-3">
      <label className={labelCls}>Rodičia / zákonní zástupcovia</label>
      <div className="mt-1 space-y-1">
        {guardians.length === 0 && <p className="text-sm text-gray-400">Zatiaľ nikto priradený.</p>}
        {guardians.map((g) => (
          <div key={g.user.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
            <span>
              {g.user.lastName} {g.user.firstName}
              <span className="ml-1 text-xs text-gray-400">({RELATION_LABEL[g.relation] ?? g.relation})</span>
            </span>
            <button type="button" disabled={busy} onClick={() => remove(g.user.id)} className="text-red-500 hover:text-red-700" title="Odobrať">
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={`${inputCls} flex-1`}>
          <option value="">— vyberte rodiča —</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName}
              {p.user?.email ? ` · ${p.user.email}` : ''}
            </option>
          ))}
        </select>
        <select value={relation} onChange={(e) => setRelation(e.target.value)} className={`${inputCls} w-40`}>
          {RELATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button variant="ghost" onClick={add} disabled={busy || !parentId}>
          Priradiť
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-gray-500">Jedno dieťa môže mať viac rodičov; rodič viac detí. Rodič si dieťa sám priradiť nevie.</p>
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
