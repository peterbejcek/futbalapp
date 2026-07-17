'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

interface Debtor {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    guardians: Array<{ user: { email: string; phone: string | null } }>;
    memberships: Array<{ team: { teamCategory: { code: string } } }>;
  };
  owedCents: number;
  periods: string[];
}
interface FeePlan {
  id: string;
  name: string;
  amountCents: number;
  period: string;
  teamCategory: { code: string } | null;
  assignments: { id: string }[];
}
interface Category {
  code: string;
  name: string;
}

type Tab = 'debtors' | 'plans' | 'bank';

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('debtors');
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-club-900">Platby</h1>
      <div className="flex gap-2 border-b border-club-100">
        {(
          [
            ['debtors', 'Dlžníci'],
            ['plans', 'Predpisy'],
            ['bank', 'Banka a upomienky'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-b-2 border-club-600 text-club-800' : 'text-gray-500 hover:text-club-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'debtors' && <Debtors />}
      {tab === 'plans' && <Plans />}
      {tab === 'bank' && <Bank />}
    </div>
  );
}

function Debtors() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Debtor[]>('/finance/debtors')
      .then(setDebtors)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-3">
      <ErrorText>{error}</ErrorText>
      {debtors.length === 0 && !error && <Card className="text-sm text-gray-500">Žiadne členské po splatnosti. 🎉</Card>}
      {debtors.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-club-50 text-left text-club-800">
              <tr>
                <th className="px-4 py-3">Hráč</th>
                <th className="px-4 py-3">Kategória</th>
                <th className="px-4 py-3">Kontakt</th>
                <th className="px-4 py-3">Obdobia</th>
                <th className="px-4 py-3 text-right">Dlh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-club-100">
              {debtors.map((d) => (
                <tr key={d.member.id}>
                  <td className="px-4 py-3 font-medium">
                    {d.member.lastName} {d.member.firstName}
                  </td>
                  <td className="px-4 py-3">{d.member.memberships[0]?.team.teamCategory.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.member.guardians[0]?.user.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.periods.join(', ')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">
                    {(d.owedCents / 100).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Plans() {
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlans(await api<FeePlan[]>('/finance/fee-plans'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    }
  }, []);
  useEffect(() => {
    void load();
    api<Category[]>('/seasons/categories').then(setCategories).catch(() => {});
    api<{ id: string }>('/seasons/active').then((s) => setSeasonId(s.id)).catch(() => {});
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setGenOpen(true)}>
          Vygenerovať mesiac
        </Button>
        <Button onClick={() => setOpen(true)}>+ Nový predpis</Button>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="overflow-x-auto rounded-lg border border-club-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-club-50 text-left text-club-800">
            <tr>
              <th className="px-4 py-3">Názov</th>
              <th className="px-4 py-3">Kategória</th>
              <th className="px-4 py-3">Suma</th>
              <th className="px-4 py-3">Periodicita</th>
              <th className="px-4 py-3">Priradení</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-club-100">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.teamCategory?.code ?? 'Celý klub'}</td>
                <td className="px-4 py-3">{(p.amountCents / 100).toFixed(2)} €</td>
                <td className="px-4 py-3">{p.period === 'MONTHLY' ? 'Mesačne' : p.period}</td>
                <td className="px-4 py-3">{p.assignments.length}</td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Zatiaľ žiadne predpisy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <FeePlanModal
          seasonId={seasonId}
          categories={categories}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            void load();
          }}
        />
      )}
      {genOpen && <GenerateModal onClose={() => setGenOpen(false)} />}
    </div>
  );
}

function FeePlanModal({
  seasonId,
  categories,
  onClose,
  onDone,
}: {
  seasonId: string;
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('Členské mesačné');
  const [amount, setAmount] = useState('25');
  const [category, setCategory] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/finance/fee-plans', {
        method: 'POST',
        body: JSON.stringify({
          seasonId,
          name,
          amountCents: Math.round(parseFloat(amount) * 100),
          period: 'MONTHLY',
          dueDay: parseInt(dueDay, 10),
          teamCategoryCode: category || undefined,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nový predpis poplatku">
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Názov</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Suma (€ / mesiac)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Deň splatnosti</label>
            <input type="number" min="1" max="28" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Kategória</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="">Celý klub</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Predpis sa automaticky priradí aktívnym hráčom kategórie.</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !seasonId}>
            {busy ? 'Ukladám…' : 'Vytvoriť'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function GenerateModal({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const r = await api<{ created: number; total: number; period: string }>('/finance/obligations/generate', {
        method: 'POST',
        body: JSON.stringify({ year: parseInt(year, 10), month: parseInt(month, 10) }),
      });
      setResult(`Obdobie ${r.period}: vytvorených ${r.created} nových predpisov (z ${r.total}).`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Vygenerovať mesačné predpisy">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Vytvorí platobné povinnosti s variabilnými symbolmi pre daný mesiac zo všetkých mesačných predpisov.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Rok</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mesiac</label>
            <input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
          </div>
        </div>
        {result && <p className="text-sm text-club-700">{result}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zavrieť
          </Button>
          <Button onClick={generate} disabled={busy}>
            {busy ? 'Generujem…' : 'Vygenerovať'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Bank() {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runMatch() {
    setBusy(true);
    try {
      const r = await api<{ matchedTransactions: number }>('/finance/bank/match', { method: 'POST' });
      setResult(`Spárovaných pohybov: ${r.matchedTransactions}.`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setBusy(false);
    }
  }

  async function runDunning() {
    setBusy(true);
    try {
      const r = await api<{ membersNotified: number }>('/finance/dunning/run', { method: 'POST' });
      setResult(`Upomienky odoslané ${r.membersNotified} dlžníkom (push + e-mail).`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-semibold text-club-800">Párovanie s bankou</h2>
        <p className="text-sm text-gray-600">
          Import bankového výpisu (CAMT/CSV) prebieha cez API alebo naplánovaný job; tu spustíte párovanie
          nespárovaných pohybov podľa variabilného symbolu.
        </p>
        <Button onClick={runMatch} disabled={busy}>
          Spustiť párovanie
        </Button>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold text-club-800">Upomienky dlžníkom</h2>
        <p className="text-sm text-gray-600">
          Bežia automaticky denne o 8:00; tu ich viete spustiť manuálne. Rodičia dostanú push aj e-mail.
        </p>
        <Button variant="ghost" onClick={runDunning} disabled={busy}>
          Spustiť upomienky teraz
        </Button>
      </Card>
      {result && <p className="text-sm text-club-700">{result}</p>}
    </div>
  );
}
