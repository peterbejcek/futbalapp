import Image from 'next/image';
import Link from 'next/link';

const CLUB_WEB = 'https://www.fkkosickanovaves.sk/';
const ANDROID_APP_URL =
  'https://expo.dev/accounts/petobejos-team/projects/fkknv/builds/b9701b5a-7fd9-4c93-a0fa-647bb27e8495';

const features = [
  { title: 'Stav klubu na pár klikov', text: 'Platby, členovia aj kalendár tréningov a podujatí. Vždy prehľadne, vždy aktuálne.' },
  { title: 'Správa financií', text: 'Automatické spracovanie platieb — od predpisov a termínov až po párovanie s bankou.' },
  { title: 'Správa členov', text: 'Prehľadný adresár členov s kompletnými údajmi na dosah ruky.' },
  { title: 'Evidencia dochádzky', text: 'Tréningy, priradení hráči a účasť odkliknutá priamo pri ihrisku.' },
  { title: 'Zápasy a nominácie', text: 'Plán zápasov a turnajov, nominácie a živý zápis gólov s minutážou.' },
  { title: 'Komunikácia', text: 'Správy rodičom a hráčom podľa kategórií. Všetko na jednom mieste.' },
];

export default function HomePage() {
  return (
    <main>
      <header className="bg-club-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Erb FK Košická Nová Ves" width={40} height={64} priority className="h-14 w-auto" />
            <span className="text-lg font-semibold">FK Košická Nová Ves</span>
          </div>
          <nav className="flex items-center gap-4">
            <a href={CLUB_WEB} target="_blank" rel="noopener noreferrer" className="hidden text-sm text-club-100 hover:text-white sm:inline">
              Web klubu ↗
            </a>
            <Link href="/registracia" className="text-sm text-club-100 hover:text-white">
              Registrácia
            </Link>
            <Link
              href="/prihlasenie"
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-club-900 hover:bg-club-50"
            >
              Prihlásiť sa
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-club-900 to-club-700 px-6 py-16 text-white">
        {/* červený akcent podľa erbu */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-brandred-500" />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:max-w-xl md:text-left">
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Klubový portál pre hráčov, rodičov a trénerov
            </h1>
            <p className="mt-4 text-lg text-club-100">
              Členské poplatky, dochádzka, zápasy aj komunikácia — všetko pre FK Košická Nová Ves na jednom
              mieste, na webe aj v mobile.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link
                href="/registracia"
                className="rounded-md bg-brandred-500 px-6 py-3 font-semibold text-white hover:bg-brandred-600"
              >
                Zaregistrovať dieťa
              </Link>
              <Link
                href="/prihlasenie"
                className="rounded-md bg-white px-6 py-3 font-semibold text-club-900 hover:bg-club-50"
              >
                Vstup do portálu
              </Link>
            </div>
          </div>
          <div className="shrink-0">
            <Image
              src="/logo.png"
              alt="Erb FK Košická Nová Ves"
              width={220}
              height={352}
              priority
              className="h-56 w-auto drop-shadow-2xl sm:h-72"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-16">
        <h2 className="text-center text-2xl font-bold text-club-900">Mobilná aplikácia</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Portál máte aj v telefóne — prihlásenie, kalendár, dochádzka aj komunikácia.
        </p>
        <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
          {/* Android */}
          <div className="flex flex-col items-center rounded-lg border border-club-100 p-6 text-center shadow-sm">
            <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden>
              <path
                fill="#3DDC84"
                d="M17.6 9.48l1.84-3.18a.38.38 0 00-.14-.52.38.38 0 00-.52.14l-1.86 3.23a11.4 11.4 0 00-9.84 0L5.22 5.92a.38.38 0 00-.52-.14.38.38 0 00-.14.52L6.4 9.48A10.8 10.8 0 001.16 16.9h21.68A10.8 10.8 0 0017.6 9.48zM7 14.13a1.06 1.06 0 110-2.12 1.06 1.06 0 010 2.12zm10 0a1.06 1.06 0 110-2.12 1.06 1.06 0 010 2.12z"
              />
            </svg>
            <h3 className="mt-3 font-semibold text-club-800">Android</h3>
            <p className="mt-1 text-sm text-gray-600">Aplikáciu pre Android stiahnite tu:</p>
            <a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block">
              <Image
                src="/app-android-qr.png"
                alt="QR kód na stiahnutie aplikácie pre Android"
                width={180}
                height={180}
                className="rounded-md border border-club-100"
              />
            </a>
            <a
              href={ANDROID_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-md bg-club-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-club-800"
            >
              Stiahnuť pre Android
            </a>
          </div>
          {/* iOS */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-club-100 p-6 text-center shadow-sm">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-club-800" fill="currentColor" aria-hidden>
              <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.84.95-2.2 1.68-3.34 1.59-.14-1.13.42-2.32 1.06-3.06.84-.95 2.3-1.66 3.39-1.51zM20.9 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.98-1.73-.02-3.05-1.77-4.04-3.33C.32 15.86-.16 11.28 1.71 8.85c.99-1.29 2.56-2.11 4.24-2.13 1.6-.02 3.11 1.08 4.02 1.08.9 0 2.71-1.34 4.56-1.14.78.03 2.96.31 4.36 2.37-3.7 2.02-3.1 6.66.01 7.99z" />
            </svg>
            <h3 className="mt-3 font-semibold text-club-800">iOS (iPhone)</h3>
            <p className="mt-2 text-sm text-gray-600">Na aplikácii sa pracuje.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-club-900">Čo portál rieši</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-club-100 p-6 shadow-sm">
              <div className="mb-2 h-1 w-10 rounded bg-brandred-500" />
              <h3 className="font-semibold text-club-800">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-club-100 py-8 text-center text-sm text-gray-500">
        <p>
          © {new Date().getFullYear()} FK Košická Nová Ves · fkknv.sk ·{' '}
          <a href={CLUB_WEB} target="_blank" rel="noopener noreferrer" className="text-club-700 hover:underline">
            fkkosickanovaves.sk ↗
          </a>
        </p>
      </footer>
    </main>
  );
}
