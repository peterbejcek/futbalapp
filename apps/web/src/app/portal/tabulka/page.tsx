'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, inputCls } from '@/components/ui';

interface TeamRow {
  id: string;
  name: string;
  sportnetUrl: string | null;
  teamCategory: { code: string; name: string; sortOrder: number; sportnetUrl: string | null };
}

/** Základná URL súťaže bez /tabulky/ či /program/ na konci (na skladanie embedu). */
function baseUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.trim().replace(/\/(tabulky|program)\/?$/i, '').replace(/\/+$/, '') || null;
}

export default function TablePage() {
  const { me } = useMe();
  const staff = isStaff(me);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamId, setTeamId] = useState('');
  const [tab, setTab] = useState<'tabulky' | 'program'>('tabulky');
  const [urlDraft, setUrlDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<TeamRow[]>('/seasons/teams')
      .then((list) => {
        setTeams(list);
        setTeamId((cur) => {
          if (cur && list.some((t) => t.id === cur)) return cur;
          // predvyber prvé družstvo s nastavenou súťažou (vlastnou alebo z kategórie)
          const withUrl = list.find((t) => baseUrl(t.sportnetUrl) || baseUrl(t.teamCategory.sportnetUrl));
          return withUrl?.id ?? list[0]?.id ?? '';
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie zlyhalo'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => teams.find((t) => t.id === teamId) ?? null, [teams, teamId]);

  useEffect(() => {
    // do editora predvyplň vlastnú URL družstva, inak zdedenú z kategórie
    setUrlDraft(active?.sportnetUrl ?? active?.teamCategory.sportnetUrl ?? '');
  }, [active?.sportnetUrl, active?.teamCategory.sportnetUrl, active?.id]);

  // družstvá zoskupené podľa kategórie (optgroup v zozname)
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; sortOrder: number; teams: TeamRow[] }>();
    for (const t of teams) {
      const key = t.teamCategory.code;
      if (!map.has(key)) map.set(key, { name: t.teamCategory.name, sortOrder: t.teamCategory.sortOrder, teams: [] });
      map.get(key)!.teams.push(t);
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [teams]);

  async function saveUrl() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/futbalnet/team/${active.id}/sportnet-url`, {
        method: 'POST',
        body: JSON.stringify({ url: urlDraft.trim() || null }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  const base = baseUrl(active?.sportnetUrl) ?? baseUrl(active?.teamCategory.sportnetUrl);
  const embedUrl = base ? `${base}/${tab}/` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-club-900">Tabuľka a program</h1>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {groups.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <ErrorText>{error}</ErrorText>

      {embedUrl ? (
        <>
          <div className="inline-flex overflow-hidden rounded-md border border-club-200">
            <button
              onClick={() => setTab('tabulky')}
              className={`px-3 py-1 text-sm ${tab === 'tabulky' ? 'bg-club-600 text-white' : 'bg-white text-club-700'}`}
            >
              Tabuľka
            </button>
            <button
              onClick={() => setTab('program')}
              className={`px-3 py-1 text-sm ${tab === 'program' ? 'bg-club-600 text-white' : 'bg-white text-club-700'}`}
            >
              Program
            </button>
          </div>
          <Card className="p-0">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title="Futbalnet"
              className="h-[75vh] w-full rounded-lg"
              loading="lazy"
            />
          </Card>
          <p className="text-center text-xs text-gray-400">
            Zdroj: futbalnet / sportnet.sme.sk ·{' '}
            <a href={embedUrl} target="_blank" rel="noreferrer" className="underline">
              otvoriť v novom okne
            </a>
          </p>
        </>
      ) : (
        <Card className="text-sm text-gray-600">
          Pre družstvo <strong>{active?.name}</strong> zatiaľ nie je nastavený odkaz na súťaž vo futbalnete.
          {staff ? ' Zadajte ho nižšie.' : ' Nastaví ho vedúci klubu.'}
        </Card>
      )}

      {staff && active && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-club-800">
            Odkaz na súťaž (sportnet.sme.sk) — {active.teamCategory.name} · {active.name}
          </h2>
          <p className="mb-2 text-xs text-gray-500">
            Skopírujte adresu súťaže z futbalnetu, napr.{' '}
            <code>https://sportnet.sme.sk/futbalnet/z/mfz-kosice/s/pripravka-u11</code> (bez /tabulky/ na konci).
            Pre družstvá A a B môžete zadať rôzne súťaže.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://sportnet.sme.sk/futbalnet/z/…/s/…"
              className={`${inputCls} flex-1`}
            />
            <Button onClick={saveUrl} disabled={busy}>
              {busy ? 'Ukladám…' : 'Uložiť'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
