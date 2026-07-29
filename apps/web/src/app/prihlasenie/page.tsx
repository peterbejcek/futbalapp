'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<{ token: string; svg: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const reloadCaptcha = useCallback(() => {
    setCaptchaAnswer('');
    api<{ token: string; svg: string }>('/captcha')
      .then(setCaptcha)
      .catch(() => setCaptcha(null));
  }, []);
  useEffect(() => {
    reloadCaptcha();
  }, [reloadCaptcha]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, captcha: { token: captcha?.token, answer: captchaAnswer } }),
      });
      setToken(result.accessToken);
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prihlásenie zlyhalo');
      reloadCaptcha();
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
        <h1 className="mt-4 text-2xl font-bold text-club-900">Prihlásenie do portálu</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Heslo</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Opíšte kód z obrázka</label>
            <div className="mt-1 flex items-center gap-3">
              <span
                className="inline-flex h-12 w-[150px] items-center justify-center overflow-hidden rounded-md border border-gray-300 bg-slate-100"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: captcha?.svg ?? '' }}
              />
              <button
                type="button"
                onClick={reloadCaptcha}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                title="Nový kód"
              >
                ↻
              </button>
              <input
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
                autoComplete="off"
                placeholder="Kód z obrázka"
                aria-label="Kód z obrázka"
                className="mt-1 w-full flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !captcha || !captchaAnswer}
            className="w-full rounded-md bg-club-600 px-4 py-2 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
          >
            {loading ? 'Prihlasujem…' : 'Prihlásiť sa'}
          </button>
        </form>
      </div>
    </main>
  );
}
