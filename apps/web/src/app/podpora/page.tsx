import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Podpora — FK Košická Nová Ves',
  description:
    'Kontakt na klubovú podporu portálu a mobilnej aplikácie FK KNV: prihlásenie, heslo, notifikácie, prístup pre nových členov.',
};

/**
 * Verejná stránka podpory. Uvádza sa ako Support URL v App Store Connect
 * a v Google Play (Guideline 1.5 — musí byť dostupná bez prihlásenia
 * a obsahovať funkčný kontakt na podporu).
 */
const SUPPORT_EMAIL = 'podpora@fkknv.sk';

const TOPICS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'Ako získam prístup do portálu a aplikácie?',
    a: (
      <>
        Prístup vytvára vedenie klubu členom FK Košická Nová Ves. Nový hráč alebo rodič podá{' '}
        <Link href="/registracia" className="text-club-700 hover:underline">
          prihlášku do klubu
        </Link>
        . Po jej schválení prídu prihlasovacie údaje e-mailom. Mobilná aplikácia neumožňuje vytvorenie
        konta — slúži na zobrazenie klubových údajov po prihlásení.
      </>
    ),
  },
  {
    q: 'Zabudol som heslo alebo mi neprišli prihlasovacie údaje',
    a: (
      <>
        Použite{' '}
        <Link href="/prihlasenie" className="text-club-700 hover:underline">
          obnovenie hesla
        </Link>{' '}
        (v aplikácii „Zabudli ste heslo?“) a skontrolujte aj spam. Ak e-mail nedorazí, napíšte nám na{' '}
        {SUPPORT_EMAIL} a prístup obnovíme.
      </>
    ),
  },
  {
    q: 'Prihlásenie mi nefunguje',
    a: <>Napíšte nám e-mail, ktorým sa prihlasujete, a čo presne sa zobrazí. Konto overíme a odblokujeme.</>,
  },
  {
    q: 'Nechodia mi notifikácie',
    a: (
      <>
        Skontrolujte, že má aplikácia povolené notifikácie v nastaveniach telefónu a že ste prihlásený. Ak to
        nepomôže, napíšte nám typ telefónu (iPhone / Android) a e-mail konta.
      </>
    ),
  },
  {
    q: 'Chcem opraviť alebo vymazať svoje údaje',
    a: (
      <>
        Napíšte nám na {SUPPORT_EMAIL} — údaje opravíme, prípadne konto a osobné údaje vymažeme v rozsahu,
        v akom nám ich nemusíme uchovávať zo zákona. Podrobnosti sú v{' '}
        <Link href="/dokumenty/ochrana-osobnych-udajov" className="text-club-700 hover:underline">
          zásadách ochrany osobných údajov
        </Link>
        .
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-club-50 px-6 py-12">
      <article className="mx-auto max-w-3xl space-y-6 rounded-lg border border-club-100 bg-white p-8 text-sm leading-relaxed text-gray-700 shadow-sm">
        <Link href="/" className="text-sm text-club-600 hover:underline">
          ← Späť na hlavnú stránku
        </Link>

        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-club-900">Podpora</h1>
          <p>
            Pomoc s klubovým portálom <strong>fkknv.sk</strong> a s mobilnou aplikáciou{' '}
            <strong>FK KNV</strong> pre iPhone a Android.
          </p>
        </header>

        <section className="rounded-md border border-club-100 bg-club-50 p-5">
          <h2 className="font-semibold text-club-800">Kontakt</h2>
          <p className="mt-2">
            E-mail:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-club-700 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-2 text-gray-600">
            Odpovedáme obvykle do 2 pracovných dní. Podporu zabezpečuje vedenie FK Košická Nová Ves.
          </p>
          <p className="mt-3 text-gray-600">
            Aby sme vám pomohli rýchlo, uveďte prosím: <strong>e-mail konta</strong>, či ide o{' '}
            <strong>web alebo mobilnú aplikáciu</strong>, typ telefónu a popis problému (prípadne screenshot).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-club-800">Najčastejšie otázky</h2>
          {TOPICS.map((t) => (
            <div key={t.q} className="rounded-md border border-club-100 p-4">
              <h3 className="font-semibold text-club-800">{t.q}</h3>
              <p className="mt-1">{t.a}</p>
            </div>
          ))}
          <p className="text-gray-600">
            Po prihlásení je v portáli podrobnejší návod v sekcii <strong>Pomoc</strong>.
          </p>
        </section>

        <footer className="border-t border-club-100 pt-4 text-xs text-gray-500">
          FK Košická Nová Ves ·{' '}
          <Link href="/dokumenty/ochrana-osobnych-udajov" className="text-club-600 hover:underline">
            Ochrana osobných údajov
          </Link>{' '}
          ·{' '}
          <Link href="/prihlasenie" className="text-club-600 hover:underline">
            Prihlásenie
          </Link>
        </footer>
      </article>
    </main>
  );
}
