'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { canManage, isStaff, isParent, useMe, type Me } from '@/lib/auth';
import { Card } from '@/components/ui';

interface Ctx {
  staff: boolean;
  manage: boolean;
  parent: boolean;
}
interface Faq {
  q: string;
  a: ReactNode;
  show?: (ctx: Ctx) => boolean;
}
interface Section {
  title: string;
  items: Faq[];
  show?: (ctx: Ctx) => boolean;
}

const SECTIONS: Section[] = [
  {
    title: 'Prihlásenie a konto',
    items: [
      {
        q: 'Ako sa prihlásim?',
        a: (
          <>
            Prihláste sa e-mailom a heslom na <strong>fkknv.sk</strong> (alebo v mobilnej aplikácii). Prístupové
            údaje vám po schválení registrácie príde e-mailom, prípadne vám ich odovzdá vedenie klubu.
          </>
        ),
      },
      {
        q: 'Zabudol som heslo, čo teraz?',
        a: (
          <>
            Na prihlasovacej stránke kliknite na <strong>„Zabudnuté heslo"</strong>, zadajte svoj e-mail a príde vám
            odkaz na nastavenie nového hesla (platí 1 hodinu).
          </>
        ),
      },
      {
        q: 'Ako si zmením heslo?',
        a: (
          <>
            Po prihlásení kliknite vpravo hore na svoje meno (<Link href="/portal/heslo" className="text-club-600 underline">Zmena hesla</Link>) a
            zadajte nové heslo. Dočasné heslo si odporúčame zmeniť hneď po prvom prihlásení.
          </>
        ),
      },
    ],
  },
  {
    title: 'Kalendár a udalosti',
    items: [
      {
        q: 'Aké udalosti v kalendári nájdem?',
        a: (
          <>
            Tréningy, zápasy a turnaje, rodičovské združenia a klubové podujatia. Prepínať môžete medzi zoznamom
            <em> Najbližšie</em> a <em>Mesačným</em> pohľadom. Každý typ má svoju farbu; zápasy v mesačnom pohľade sú
            vo farbe družstva a majú pri sebe označenie družstva (napr. <em>08:00 U13A ⚽ Súper</em>).
          </>
        ),
      },
      {
        q: 'Ako zistím, že som (alebo moje dieťa) nominovaný na zápas?',
        a: (
          <>
            Pri zápase, na ktorý ste nominovaný vy alebo vaše dieťa, sa zobrazí zelené označenie <strong>„Nominovaný"</strong> —
            v kalendári aj na úvodnom prehľade / dashboarde v aplikácii.
          </>
        ),
      },
      {
        q: 'Čo znamená „rodičovské združenie"?',
        a: (
          <>
            Je to typ udalosti pre vybrané družstvá alebo celý klub. Pri udalosti vidíte, koho sa týka (riadok
            <em> „Pre: …"</em>), a zobrazuje sa aj na úvodnom prehľade.
          </>
        ),
      },
      {
        q: 'Prečo nevidím všetky družstvá, len tie svoje?',
        show: ({ manage }) => !manage,
        a: (
          <>
            Rodič a hráč vidí v kalendári a komunikácii len udalosti a kanály svojich (resp. detských) družstiev a
            celoklubové oznamy. Vedenie a tréneri vidia viac podľa svojej roly.
          </>
        ),
      },
      {
        q: 'Ako vytvorím tréning, zápas alebo rodičovské združenie?',
        show: ({ manage }) => manage,
        a: (
          <>
            V Kalendári vpravo hore sú tlačidlá <strong>+ Tréning</strong>, <strong>+ Rodičovské</strong> a
            <strong> + Zápas / turnaj</strong>. Tréner môže vytvárať udalosti pre svoje družstvá, vedenie pre celý klub.
          </>
        ),
      },
    ],
  },
  {
    title: 'Dochádzka a nominácie',
    items: [
      {
        q: 'Kto vidí a zapisuje dochádzku na tréning?',
        a: (
          <>
            Detail tréningu s dochádzkou vidí a zapisuje len <strong>tréner daného družstva</strong> a
            <strong> vedenie klubu</strong>. Rodičia a hráči dochádzku iných nevidia.
          </>
        ),
      },
      {
        q: 'Ako potvrdím účasť na zápase?',
        a: (
          <>
            Pri družstvách <strong>U17, U19 a Muži</strong> hráč (alebo rodič) potvrdzuje účasť na nominovanom zápase
            priamo v aplikácii/portáli pri danej nominácii. Pri mladších kategóriách sa účasť nepotvrdzuje.
          </>
        ),
      },
      {
        q: 'Ako nominujem hráčov a pošlem im oznam?',
        show: ({ manage }) => manage,
        a: (
          <>
            V detaile zápasu vyklikáte nominovaných hráčov. Tlačidlom <strong>„✉ Rozposlať oznam e-mailom"</strong> im
            (a rodičom) pošlete oznam; systém zároveň vypíše hráčov, ktorí nemajú konto s e-mailom ani rodiča s
            e-mailom, takže ich oslovíte inak.
          </>
        ),
      },
    ],
  },
  {
    title: 'Komunikácia',
    items: [
      {
        q: 'Aké kanály uvidím?',
        a: (
          <>
            Celoklubové oznamy a kanály svojich (resp. detských) družstiev — Oznamy, Tréningy a Všeobecné. Tréneri a
            vedenie majú navyše interný kanál.
          </>
        ),
      },
      {
        q: 'Ako spoznám neprečítané správy?',
        a: (
          <>
            Kanál s neprečítanými správami je zvýraznený (tučne, s počtom neprečítaných; skupina má farebnú bodku).
            Otvorením kanála sa správy označia za prečítané.
          </>
        ),
      },
      {
        q: 'Môžem priložiť fotku alebo dokument?',
        a: (
          <>
            Áno — v kanáli kliknite na 📎 a vyberte obrázok alebo dokument. Na mobile vyberáte z fotiek alebo súborov.
          </>
        ),
      },
    ],
  },
  {
    title: 'Registrácia a členovia',
    items: [
      {
        q: 'Ako zaregistrujem seba alebo dieťa do klubu?',
        a: (
          <>
            Cez verejný formulár na <strong>fkknv.sk/registracia</strong>. Rodič môže zaregistrovať jedno či viac detí,
            alebo si vytvoriť konto, ak sú deti už členmi. Dospelý hráč sa registruje sám za seba. Po odoslaní
            prihlášku schvaľuje vedenie a príde vám e-mail s prístupom.
          </>
        ),
      },
      {
        q: 'Ako schválim registráciu a priradím dieťa?',
        show: ({ staff }) => staff,
        a: (
          <>
            V menu <strong>Klub → Registrácie</strong> otvorte prihlášku cez <em>„Detail / priradiť"</em>, skontrolujte
            údaje, prípadne priraďte existujúceho hráča a schváľte. Ak je hráč už členom, priradí sa k rodičovi bez
            duplikátu.
          </>
        ),
      },
      {
        q: 'Ako nájdem člena v zozname?',
        show: ({ manage }) => manage,
        a: (
          <>
            V menu <strong>Klub → Členovia</strong> je pole <em>„Hľadať"</em> podľa priezviska (bez ohľadu na diakritiku)
            a filtre podľa družstva a funkcie.
          </>
        ),
      },
    ],
  },
  {
    title: 'Platby a príspevky',
    items: [
      {
        q: 'Kde vidím svoje platby a členský príspevok?',
        a: (
          <>
            V menu <strong>Klub → Príspevok</strong> vidíte predpis a stav svojich (resp. detských) platieb vrátane
            údajov na úhradu.
          </>
        ),
      },
    ],
  },
  {
    title: 'Tabuľka a štatistiky',
    items: [
      {
        q: 'Ako si pozriem tabuľku a program súťaže?',
        a: (
          <>
            V menu <strong>Tabuľka</strong> vyberte hore družstvo (aj A/B) a prepínajte medzi <em>Tabuľka</em> a
            <em> Program</em>. Údaje sa načítavajú z futbalnet / sportnet.sme.sk.
          </>
        ),
      },
      {
        q: 'Kde nájdem štatistiky a dochádzkové prehľady?',
        show: ({ manage }) => manage,
        a: (
          <>
            V menu <strong>Štatistiky</strong> — dochádzkový list družstva, štatistiky hráčov a prehľad zápasov.
          </>
        ),
      },
    ],
  },
  {
    title: 'Mobilná aplikácia',
    items: [
      {
        q: 'Kde stiahnem mobilnú aplikáciu?',
        a: (
          <>
            Odkaz na inštaláciu pre <strong>Android</strong> (vrátane QR kódu) nájdete na úvodnej stránke
            <strong> fkknv.sk</strong>. Verzia pre iPhone (App Store) sa pripravuje.
          </>
        ),
      },
      {
        q: 'Nechodia mi notifikácie na Androide.',
        a: (
          <>
            Skontrolujte, či má aplikácia povolené upozornenia v nastaveniach telefónu. Ak ste práve nainštalovali
            novú verziu, po prvom prihlásení sa zariadenie zaregistruje; ak problém pretrváva, napíšte vedeniu klubu.
          </>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  const { me } = useMe();
  const ctx = useMemo<Ctx>(
    () => ({ staff: isStaff(me), manage: canManage(me), parent: isParent(me) }),
    [me],
  );

  const sections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.show || i.show(ctx)),
  })).filter((s) => (!s.show || s.show(ctx)) && s.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-club-900">Pomoc a časté otázky</h1>
        <p className="mt-1 text-sm text-gray-600">
          Stručný návod, ako používať portál FK Košická Nová Ves. Kliknutím na otázku sa rozbalí odpoveď.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="font-semibold text-club-800">{section.title}</h2>
          <Card className="p-0">
            <ul className="divide-y divide-club-100">
              {section.items.map((item, i) => (
                <li key={i}>
                  <details className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-club-900 hover:bg-club-50">
                      {item.q}
                      <span className="text-club-400 transition-transform group-open:rotate-180">▾</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm leading-relaxed text-gray-700">{item.a}</div>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}

      <Card className="text-sm text-gray-600">
        Nenašli ste odpoveď? Napíšte vedeniu klubu cez{' '}
        <Link href="/portal/chat" className="text-club-600 underline">
          Komunikáciu
        </Link>{' '}
        alebo na{' '}
        <a href="mailto:support@fkknv.sk" className="text-club-600 underline">
          support@fkknv.sk
        </a>
        .
      </Card>
    </div>
  );
}
