'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, inputCls } from '@/components/ui';

interface Category {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  sportnetUrl: string | null;
}

export default function TablePage() {
  const { me } = useMe();
  const staff = isStaff(me);
  const [cats, setCats] = useState<Category[]>([]);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'tabulky' | 'program'>('tabulky');
  const [urlDraft, setUrlDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Category[]>('/seasons/categories')
      .then((c) => {
        setCats(c);
        if (!code && c.length) setCode(c.find((x) => x.sportnetUrl)?.code ?? c[0].code);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie zlyhalo'));
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => cats.find((c) => c.code === code) ?? null, [cats, code]);

  useEffect(() => {
    setUrlDraft(active?.sportnetUrl ?? '');
  }, [active?.sportnetUrl]);

  async function saveUrl() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/futbalnet/sportnet/${active.code}`, {
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

  const embedUrl = active?.sportnetUrl ? `${active.sportnetUrl}/${tab}/` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-club-900">Tabuľka a program</h1>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {cats.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
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
          Pre kategóriu <strong>{active?.name}</strong> zatiaľ nie je nastavený odkaz na súťaž vo futbalnete.
          {staff ? ' Zadajte ho nižšie.' : ' Nastaví ho vedúci klubu.'}
        </Card>
      )}

      {staff && active && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-club-800">Odkaz na súťaž (sportnet.sme.sk) — {active.name}</h2>
          <p className="mb-2 text-xs text-gray-500">
            Skopírujte adresu súťaže z futbalnetu, napr.{' '}
            <code>https://sportnet.sme.sk/futbalnet/z/mfz-kosice/s/pripravka-u11</code> (bez /tabulky/ na konci).
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
