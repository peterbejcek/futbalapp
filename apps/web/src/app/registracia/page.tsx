'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function RegistrationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api('/registration', {
        method: 'POST',
        body: JSON.stringify({
          child: {
            firstName: data.get('childFirstName'),
            lastName: data.get('childLastName'),
            birthDate: data.get('birthDate'),
            healthNotes: data.get('healthNotes') || undefined,
          },
          parent: {
            firstName: data.get('parentFirstName'),
            lastName: data.get('parentLastName'),
            email: data.get('email'),
            phone: data.get('phone'),
            relation: data.get('relation'),
          },
          consents: {
            gdpr: data.get('gdpr') === 'on',
            photos: data.get('photos') === 'on',
          },
          note: data.get('note') || undefined,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odoslanie zlyhalo');
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
            Ďakujeme! Klub prihlášku skontroluje a ozveme sa vám e-mailom s ďalšími krokmi.
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
        <p className="mt-2 text-sm text-gray-600">
          Vyplňte údaje dieťaťa a kontakt na rodiča / zákonného zástupcu. Po schválení prihlášky vám vytvoríme
          prístup do portálu.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <fieldset className="space-y-4">
            <legend className="font-semibold text-club-800">Dieťa / hráč</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Meno</label>
                <input name="childFirstName" required minLength={2} className={input} />
              </div>
              <div>
                <label className={label}>Priezvisko</label>
                <input name="childLastName" required minLength={2} className={input} />
              </div>
            </div>
            <div>
              <label className={label}>Dátum narodenia</label>
              <input name="birthDate" type="date" required className={input} />
              <p className="mt-1 text-xs text-gray-500">Podľa dátumu narodenia dieťa zaradíme do vekovej kategórie.</p>
            </div>
            <div>
              <label className={label}>Zdravotné obmedzenia (nepovinné)</label>
              <textarea name="healthNotes" rows={2} className={input} />
            </div>
          </fieldset>

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
                <input name="email" type="email" required className={input} />
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

          <fieldset className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="gdpr" required className="mt-1" />
              <span>
                Súhlasím so spracovaním osobných údajov na účely členstva v klube (povinné).
              </span>
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-club-600 px-4 py-3 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
          >
            {loading ? 'Odosielam…' : 'Odoslať prihlášku'}
          </button>
        </form>
      </div>
    </main>
  );
}
