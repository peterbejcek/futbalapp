'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  publishedAt: string | null;
  isArchive?: boolean;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('sk-SK');

export default function ArticlesPage() {
  const { me, loading } = useMe();
  const staff = isStaff(me);
  const [items, setItems] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Article | 'new' | null>(null);

  const load = useCallback(() => {
    api<Article[]>('/articles')
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie zlyhalo'));
  }, []);

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  async function togglePublish(a: Article) {
    setError(null);
    try {
      await api(`/articles/${a.id}`, { method: 'PATCH', body: JSON.stringify({ publish: !a.publishedAt }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    }
  }

  async function remove(a: Article) {
    if (!window.confirm(`Naozaj zmazať článok „${a.title}"?`)) return;
    setError(null);
    try {
      await api(`/articles/${a.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zmazanie zlyhalo');
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Načítavam…</p>;
  if (!staff) return <p className="text-sm text-gray-500">Táto sekcia je len pre vedenie klubu.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-club-900">Články</h1>
        <Button onClick={() => setEditing('new')}>Nový článok</Button>
      </div>
      <ErrorText>{error}</ErrorText>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-club-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Názov</th>
              <th className="px-4 py-2">Stav</th>
              <th className="px-4 py-2">Dátum</th>
              <th className="px-4 py-2 text-right">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-club-100">
                <td className="px-4 py-2 font-medium text-club-900">{a.title}</td>
                <td className="px-4 py-2">
                  {a.publishedAt ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Publikovaný</span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Koncept</span>
                  )}
                  {a.isArchive && (
                    <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Archív</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-600">{fmt(a.publishedAt ?? a.createdAt)}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setEditing(a)}>
                      Upraviť
                    </Button>
                    <Button variant="ghost" onClick={() => togglePublish(a)}>
                      {a.publishedAt ? 'Zrušiť publikovanie' : 'Publikovať'}
                    </Button>
                    <Button variant="danger" onClick={() => remove(a)}>
                      Zmazať
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Zatiaľ žiadne články.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {editing && (
        <ArticleModal
          article={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ArticleModal({
  article,
  onClose,
  onDone,
}: {
  article: Article | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [body, setBody] = useState(article?.body ?? '');
  const [isArchive, setIsArchive] = useState(article?.isArchive ?? false);
  const [sourceUrl, setSourceUrl] = useState(article?.sourceUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const published = !!article?.publishedAt;

  async function save(publish: boolean) {
    setBusy(true);
    setError(null);
    try {
      const payload = { title, excerpt, body, publish, isArchive, sourceUrl: sourceUrl.trim() || null };
      if (article) await api(`/articles/${article.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/articles', { method: 'POST', body: JSON.stringify(payload) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={article ? 'Upraviť článok' : 'Nový článok'} wide>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Názov</label>
          <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Úvod</label>
          <textarea
            value={excerpt}
            maxLength={400}
            rows={3}
            onChange={(e) => setExcerpt(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Text</label>
          <textarea
            value={body}
            maxLength={20000}
            rows={12}
            onChange={(e) => setBody(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-500">Odseky oddeľte prázdnym riadkom. HTML sa nepodporuje.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isArchive} onChange={(e) => setIsArchive(e.target.checked)} />
          Archívny oznam (označí sa na webe ako archív)
        </label>
        <div>
          <label htmlFor="art-src" className={labelCls}>
            Pôvodný zdroj (URL)
          </label>
          <input
            id="art-src"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className={inputCls}
          />
        </div>
        <div aria-live="polite" role="status">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          {published ? (
            <>
              <Button variant="ghost" onClick={() => save(false)} disabled={busy}>
                Zrušiť publikovanie
              </Button>
              <Button onClick={() => save(true)} disabled={busy}>
                {busy ? 'Ukladám…' : 'Uložiť'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => save(false)} disabled={busy}>
                Uložiť koncept
              </Button>
              <Button onClick={() => save(true)} disabled={busy}>
                Publikovať
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
