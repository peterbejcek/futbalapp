'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type ApplicantType = 'CHILD' | 'ADULT';

export default function RegistrationPage() {
  const [type, setType] = useState<ApplicantType>('CHILD');
  const [ownLogin, setOwnLogin] = useState(false); // staršie dieťa chce vlastné prihlásenie
  const [submitted, setSubmitted] = useState(false);
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

  const isAdult = type === 'ADULT';
  const wantPlayerEmail = isAdult || ownLogin;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api('/registration', {
        method: 'POST',
        body: JSON.stringify({
          applicantType: type,
          player: {
            firstName: data.get('playerFirstName'),
            lastName: data.get('playerLastName'),
            birthDate: data.get('birthDate'),
            healthNotes: data.get('healthNotes') || undefined,
            email: wantPlayerEmail ? data.get('playerEmail') : undefined,
          },
          parent: isAdult
            ? undefined
            : {
                firstName: data.get('parentFirstName'),
                lastName: data.get('parentLastName'),
                email: data.get('parentEmail'),
                phone: data.get('phone'),
                relation: data.get('relation'),
              },
          consents: {
            gdpr: data.get('gdpr') === 'on',
            photos: data.get('photos') === 'on',
          },
          note: data.get('note') || undefined,
          captcha: { token: captcha?.token, answer: captchaAnswer },
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odoslanie zlyhalo');
      reloadCaptcha(); // nový obrázok po neúspechu
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-club-50 px-6">
        <div className="max-w-md rounded-lg border border-club-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-club-800">Prihláška odoslaná ✓</h1>
          <p className="mt-3 text-gray-600">
            Ďakujeme! Klub prihlášku skontroluje a ozveme sa vám s ďalšími krokmi.
          </p>
          <Link href="/" className="mt-6 inline-block text-club-600 hover:underline">
            ← Späť na úvod
          </Link>
        </div>
      </main>
    );
  }

  const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none';
  const label = 'block text-sm font-medium text-gray-700';

  return (
    <main className="min-h-screen bg-club-50 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-lg border border-club-100 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-club-600 hover:underline">
          ← fkknv.sk
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-club-900">Registrácia nového člena</h1>

        {/* Výber typu registrácie */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setType('CHILD')}
            className={`rounded-md border px-4 py-3 text-left text-sm ${
              type === 'CHILD' ? 'border-club-600 bg-club-50 font-semibold text-club-800' : 'border-gray-300 text-gray-600'
            }`}
          >
            Registrujem dieťa
            <span className="block text-xs font-normal text-gray-500">vypĺňa rodič / zákonný zástupca</span>
          </button>
          <button
            type="button"
            onClick={() => setType('ADULT')}
            className={`rounded-md border px-4 py-3 text-left text-sm ${
              type === 'ADULT' ? 'border-club-600 bg-club-50 font-semibold text-club-800' : 'border-gray-300 text-gray-600'
            }`}
          >
            Som dospelý hráč
            <span className="block text-xs font-normal text-gray-500">registrujem sa sám za seba</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <fieldset className="space-y-4">
            <legend className="font-semibold text-club-800">{isAdult ? 'Hráč (vy)' : 'Dieťa / hráč'}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Meno</label>
                <input name="playerFirstName" required minLength={2} className={input} />
              </div>
              <div>
                <label className={label}>Priezvisko</label>
                <input name="playerLastName" required minLength={2} className={input} />
              </div>
            </div>
            <div>
              <label className={label}>Dátum narodenia</label>
              <input name="birthDate" type="date" required className={input} />
              <p className="mt-1 text-xs text-gray-500">Podľa dátumu narodenia zaradíme hráča do vekovej kategórie.</p>
            </div>
            <div>
              <label className={label}>Zdravotné obmedzenia (nepovinné)</label>
              <textarea name="healthNotes" rows={2} className={input} />
            </div>

            {/* vlastné prihlásenie hráča */}
            {isAdult ? (
              <div>
                <label className={label}>Váš e-mail (prihlásenie)</label>
                <input name="playerEmail" type="email" required className={input} />
              </div>
            ) : (
              <div className="rounded-md bg-club-50 p-3">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={ownLogin} onChange={(e) => setOwnLogin(e.target.checked)} className="mt-1" />
                  <span>
                    Vytvoriť aj vlastné prihlásenie pre hráča
                    <span className="block text-xs text-gray-500">pre starších hráčov, ktorí chcú vlastný prístup</span>
                  </span>
                </label>
                {ownLogin && (
                  <div className="mt-2">
                    <label className={label}>E-mail hráča</label>
                    <input name="playerEmail" type="email" required className={input} />
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* Rodič — len pre dieťa */}
          {!isAdult && (
            <fieldset className="space-y-4">
              <legend className="font-semibold text-club-800">Rodič / zákonný zástupca</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Meno</label>
                  <input name="parentFirstName" required minLength={2} className={input} />
                </div>
                <div>
                  <label className={label}>Priezvisko</label>
                  <input name="parentLastName" required minLength={2} className={input} />
                </div>
                <div>
                  <label className={label}>E-mail</label>
                  <input name="parentEmail" type="email" required className={input} />
                </div>
                <div>
                  <label className={label}>Telefón</label>
                  <input name="phone" type="tel" required minLength={9} className={input} />
                </div>
              </div>
              <div>
                <label className={label}>Vzťah k dieťaťu</label>
                <select name="relation" required className={input}>
                  <option value="MOTHER">Matka</option>
                  <option value="FATHER">Otec</option>
                  <option value="GUARDIAN">Zákonný zástupca</option>
                </select>
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="gdpr" required className="mt-1" />
              <span>Súhlasím so spracovaním osobných údajov na účely členstva v klube (povinné).</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="photos" className="mt-1" />
              <span>Súhlasím so zverejňovaním fotografií z tréningov a zápasov (nepovinné).</span>
            </label>
          </fieldset>

          <div>
            <label className={label}>Poznámka pre klub (nepovinné)</label>
            <textarea name="note" rows={2} className={input} />
          </div>

          {/* Overenie, že ide o človeka (CAPTCHA) */}
          <div>
            <label className={label}>Opíšte kód z obrázka</label>
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
                className={`${input} flex-1`}
                placeholder="Kód z obrázka"
                aria-label="Kód z obrázka"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Ochrana proti automatickému spamu.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !captcha || !captchaAnswer}
            className="w-full rounded-md bg-club-600 px-4 py-3 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
          >
            {loading ? 'Odosielam…' : 'Odoslať prihlášku'}
          </button>
        </form>
      </div>
    </main>
  );
}
