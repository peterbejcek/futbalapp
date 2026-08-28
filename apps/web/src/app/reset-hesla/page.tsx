'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

const inputCls = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Heslo musí mať aspoň 8 znakov.');
      return;
    }
    if (password !== confirm) {
      setError('Heslá sa nezhodujú.');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setDone(true);
      setTimeout(() => router.push('/prihlasenie'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastavenie hesla zlyhalo');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-red-600">Chýba token. Použite odkaz z e-mailu, alebo požiadajte o nový.</p>
        <Link href="/prihlasenie" className="text-sm text-club-600 hover:underline">
          ← Prihlásenie
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-gray-600">Heslo bolo zmenené. Presmerujeme vás na prihlásenie…</p>
        <Link href="/prihlasenie" className="text-sm text-club-600 hover:underline">
          Prejsť na prihlásenie
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nové heslo</label>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Zopakujte heslo</label>
        <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="w-full rounded-md bg-club-600 px-4 py-2 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
      >
        {loading ? 'Ukladám…' : 'Nastaviť nové heslo'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-club-50 px-6">
      <div className="w-full max-w-md rounded-lg border border-club-100 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-club-600 hover:underline">
          ← fkknv.sk
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-club-900">Nastavenie nového hesla</h1>
        <Suspense fallback={<p className="mt-6 text-sm text-gray-500">Načítavam…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
