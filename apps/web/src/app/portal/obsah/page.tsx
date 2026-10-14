'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, apiUpload } from '@/lib/api';
import { isStaff, useMe } from '@/lib/auth';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Tab = 'stranky' | 'osoby' | 'dokumenty';

interface Base {
  id: string;
  status: Status;
  sourceUrl: string | null;
  sourceNote: string | null;
  sortOrder: number;
  confirmedAt: string | null;
  updatedAt: string;
}
interface Page extends Base {
  slug: string;
  title: string;
  body: string;
}
interface Person extends Base {
  name: string;
  role: string | null;
  group: 'MANAGEMENT' | 'COACH' | 'OTHER';
  teamNote: string | null;
  phone: string | null;
  email: string | null;
}
interface Doc extends Base {
  title: string;
  description: string | null;
  category: 'CONTRACT' | 'SUBSIDY' | 'TAX_FORM' | 'ANNOUNCEMENT' | 'OTHER';
  documentDate: string | null;
  hasFile: boolean;
  size: number | null;
  sha256: string | null;
  originalFilename: string | null;
  mimeType: string | null;
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'stranky', label: 'Stránky' },
  { key: 'osoby', label: 'Osoby' },
  { key: 'dokumenty', label: 'Dokumenty' },
];
const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Koncept', PUBLISHED: 'Publikovaný', ARCHIVED: 'Archív' };
const STATUS_CLS: Record<Status, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-amber-100 text-amber-800',
};
const GROUP_LABEL = { MANAGEMENT: 'Vedenie', COACH: 'Tréner', OTHER: 'Ostatní' } as const;
const CATEGORY_LABEL = {
  CONTRACT: 'Zmluva',
  SUBSIDY: 'Dotácia',
  TAX_FORM: 'Daňové tlačivo',
  ANNOUNCEMENT: 'Oznam',
  OTHER: 'Iné',
} as const;
const KNOWN_SLUGS = ['o-klube', 'historia', 'kontakt', 'podpora', 'zverejnovanie'];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()}`;
};
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const fmtSize = (n: number | null) =>
  n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} kB` : `${(n / 1048576).toFixed(1)} MB`;

function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>;
}
function ConfirmInfo({ at }: { at: string | null }) {
  return at ? (
    <span className="text-xs text-green-800">Potvrdené klubom {fmtDate(at)}</span>
  ) : (
    <span className="text-xs text-red-700">Nepotvrdené</span>
  );
}

export default function ContentPage() {
  const { me, loading } = useMe();
  const staff = isStaff(me);
  const [tab, setTab] = useState<Tab>('stranky');

  useEffect(() => {
    try {
      const z = new URLSearchParams(window.location.search).get('zalozka');
      if (z === 'stranky' || z === 'osoby' || z === 'dokumenty') setTab(z);
    } catch {
      /* ignore */
    }
  }, []);

  function selectTab(t: Tab) {
    setTab(t);
    try {
      window.history.replaceState(null, '', `?zalozka=${t}`);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Načítavam…</p>;
  if (!staff) return <p className="text-sm text-gray-500">Táto sekcia je len pre vedenie klubu.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
      <h1 className="text-xl font-semibold text-club-900">Obsah webu</h1>
      <div className="rounded-md border border-club-100 bg-club-50 p-3 text-sm text-gray-700">
        <ul className="list-disc space-y-1 pl-5">
          <li>Obsah so stavom Koncept sa verejne nezobrazuje.</li>
          <li>Archív sa zobrazuje s označením, že nejde o aktuálny údaj.</li>
          <li>Publikovať možno len s potvrdením klubu, že údaje sú správne a aktuálne.</li>
        </ul>
      </div>
      <div role="tablist" aria-label="Typ obsahu" className="flex gap-2 border-b border-club-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => selectTab(t.key)}
            className={`px-4 py-2 text-sm ${
              tab === t.key ? 'border-b-2 border-club-600 font-semibold text-club-900' : 'text-gray-600 hover:text-club-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'stranky' && <PagesTab />}
      {tab === 'osoby' && <PeopleTab />}
      {tab === 'dokumenty' && <DocsTab />}
    </div>
  );
}

/* ---------- spoločná logika zoznamu ---------- */

function useList<T extends { id: string }>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const load = useCallback(() => {
    api<T[]>(path)
      .then(setItems)
      .catch((e) => setError(errMsg(e, 'Načítanie zlyhalo')));
  }, [path]);
  useEffect(load, [load]);
  async function remove(item: T, label: string) {
    if (!window.confirm(`Naozaj zmazať „${label}"?`)) return;
    setError(null);
    try {
      await api(`${path}/${item.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(errMsg(e, 'Zmazanie zlyhalo'));
    }
  }
  return { items, error, editing, setEditing, load, remove };
}

function Errors({ children }: { children: string | null }) {
  return (
    <div aria-live="polite" role="status">
      <ErrorText>{children}</ErrorText>
    </div>
  );
}

function ListTable<T extends Base>({
  items,
  columns,
  render,
  onEdit,
  onRemove,
  empty,
}: {
  items: T[];
  columns: string[];
  render: (i: T) => React.ReactNode[];
  onEdit: (i: T) => void;
  onRemove: (i: T) => void;
  empty: string;
}) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-club-50 text-left text-gray-600">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2">
                {c}
              </th>
            ))}
            <th className="px-4 py-2">Stav</th>
            <th className="px-4 py-2">Potvrdenie</th>
            <th className="px-4 py-2 text-right">Akcie</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-club-100">
              {render(i).map((cell, idx) => (
                <td key={idx} className="px-4 py-2 text-gray-700">
                  {cell}
                </td>
              ))}
              <td className="px-4 py-2">
                <StatusBadge status={i.status} />
              </td>
              <td className="px-4 py-2">
                <ConfirmInfo at={i.confirmedAt} />
              </td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => onEdit(i)}>
                    Upraviť
                  </Button>
                  <Button variant="danger" onClick={() => onRemove(i)}>
                    Zmazať
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={columns.length + 3} className="px-4 py-6 text-center text-gray-500">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

/** Spoločné polia: stav + povinné potvrdenie, zdroj, poznámka, poradie. */
interface Common {
  status: Status;
  sourceUrl: string;
  sourceNote: string;
  sortOrder: string;
  confirm: boolean;
}
const commonInit = (b?: Base | null): Common => ({
  status: b?.status ?? 'DRAFT',
  sourceUrl: b?.sourceUrl ?? '',
  sourceNote: b?.sourceNote ?? '',
  sortOrder: String(b?.sortOrder ?? 0),
  confirm: false,
});
const commonPayload = (c: Common) => ({
  status: c.status,
  sourceUrl: c.sourceUrl.trim() || null,
  sourceNote: c.sourceNote.trim() || null,
  sortOrder: Number.parseInt(c.sortOrder, 10) || 0,
  ...(c.confirm ? { confirm: true } : {}),
});
const needsConfirm = (c: Common) => c.status === 'PUBLISHED' && !c.confirm;

function CommonFields({ id, c, set }: { id: string; c: Common; set: (p: Partial<Common>) => void }) {
  return (
    <>
      <div>
        <label htmlFor={`${id}-status`} className={labelCls}>
          Stav
        </label>
        <select
          id={`${id}-status`}
          value={c.status}
          onChange={(e) => set({ status: e.target.value as Status })}
          className={inputCls}
        >
          <option value="DRAFT">Koncept (verejne sa nezobrazuje)</option>
          <option value="PUBLISHED">Publikovaný</option>
          <option value="ARCHIVED">Archív (zobrazí sa ako neaktuálny údaj)</option>
        </select>
      </div>
      {c.status === 'PUBLISHED' && (
        <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={c.confirm}
            onChange={(e) => set({ confirm: e.target.checked })}
            className="mt-1"
          />
          <span>Klub potvrdil, že údaje sú správne a aktuálne (povinné pre publikovanie)</span>
        </label>
      )}
      <div>
        <label htmlFor={`${id}-src`} className={labelCls}>
          Pôvodný zdroj (URL)
        </label>
        <input
          id={`${id}-src`}
          type="url"
          value={c.sourceUrl}
          onChange={(e) => set({ sourceUrl: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${id}-note`} className={labelCls}>
          Poznámka k zdroju
        </label>
        <input
          id={`${id}-note`}
          value={c.sourceNote}
          onChange={(e) => set({ sourceNote: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${id}-ord`} className={labelCls}>
          Poradie
        </label>
        <input
          id={`${id}-ord`}
          type="number"
          value={c.sortOrder}
          onChange={(e) => set({ sortOrder: e.target.value })}
          className={inputCls}
        />
      </div>
    </>
  );
}

function ModalActions({
  busy,
  blocked,
  onClose,
  onSave,
}: {
  busy: boolean;
  blocked: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {blocked && <span className="text-xs text-amber-800">Pre publikovanie potvrďte správnosť údajov.</span>}
      <Button variant="ghost" onClick={onClose}>
        Zrušiť
      </Button>
      <Button onClick={onSave} disabled={busy || blocked}>
        {busy ? 'Ukladám…' : 'Uložiť'}
      </Button>
    </div>
  );
}

/* ---------- Stránky ---------- */

function PagesTab() {
  const { items, error, editing, setEditing, load, remove } = useList<Page>('/club-content/pages');
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>Nová stránka</Button>
      </div>
      <Errors>{error}</Errors>
      <ListTable
        items={items}
        columns={['Názov', 'Slug']}
        render={(p) => [<span className="font-medium text-club-900">{p.title}</span>, p.slug]}
        onEdit={setEditing}
        onRemove={(p) => remove(p, p.title)}
        empty="Zatiaľ žiadne stránky."
      />
      {editing && (
        <PageModal
          item={editing === 'new' ? null : editing}
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

function PageModal({ item, onClose, onDone }: { item: Page | null; onClose: () => void; onDone: () => void }) {
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [c, setC] = useState<Common>(commonInit(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = needsConfirm(c) || (!item && !slug.trim()) || !title.trim();

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = { title, body, ...commonPayload(c) };
      if (item) await api(`/club-content/pages/${item.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/club-content/pages', { method: 'POST', body: JSON.stringify({ slug: slug.trim(), ...payload }) });
      onDone();
    } catch (e) {
      setError(errMsg(e, 'Uloženie zlyhalo'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? 'Upraviť stránku' : 'Nová stránka'} wide>
      <div className="space-y-4">
        <div>
          <label htmlFor="pg-slug" className={labelCls}>
            Slug (adresa stránky)
          </label>
          <input
            id="pg-slug"
            list="known-slugs"
            value={slug}
            readOnly={!!item}
            onChange={(e) => setSlug(e.target.value)}
            className={`${inputCls} ${item ? 'bg-gray-100' : ''}`}
          />
          <datalist id="known-slugs">
            {KNOWN_SLUGS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-gray-500">
            {item ? 'Slug sa po vytvorení nedá zmeniť.' : 'Povinný, malé písmená bez diakritiky, napr. o-klube.'}
          </p>
        </div>
        <div>
          <label htmlFor="pg-title" className={labelCls}>
            Názov
          </label>
          <input id="pg-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pg-body" className={labelCls}>
            Text
          </label>
          <textarea
            id="pg-body"
            value={body}
            rows={14}
            onChange={(e) => setBody(e.target.value)}
            className={inputCls}
            aria-describedby="pg-body-help"
          />
          <p id="pg-body-help" className="mt-1 text-xs text-gray-500">
            Odseky oddeľte prázdnym riadkom, podnadpis začnite riadkom ## …, bez HTML.
          </p>
        </div>
        <CommonFields id="pg" c={c} set={(p) => setC((o) => ({ ...o, ...p }))} />
        <Errors>{error}</Errors>
        <ModalActions busy={busy} blocked={blocked} onClose={onClose} onSave={save} />
      </div>
    </Modal>
  );
}

/* ---------- Osoby ---------- */

function PeopleTab() {
  const { items, error, editing, setEditing, load, remove } = useList<Person>('/club-content/people');
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>Nová osoba</Button>
      </div>
      <Errors>{error}</Errors>
      <ListTable
        items={items}
        columns={['Meno', 'Funkcia', 'Skupina']}
        render={(p) => [
          <span className="font-medium text-club-900">{p.name}</span>,
          p.role ?? '',
          GROUP_LABEL[p.group],
        ]}
        onEdit={setEditing}
        onRemove={(p) => remove(p, p.name)}
        empty="Zatiaľ žiadne osoby."
      />
      {editing && (
        <PersonModal
          item={editing === 'new' ? null : editing}
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

function PersonModal({ item, onClose, onDone }: { item: Person | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [role, setRole] = useState(item?.role ?? '');
  const [group, setGroup] = useState<Person['group']>(item?.group ?? 'MANAGEMENT');
  const [teamNote, setTeamNote] = useState(item?.teamNote ?? '');
  const [phone, setPhone] = useState(item?.phone ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [c, setC] = useState<Common>(commonInit(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = needsConfirm(c) || !name.trim();

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name,
        role: role.trim() || null,
        group,
        teamNote: teamNote.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        ...commonPayload(c),
      };
      if (item) await api(`/club-content/people/${item.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/club-content/people', { method: 'POST', body: JSON.stringify(payload) });
      onDone();
    } catch (e) {
      setError(errMsg(e, 'Uloženie zlyhalo'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? 'Upraviť osobu' : 'Nová osoba'} wide>
      <div className="space-y-4">
        <div>
          <label htmlFor="pe-name" className={labelCls}>
            Meno
          </label>
          <input id="pe-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pe-role" className={labelCls}>
            Funkcia
          </label>
          <input id="pe-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pe-group" className={labelCls}>
            Skupina
          </label>
          <select
            id="pe-group"
            value={group}
            onChange={(e) => setGroup(e.target.value as Person['group'])}
            className={inputCls}
          >
            {Object.entries(GROUP_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pe-team" className={labelCls}>
            Družstvo / poznámka
          </label>
          <input id="pe-team" value={teamNote} onChange={(e) => setTeamNote(e.target.value)} className={inputCls} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pe-phone" className={labelCls}>
              Telefón
            </label>
            <input id="pe-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pe-email" className={labelCls}>
              E-mail
            </label>
            <input id="pe-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
        </div>
        <CommonFields id="pe" c={c} set={(p) => setC((o) => ({ ...o, ...p }))} />
        <Errors>{error}</Errors>
        <ModalActions busy={busy} blocked={blocked} onClose={onClose} onSave={save} />
      </div>
    </Modal>
  );
}

/* ---------- Dokumenty ---------- */

function DocsTab() {
  const { items, error, editing, setEditing, load, remove } = useList<Doc>('/club-content/documents');
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>Nový dokument</Button>
      </div>
      <Errors>{error}</Errors>
      <ListTable
        items={items}
        columns={['Názov', 'Kategória', 'Súbor']}
        render={(d) => [
          <span className="font-medium text-club-900">{d.title}</span>,
          CATEGORY_LABEL[d.category],
          d.hasFile ? `${d.originalFilename ?? 'súbor'} (${fmtSize(d.size)})` : 'bez súboru',
        ]}
        onEdit={setEditing}
        onRemove={(d) => remove(d, d.title)}
        empty="Zatiaľ žiadne dokumenty."
      />
      {editing && (
        <DocModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
          onChanged={load}
        />
      )}
    </div>
  );
}

function DocModal({
  item,
  onClose,
  onDone,
  onChanged,
}: {
  item: Doc | null;
  onClose: () => void;
  onDone: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState<Doc | null>(item);
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState<Doc['category']>(item?.category ?? 'OTHER');
  const [documentDate, setDocumentDate] = useState(item?.documentDate?.slice(0, 10) ?? '');
  const [c, setC] = useState<Common>(commonInit(item));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = needsConfirm(c) || !title.trim();

  async function save() {
    setBusy(true);
    setError(null);
    let doc = current;
    try {
      const payload = {
        title,
        description: description.trim() || null,
        category,
        documentDate: documentDate || null,
        ...commonPayload(c),
      };
      if (doc) {
        doc = await api<Doc>(`/club-content/documents/${doc.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        doc = await api<Doc>('/club-content/documents', { method: 'POST', body: JSON.stringify(payload) });
        setCurrent(doc);
      }
      if (file) await apiUpload<Doc>(`/club-content/documents/${doc.id}/file`, file);
      onDone();
    } catch (e) {
      const msg = errMsg(e, 'Uloženie zlyhalo');
      setError(
        doc && !current
          ? `Záznam bol uložený, ale súbor sa nepodarilo nahrať: ${msg}. Skúste ho nahrať znova.`
          : msg,
      );
      if (doc) onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeFile() {
    if (!current || !window.confirm('Naozaj odstrániť nahraný súbor?')) return;
    setError(null);
    try {
      const updated = await api<Doc>(`/club-content/documents/${current.id}/file`, { method: 'DELETE' });
      setCurrent({ ...current, ...updated, hasFile: false, size: null, sha256: null, originalFilename: null, mimeType: null });
      onChanged();
    } catch (e) {
      setError(errMsg(e, 'Odstránenie súboru zlyhalo'));
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? 'Upraviť dokument' : 'Nový dokument'} wide>
      <div className="space-y-4">
        <div>
          <label htmlFor="dc-title" className={labelCls}>
            Názov
          </label>
          <input id="dc-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="dc-desc" className={labelCls}>
            Popis
          </label>
          <textarea
            id="dc-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dc-cat" className={labelCls}>
              Kategória
            </label>
            <select
              id="dc-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as Doc['category'])}
              className={inputCls}
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dc-date" className={labelCls}>
              Dátum dokumentu
            </label>
            <input
              id="dc-date"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="space-y-2 rounded-md border border-club-100 p-3">
          <p className="text-xs text-gray-600">
            Súbor sa ukladá nezmenený; ak nemáte súbor, ponechajte odkaz na pôvodný zdroj.
          </p>
          {current?.hasFile && (
            <div className="text-sm text-gray-700">
              <p>
                <strong>{current.originalFilename}</strong> ({fmtSize(current.size)})
              </p>
              <p className="text-xs text-gray-500">SHA-256: {current.sha256?.slice(0, 16)}…</p>
              <div className="mt-2">
                <Button variant="danger" onClick={removeFile}>
                  Odstrániť súbor
                </Button>
              </div>
            </div>
          )}
          <div>
            <label htmlFor="dc-file" className={labelCls}>
              {current?.hasFile ? 'Nahradiť súbor (max 15 MB)' : 'Nahrať súbor (max 15 MB)'}
            </label>
            <input
              id="dc-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Súbor sa nahrá po uložení záznamu.</p>
          </div>
        </div>
        <CommonFields id="dc" c={c} set={(p) => setC((o) => ({ ...o, ...p }))} />
        <Errors>{error}</Errors>
        <ModalActions busy={busy} blocked={blocked} onClose={onClose} onSave={save} />
      </div>
    </Modal>
  );
}
