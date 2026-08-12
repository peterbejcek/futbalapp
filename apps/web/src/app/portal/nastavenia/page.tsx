'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_URL, api, getToken } from '@/lib/api';
import { Button, Card, ErrorText, inputCls } from '@/components/ui';

interface TeamRow {
  id: string;
  name: string;
  sportnetProgramUrl?: string | null;
  sportnetTeamName?: string | null;
}
interface Category {
  code: string;
  name: string;
  teams: TeamRow[];
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setCategories(await api<Category[]>('/seasons/categories'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    }
  }, []);
  useEffect(() => {
    void load();
    api<{ id: string }>('/seasons/active').then((s) => setSeasonId(s.id)).catch(() => {});
  }, [load]);

  async function addTeam(code: string) {
    const name = (newTeam[code] ?? '').trim();
    if (!name) return;
    try {
      await api('/seasons/teams', { method: 'POST', body: JSON.stringify({ teamCategoryCode: code, name }) });
      setNewTeam((p) => ({ ...p, [code]: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    }
  }

  async function action(path: string, label: string) {
    setMsg(null);
    setError(null);
    try {
      const r = await api<Record<string, unknown>>(path, { method: 'POST' });
      setMsg(`${label}: ${JSON.stringify(r)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    }
  }

  function download(path: string, filename: string) {
    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Chyba ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e.message));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-club-900">Nastavenia</h1>
      {msg && <p className="rounded bg-club-50 px-3 py-2 text-sm text-club-700">{msg}</p>}
      <ErrorText>{error}</ErrorText>

      <Card className="space-y-3">
        <h2 className="font-semibold text-club-800">Družstvá pod kategóriami</h2>
        <p className="text-sm text-gray-500">
          Každá kategória má aspoň jedno družstvo. Pridajte ďalšie (napr. „U10 B") pre početné ročníky.
        </p>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.code} className="flex flex-wrap items-center gap-2 border-b border-club-50 py-2">
              <span className="w-16 font-semibold text-club-700">{c.code}</span>
              <span className="flex flex-1 flex-wrap items-center gap-1">
                {c.teams.map((t) => (
                  <TeamChip key={t.id} team={t} onDone={load} onErr={setError} />
                ))}
              </span>
              <input
                value={newTeam[c.code] ?? ''}
                onChange={(e) => setNewTeam((p) => ({ ...p, [c.code]: e.target.value }))}
                placeholder={`${c.code} B`}
                className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <Button variant="ghost" onClick={() => addTeam(c.code)}>
                Pridať
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-club-800">Zaradenie a kanály</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => action(`/seasons/${seasonId}/assign-memberships`, 'Zaradenie')}>
            Prepočítať zaradenie hráčov
          </Button>
          <Button variant="ghost" onClick={() => action('/chat/sync', 'Kanály')}>
            Prepočítať členstvo kanálov
          </Button>
        </div>
        <p className="text-sm text-gray-500">
          Zaradenie priradí hráčov do predvoleného družstva podľa ročníka; kanály naplnia členov podľa súpisiek.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-club-800">Rozpis zápasov zo sportnetu (per družstvo)</h2>
        <p className="text-sm text-gray-500">
          Pre družstvo zadajte odkaz na <strong>program</strong> súťaže na sportnet.sme.sk a presný názov družstva
          tak, ako je uvedený na sportnete. Po „Vytvoriť rozpis" sa načítajú a doplnia zápasy družstva (idempotentne).
        </p>
        {categories.flatMap((c) => c.teams).length === 0 && (
          <p className="text-sm text-gray-500">Zatiaľ žiadne družstvá — najprv ich vytvorte vyššie.</p>
        )}
        {categories.map((c) =>
          c.teams.map((t) => (
            <SportnetTeamRow key={t.id} team={t} categoryName={c.name} onMsg={setMsg} onErr={setError} onDone={load} />
          )),
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-club-800">Exporty do Excelu</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => download('/reports/export/members', 'clenovia.xlsx')}>
            Členovia
          </Button>
          <Button variant="ghost" onClick={() => download('/reports/export/payments', 'platby.xlsx')}>
            Platby
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SportnetTeamRow({
  team,
  categoryName,
  onMsg,
  onErr,
  onDone,
}: {
  team: TeamRow;
  categoryName: string;
  onMsg: (s: string) => void;
  onErr: (s: string) => void;
  onDone: () => void;
}) {
  const [url, setUrl] = useState(team.sportnetProgramUrl ?? '');
  const [name, setName] = useState(team.sportnetTeamName ?? '');
  const [busy, setBusy] = useState(false);

  async function persist() {
    await api(`/futbalnet/team/${team.id}`, {
      method: 'POST',
      body: JSON.stringify({ programUrl: url.trim() || null, teamName: name.trim() || null }),
    });
  }

  async function save() {
    setBusy(true);
    try {
      await persist();
      onMsg(`Uložené: ${categoryName} · ${team.name}`);
      onDone();
    } catch (e) {
      onErr(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setBusy(false);
    }
  }

  async function importNow() {
    setBusy(true);
    try {
      await persist();
      const r = await api<{ total: number; ours: number; created: number; updated: number }>(
        `/futbalnet/team/${team.id}/import`,
        { method: 'POST' },
      );
      onMsg(`${team.name}: našich zápasov ${r.ours} · vytvorené ${r.created}, aktualizované ${r.updated} (z ${r.total} v programe)`);
      onDone();
    } catch (e) {
      onErr(e instanceof Error ? e.message : 'Import zlyhal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-club-100 p-3">
      <div className="mb-2 text-sm font-medium text-club-800">
        {categoryName} · {team.name}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputCls}
          placeholder="https://sportnet.sme.sk/futbalnet/z/…/s/…/program/"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="Názov na sportnete, napr. FK Košická Nová Ves B"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" onClick={save} disabled={busy}>
          Uložiť
        </Button>
        <Button onClick={importNow} disabled={busy || !url.trim() || !name.trim()}>
          {busy ? 'Pracujem…' : 'Vytvoriť rozpis'}
        </Button>
      </div>
    </div>
  );
}

function TeamChip({
  team,
  onDone,
  onErr,
}: {
  team: TeamRow;
  onDone: () => void;
  onErr: (s: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [busy, setBusy] = useState(false);

  async function rename() {
    const clean = name.trim();
    if (!clean || clean === team.name) {
      setEditing(false);
      setName(team.name);
      return;
    }
    setBusy(true);
    try {
      await api(`/seasons/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ name: clean }) });
      setEditing(false);
      onDone();
    } catch (e) {
      onErr(e instanceof Error ? e.message : 'Chyba');
      setName(team.name);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Odstrániť družstvo „${team.name}"?`)) return;
    setBusy(true);
    try {
      await api(`/seasons/teams/${team.id}`, { method: 'DELETE' });
      onDone();
    } catch (e) {
      onErr(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void rename();
            if (e.key === 'Escape') {
              setEditing(false);
              setName(team.name);
            }
          }}
          className="w-28 rounded border border-club-300 px-2 py-0.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void rename()}
          className="text-xs font-medium text-club-700 hover:underline"
        >
          Uložiť
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-club-50 px-2 py-0.5 text-sm text-club-700">
      {team.name}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setName(team.name);
          setEditing(true);
        }}
        title="Premenovať"
        className="text-club-400 hover:text-club-700"
      >
        ✎
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        title="Odstrániť"
        className="text-red-400 hover:text-red-600"
      >
        ✕
      </button>
    </span>
  );
}
