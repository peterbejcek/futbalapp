'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { coachTeams, isStaff, useMe } from '@/lib/auth';
import { Card, ErrorText, inputCls } from '@/components/ui';
import { DISCIPLINES, type DisciplineKey, type FitnessTest } from '@/components/fitness';

interface Team {
  id: string;
  name: string;
}
interface Player {
  id: string;
  firstName: string;
  lastName: string;
}
type Values = Record<DisciplineKey, string>;
interface Row {
  testId: string | null;
  values: Values;
  saved: Values; // naposledy uložené hodnoty (na zistenie zmeny)
  busy: boolean;
  error: string | null;
}

const emptyValues = (): Values => ({ run10m: '', run20m: '', run30m: '', shuttleRun: '', standingJump: '' });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toNum = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const collator = new Intl.Collator('sk');

function NewTestForm() {
  const params = useSearchParams();
  const { me } = useMe();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState(params.get('team') ?? '');
  const [date, setDate] = useState(params.get('date') ?? today());
  const [players, setPlayers] = useState<Player[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // z tréningu je družstvo dané; z menu sa ponúka na výber
  const fixedTeam = !!params.get('team');

  const availableTeams = useMemo(() => {
    if (isStaff(me)) return teams;
    const ids = new Set(coachTeams(me).map((t) => t.id));
    return teams.filter((t) => ids.has(t.id));
  }, [teams, me]);

  useEffect(() => {
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!teamId || !date) {
      setPlayers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [members, tests] = await Promise.all([
        api<Player[]>(`/members?team=${teamId}&hideInactive=true&role=PLAYER`),
        api<FitnessTest[]>('/fitness-tests'),
      ]);
      const sorted = [...members].sort((a, b) =>
        collator.compare(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`),
      );
      const existing = new Map(tests.filter((t) => t.testedAt === date).map((t) => [t.memberId, t]));
      const next: Record<string, Row> = {};
      for (const p of sorted) {
        const t = existing.get(p.id);
        const values: Values = t
          ? {
              run10m: t.run10m?.toString() ?? '',
              run20m: t.run20m?.toString() ?? '',
              run30m: t.run30m?.toString() ?? '',
              shuttleRun: t.shuttleRun?.toString() ?? '',
              standingJump: t.standingJump?.toString() ?? '',
            }
          : emptyValues();
        next[p.id] = { testId: t?.id ?? null, values, saved: { ...values }, busy: false, error: null };
      }
      setPlayers(sorted);
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    } finally {
      setLoading(false);
    }
  }, [teamId, date]);
  useEffect(() => {
    void load();
  }, [load]);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));
  }
  function setValue(id: string, key: DisciplineKey, v: string) {
    setRows((r) => ({ ...r, [id]: { ...r[id]!, values: { ...r[id]!.values, [key]: v }, error: null } }));
  }

  async function save(playerId: string) {
    const row = rows[playerId]!;
    const body: Record<string, unknown> = { testedAt: date };
    for (const d of DISCIPLINES) body[d.key] = toNum(row.values[d.key]);
    if (DISCIPLINES.every((d) => body[d.key] == null)) {
      patchRow(playerId, { error: 'Zadajte aspoň jednu hodnotu' });
      return;
    }
    patchRow(playerId, { busy: true, error: null });
    try {
      if (row.testId) {
        await api(`/fitness-tests/${row.testId}`, { method: 'PATCH', body: JSON.stringify(body) });
        patchRow(playerId, { busy: false, saved: { ...row.values } });
      } else {
        const created = await api<{ id: string }>('/fitness-tests', {
          method: 'POST',
          body: JSON.stringify({ ...body, memberId: playerId, teamId }),
        });
        patchRow(playerId, { busy: false, testId: created.id, saved: { ...row.values } });
      }
    } catch (e) {
      patchRow(playerId, { busy: false, error: e instanceof Error ? e.message : 'Uloženie zlyhalo' });
    }
  }

  const thCls = 'whitespace-nowrap px-3 py-2 text-left font-medium';

  return (
    <div className="space-y-5">
      <Link href="/portal/prehlady/previerky" className="text-sm text-club-600 hover:underline">
        ← Previerky
      </Link>
      <h1 className="text-2xl font-bold text-club-900">Nová previerka</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-gray-600">Dátum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} !mt-1`} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Družstvo</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={fixedTeam}
            className={`${inputCls} !mt-1`}
          >
            <option value="">— vyberte družstvo —</option>
            {(fixedTeam ? teams : availableTeams).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      {!teamId ? (
        <Card className="text-sm text-gray-500">Vyberte družstvo.</Card>
      ) : loading ? (
        <Card className="text-sm text-gray-500">Načítavam…</Card>
      ) : players.length === 0 ? (
        <Card className="text-sm text-gray-500">Družstvo nemá žiadnych hráčov.</Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-club-50 text-club-800">
              <tr>
                <th className={thCls}>Hráč</th>
                {DISCIPLINES.map((d) => (
                  <th key={d.key} className={thCls}>
                    {d.label} ({d.unit})
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-club-100">
              {players.map((p) => {
                const row = rows[p.id];
                if (!row) return null;
                const dirty = DISCIPLINES.some((d) => row.values[d.key] !== row.saved[d.key]);
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-medium">
                      {p.lastName} {p.firstName}
                    </td>
                    {DISCIPLINES.map((d) => (
                      <td key={d.key} className="px-2 py-1.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step={d.step}
                          min="0"
                          value={row.values[d.key]}
                          onChange={(e) => setValue(p.id, d.key, e.target.value)}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-club-500 focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <button
                        onClick={() => save(p.id)}
                        disabled={row.busy || (!!row.testId && !dirty)}
                        className="rounded-md bg-club-600 px-3 py-1 text-xs font-semibold text-white hover:bg-club-700 disabled:opacity-40"
                      >
                        {row.busy ? '…' : row.testId ? 'Upraviť' : 'Uložiť'}
                      </button>
                      {row.testId && !dirty && <span className="ml-2 text-xs text-green-600">✓ uložené</span>}
                      {row.error && <div className="mt-1 text-xs text-red-600">{row.error}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Čas zadávajte v sekundách (napr. 2,35), skok v cm. Tlačidlom na konci riadka sa uloží previerka daného hráča.
      </p>
    </div>
  );
}

export default function NewFitnessTestPage() {
  return (
    <Suspense fallback={null}>
      <NewTestForm />
    </Suspense>
  );
}
