import Link from 'next/link';

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
      <header className="bg-club-800 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-club-800">FK</div>
            <span className="text-lg font-semibold">FK Košická Nová Ves</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/registracia" className="text-sm text-club-100 hover:text-white">
              Registrácia člena
            </Link>
            <Link
              href="/prihlasenie"
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-club-800 hover:bg-club-50"
            >
              Prihlásiť sa
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-club-800 to-club-600 px-6 py-20 text-center text-white">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Klubový portál pre hráčov, rodičov a trénerov
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-club-100">
          Členské poplatky, dochádzka, zápasy aj komunikácia — všetko pre FK Košická Nová Ves na jednom mieste,
          na webe aj v mobile.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/registracia"
            className="rounded-md bg-white px-6 py-3 font-semibold text-club-800 hover:bg-club-50"
          >
            Zaregistrovať dieťa
          </Link>
          <Link
            href="/prihlasenie"
            className="rounded-md border border-club-200 px-6 py-3 font-semibold text-white hover:bg-club-700"
          >
            Vstup do portálu
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-club-900">Čo portál rieši</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-club-100 p-6 shadow-sm">
              <h3 className="font-semibold text-club-800">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-club-100 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} FK Košická Nová Ves · fkknv.sk
      </footer>
    </main>
  );
}
