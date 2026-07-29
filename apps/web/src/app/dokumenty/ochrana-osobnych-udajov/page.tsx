import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ochrana osobných údajov — FK Košická Nová Ves',
};

/**
 * VZOR dokumentu — pracovná verzia. Pred zverejnením ho nahradí právne
 * overená verzia od advokáta. Text je len orientačný.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-club-50 px-6 py-12">
      <article className="mx-auto max-w-3xl space-y-5 rounded-lg border border-club-100 bg-white p-8 text-sm leading-relaxed text-gray-700 shadow-sm">
        <Link href="/registracia" className="text-sm text-club-600 hover:underline">
          ← Späť na registráciu
        </Link>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Toto je <strong>vzorový (pracovný) dokument</strong>. Bude nahradený právne overenou verziou. Slúži len na
          účely spustenia portálu.
        </div>

        <h1 className="text-2xl font-bold text-club-900">Zásady ochrany osobných údajov a informácie o spracúvaní (GDPR)</h1>
        <p className="text-gray-500">Účinné od: [dátum] · Prevádzkovateľ: FK Košická Nová Ves, [adresa], IČO: [IČO]</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">1. Kto sme (prevádzkovateľ)</h2>
          <p>
            Prevádzkovateľom osobných údajov je futbalový klub FK Košická Nová Ves so sídlom [adresa], IČO [IČO]
            (ďalej len „klub"). Kontakt vo veciach ochrany údajov: [e-mail], [telefón].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">2. Aké údaje spracúvame</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>identifikačné údaje hráča: meno, priezvisko, rodné číslo, dátum narodenia, pohlavie,</li>
            <li>kontaktné údaje a bydlisko hráča a zákonného zástupcu (adresa, e-mail, telefón),</li>
            <li>registračné údaje (registračné číslo, klubová príslušnosť, platnosť registračného preukazu),</li>
            <li>fotografiu hráča (ak ju poskytnete), údaje o dochádzke, zápasoch a členských platbách.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">3. Na aký účel a na akom právnom základe</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>vedenie členstva a športovej činnosti klubu (plnenie zmluvy / oprávnený záujem),</li>
            <li>registrácia hráča v príslušnom športovom zväze (plnenie zákonnej povinnosti a zmluvy),</li>
            <li>evidencia a spracovanie členských poplatkov (plnenie zmluvy, účtovné povinnosti),</li>
            <li>zverejňovanie fotografií z tréningov a zápasov výlučne na základe vášho <em>súhlasu</em> (nepovinné).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">4. Ako dlho údaje uchovávame</h2>
          <p>
            Údaje uchovávame po dobu členstva a následne po dobu vyžadovanú právnymi predpismi (napr. účtovné doklady).
            Súhlasy (napr. fotografie) spracúvame do ich odvolania.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">5. Komu údaje sprístupňujeme</h2>
          <p>
            Príslušnému športovému zväzu (registrácia hráča), poskytovateľom IT služieb (prevádzka portálu) a
            orgánom verejnej moci, ak to vyžaduje zákon. Údaje neposkytujeme na reklamné účely.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">6. Vaše práva</h2>
          <p>
            Máte právo na prístup k údajom, ich opravu, výmaz, obmedzenie spracúvania, prenosnosť, namietať proti
            spracúvaniu a kedykoľvek odvolať udelený súhlas. Máte tiež právo podať sťažnosť dozornému orgánu (Úrad na
            ochranu osobných údajov SR).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">7. Cookies a lokálne úložisko</h2>
          <p>
            Portál používa iba technicky nevyhnutné lokálne úložisko potrebné na prihlásenie a fungovanie. Nepoužívame
            sledovacie ani reklamné cookies.
          </p>
        </section>

        <p className="pt-4 text-xs text-gray-400">
          Vzor pripravený pre potreby portálu fkknv.sk. Finálne znenie potvrdí právnik klubu.
        </p>
      </article>
    </main>
  );
}
