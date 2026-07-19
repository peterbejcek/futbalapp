import Image from 'next/image';
import Link from 'next/link';

const CLUB_WEB = 'https://www.fkkosickanovaves.sk/';

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
