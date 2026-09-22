import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ochrana osobných údajov — FK Košická Nová Ves',
};

/**
 * Zásady ochrany osobných údajov FK Košická Nová Ves.
 *
 * Dokument je doplnený o reálne údaje prevádzkovateľa (klub, sídlo, IČO,
 * kontakt) a je uvedený ako Privacy policy URL v App Store aj Google Play.
 * Pri zmene sprostredkovateľov (bod 5) alebo rozsahu spracúvaných údajov
 * (bod 2) treba text zosúladiť aj s deklaráciou v Google Data safety.
 * Právnu kontrolu textu odporúčame ponechať na advokáta klubu.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-club-50 px-6 py-12">
      <article className="mx-auto max-w-3xl space-y-5 rounded-lg border border-club-100 bg-white p-8 text-sm leading-relaxed text-gray-700 shadow-sm">
        <Link href="/registracia" className="text-sm text-club-600 hover:underline">
          ← Späť na registráciu
        </Link>

        <h1 className="text-2xl font-bold text-club-900">Zásady ochrany osobných údajov a informácie o spracúvaní (GDPR)</h1>
        <p className="text-gray-500">
          Účinné od: 1. 9. 2026 · Prevádzkovateľ: FK Košická Nová Ves, Agátová 1, 040 14 Košice,
          IČO: 31 942 059
        </p>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">1. Kto sme (prevádzkovateľ)</h2>
          <p>
            Prevádzkovateľom osobných údajov je futbalový klub <strong>FK Košická Nová Ves</strong> so sídlom
            Agátová 1, 040 14 Košice, IČO 31 942 059 (ďalej len „klub"). Klub určuje, aké údaje sa spracúvajú
            a na aký účel.
          </p>
          <p>
            Kontakt vo veciach ochrany osobných údajov (manažér klubu):{' '}
            <a href="mailto:fkknv1935@gmail.com" className="text-club-700 hover:underline">
              fkknv1935@gmail.com
            </a>
            , +421 903 903 936.
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
          <ul className="list-disc space-y-1 pl-5">
            <li>príslušnému športovému zväzu — registrácia hráča,</li>
            <li>
              <strong>MS Art Designe s. r. o.</strong> — vývoj, prevádzka a technická správa portálu
              a mobilnej aplikácie (sprostredkovateľ),
            </li>
            <li>Resend — doručovanie e-mailov z portálu (sprostredkovateľ),</li>
            <li>Expo — doručovanie push notifikácií do mobilnej aplikácie (sprostredkovateľ),</li>
            <li>orgánom verejnej moci, ak to vyžaduje zákon.</li>
          </ul>
          <p>
            Sprostredkovatelia spracúvajú údaje výlučne na pokyn klubu a na uvedený účel.{' '}
            <strong>Údaje neposkytujeme na reklamné účely a nepredávame ich.</strong>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-club-800">6. Vaše práva</h2>
          <p>
            Máte právo na prístup k údajom, ich opravu, výmaz, obmedzenie spracúvania, prenosnosť, namietať proti
            spracúvaniu a kedykoľvek odvolať udelený súhlas. Máte tiež právo podať sťažnosť dozornému orgánu (Úrad na
            ochranu osobných údajov SR).
          </p>
          <p>
            Žiadosť o opravu alebo vymazanie údajov podáte na kontakte uvedenom v bode 1, prípadne cez{' '}
            <Link href="/podpora#vymazanie-udajov" className="text-club-700 hover:underline">
              stránku podpory
            </Link>
            . Časť údajov môžeme byť povinní uchovať aj po vymazaní konta, ak to vyžadujú právne predpisy
            (napríklad účtovné doklady) — v takom prípade vás o rozsahu informujeme.
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
          Posledná aktualizácia: 1. 9. 2026 · FK Košická Nová Ves, Agátová 1, 040 14 Košice, IČO 31 942 059
        </p>
      </article>
    </main>
  );
}
