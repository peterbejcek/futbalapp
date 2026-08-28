'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

const inputCls = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(result.accessToken);
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prihlásenie zlyhalo');
    } finally {
      setLoading(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa odoslať');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-club-50 px-6">
      <div className="w-full max-w-md rounded-lg border border-club-100 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-club-600 hover:underline">
          ← fkknv.sk
        </Link>

        {mode === 'login' ? (
          <>
            <h1 className="mt-4 text-2xl font-bold text-club-900">Prihlásenie do portálu</h1>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Heslo</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full rounded-md bg-club-600 px-4 py-2 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
              >
                {loading ? 'Prihlasujem…' : 'Prihlásiť sa'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
              }}
              className="mt-4 text-sm text-club-600 hover:underline"
            >
              Zabudli ste heslo?
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold text-club-900">Obnovenie hesla</h1>
            {forgotSent ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Ak je e-mail <strong>{email}</strong> v systéme, poslali sme naň odkaz na nastavenie nového hesla.
                  Skontrolujte aj priečinok spam. Odkaz je platný 1 hodinu.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotSent(false);
                  }}
                  className="text-sm text-club-600 hover:underline"
                >
                  ← Späť na prihlásenie
                </button>
              </div>
            ) : (
              <form onSubmit={onForgot} className="mt-6 space-y-4">
                <p className="text-sm text-gray-600">Zadajte e-mail, ktorým sa prihlasujete. Pošleme naň odkaz na obnovenie hesla.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-mail</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full rounded-md bg-club-600 px-4 py-2 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
                >
                  {loading ? 'Odosielam…' : 'Poslať odkaz'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-sm text-club-600 hover:underline"
                >
                  ← Späť na prihlásenie
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
