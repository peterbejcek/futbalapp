# Obsah starého webu na potvrdenie klubom

Podklad na potvrdenie obsahu prevzatého zo starého webu klubu (https://www.fkkosickanovaves.sk/). Zdroj stiahnutý 2026-10-14; web neuvádza dátum poslednej aktualizácie. Všetko v sekciách označených **ZASTARANÉ/NEOVERENÉ** môže byť neplatné a pred publikovaním ho musí potvrdiť klub. Dátový podklad: `apps/api/prisma/content-import/club-content.json`, importér: `apps/api/prisma/import-club-content.ts` (nespúšťa sa automaticky).

Stavy v importe: **Koncept** (neverejné), **Archív** (zreteľne označený historický obsah), **Publikované** (verejné ihneď po importe).

## Postup

1. Skontrolovať plán (dry-run, nič sa nezapisuje, vypíše cieľový host databázy; bez `DATABASE_URL` skončí chybou):
   ```bash
   cd /opt/fkknv/app/apps/api && DATABASE_URL=... pnpm content:import
   # voliteľne aj overenie súborov (stiahne ich a porovná SHA-256):
   cd /opt/fkknv/app/apps/api && DATABASE_URL=... pnpm content:import -- --verify-files
   ```
2. Až po kontrole hostu a plánu zapísať (iba text príkazu, nespúšťať bez rozhodnutia klubu):
   ```bash
   cd /opt/fkknv/app/apps/api && DATABASE_URL=... pnpm content:import -- --apply
   ```
   Import je idempotentný: záznamy s `confirmedAt` alebo upravené správcom preskočí, `confirmedAt` nikdy nenastavuje. Dokumenty sa sťahujú zo zdroja a ukladajú nezmenené len pri zhode SHA-256, inak sa uloží iba odkaz a vypíše sa varovanie.
3. **Pozor:** archívne články majú `publishedAt` z pôvodného dátumu a `isArchive = true`, preto sú po importe na webe viditeľné ako označený archív. Ak sa to nemá stať, pred `--apply` ich z manifestu odstrániť.
4. Potvrdenie a publikovanie v portáli: `/portal/obsah` → otvoriť stránku / osobu / dokument → skontrolovať a opraviť údaje → potvrdiť údaje klubom (nastaví sa dátum potvrdenia) → zmeniť stav na **Publikované**. Aktuálne tvrdenia (kontakty, funkcionári, tréneri) sa publikujú len po potvrdení; historický obsah ostáva ako **Archív**.

## Klubové informácie (o nás)

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Stránka „O nás“ | Stránka nemá žiadny text (iba menu) | https://www.fkkosickanovaves.sk/o-nas.html | neprevzaté | Dodať aktuálny text „O klube“ (nič nebolo vymyslené) |

## História

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| História futbalového klubu (slug `historia`) | Doslovný text (3893 znakov), zakladanie klubu 1935, názvy klubu, štadión 1974, zoznam osobností a hráčov, zápas „Horný a dolný koniec“ od 1951. Zdroj uvádza čerpanie z knihy „História a súčasnosť Košická Nová Ves“ (2010). Obsahuje pravopisné chyby zo zdroja (napr. „Futbalový kluv“, „majsrovstvách“). | https://www.fkkosickanovaves.sk/historia.html | **Publikované** | Overiť fakty a mená, opraviť preklepy, potvrdiť súhlas s uvedením osôb a práva k textu z knihy |

## Funkcionári

**ZASTARANÉ/NEOVERENÉ** (web nemá dátum aktualizácie). Všetko je v stave Koncept.

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Ing. Milan Lesňák | Predseda FK; +421915628912, mcknv@netkosice.sk | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je ešte vo funkcii? Súhlas so zverejnením mena a kontaktu |
| Miroslav Eperješi | Manažér FK; +421903903936 | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je ešte vo funkcii? Súhlas so zverejnením mena a kontaktu |
| Martin Horizral | člen výboru; — | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je ešte vo funkcii? Súhlas so zverejnením mena a kontaktu |
| Ing. Michal Krcho | člen výboru; — | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je ešte vo funkcii? Súhlas so zverejnením mena a kontaktu |

## Tréneri

**ZASTARANÉ/NEOVERENÉ.** Všetko je v stave Koncept. Zdroj má v zozname trénerov aj záznam „Muži a dorast U19“ bez mena (neprevzaté). Fotografie trénerov sa neberú.

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Gejza FARKAŠ | Dorast U17; +421911387337 | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je stále trénerom tohto družstva? Súhlas so zverejnením kontaktu (súkromné telefóny/e-maily) |
| Peter DZIAK | Žiaci U15; +421907209000, dziak@barcom.sk | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je stále trénerom tohto družstva? Súhlas so zverejnením kontaktu (súkromné telefóny/e-maily) |
| Vladimír URBAN | Žiaci U13; +421903603450, bonyka804@gmail.com | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je stále trénerom tohto družstva? Súhlas so zverejnením kontaktu (súkromné telefóny/e-maily) |
| Ing. Marián KÉDA | Prípravka U11 a U10; +421904535890 | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je stále trénerom tohto družstva? Súhlas so zverejnením kontaktu (súkromné telefóny/e-maily) |
| Stanislav LELLÁK | Prípravka U10 a U9; +421903635373 | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | Koncept | Je stále trénerom tohto družstva? Súhlas so zverejnením kontaktu (súkromné telefóny/e-maily) |
| (bez mena) | Muži a dorast U19 | https://www.fkkosickanovaves.sk/funkcionari-treneri.html | neprevzaté | Doplniť meno trénera |

## Kontakty

**ZASTARANÉ/NEOVERENÉ.** Stránka `kontakt` je v stave Koncept. Kontaktný formulár zo zdroja sa neberie.

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Adresa | FK Košická Nová Ves, Agátová č.1, 040 14 Košice | https://www.fkkosickanovaves.sk/kontakty.html | Koncept | Platnosť údaja; ktorý e-mail je správny |
| IČO | 31 942 059 | https://www.fkkosickanovaves.sk/kontakty.html | Koncept | Platnosť údaja; ktorý e-mail je správny |
| Banka / účet | VÚB, a.s., 62639-512 / 0200 | https://www.fkkosickanovaves.sk/kontakty.html | Koncept | Platnosť údaja; ktorý e-mail je správny |
| IBAN | SK 77 0200 0000 0000 6263 9512 | https://www.fkkosickanovaves.sk/kontakty.html | Koncept | Platnosť údaja; ktorý e-mail je správny |
| Telefón | Manažér klubu: 0903903936 | https://www.fkkosickanovaves.sk/kontakty.html | Koncept | Platnosť údaja; ktorý e-mail je správny |
| E-mail | fkknv1935@gmail.com (na titulke je odkaz tohto textu na mailto:mcknv@netkosice.sk – nezrovnalosť) | https://www.fkkosickanovaves.sk/kontakty.html | Koncept | Platnosť údaja; ktorý e-mail je správny |

## Dokumenty

Všetky dokumenty sú ClubDocument v stave **Archív**; dátum dokumentu zdroj neuvádza (v importe je prázdny). Súbory boli stiahnuté bez zmeny, SHA-256 je kontrola neporušenosti. Ak sa pri importe súbor nepodarí overiť, uloží sa iba odkaz.

| Dokument | Kategória | Pôvodný súbor | Dátum | SHA-256 | Prevzatý súbor | Čo má klub potvrdiť |
|---|---|---|---|---|---|---|
| Nadácia VSE | OTHER | Nadácia VSE.pdf (13359731 B) | — | `140bac6545cf76d67cf86c755a4558b80fa2b4c1ad33d27bc700198f63fa7abc` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Zmluva o poskytnutí dotácie z rozpočtu mesta Košice | SUBSIDY | Zmluvy_z2017002107w.pdf (4132696 B) | — | `acdf512252611bab9e6a317a70f3765e52bd82625a672c247c81cd7ebc5f785e` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Zmluva o poskytnutí dotácie z rozpočtu mesta Košice na základe Koncepcie rozvoja športu v meste Košice | SUBSIDY | Zmluvy_z2017001420w.pdf (6129241 B) | — | `5d1440821089380392ac0db6bbfefcc4c3e9621e33747374c47ec24a7290388b` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Výzva - Prestrešenie tenisových kurtov | CONTRACT | zsnh_vyzva.zip (1634887 B) | — | `a7834cad5a7cd9250be048e4c2d1331119534984b2a042c68ce36974153a0dfb` | áno (HTTP 200, application/zip) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Zmluva o dielo s Centaury Plus s.r.o. | CONTRACT | zmluvaodielo.pdf (5710311 B) | — | `e6cb211c7edc153bc18f2e5d2a4ed4e73cb61e1184576cb09b8e9342386c6690` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Výsledok zadávania zákazky | CONTRACT | vysledok_zadavania.pdf (341139 B) | — | `f6ba95767c80052e8f7b78c86bc3746428e26f82c8c221f2d9dc4a572ee5ce39` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Dodatok k zmluve o dielo | CONTRACT | dodatok_zz.pdf (945998 B) | — | `2aade8e094e5f48c73d3e296423cf930a66a9315fcb730f8a9136b3bc09919ec` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Poukázanie podielu zaplatenej dane (2021) | TAX_FORM | 2021_Vyhlásenie o poukázaní podielu zaplatenej dane z príjmov FO.pdf (335052 B) | — | `8bc40d90ddfb253716bacf73303cd841ed963e4437c3910d901d4f266471dcd8` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Poukázanie podielu zaplatenej dane (2022) | TAX_FORM | 2perc2022.pdf (335083 B) | — | `0fbcf938aea6496d988b352f195442d245301f2905c78375bcccc56681a79e7b` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Poukázanie podielu zaplatenej dane 2024 | TAX_FORM | Vyhlásenie o poukázaní podielu zaplatenej DzFO 2023.pdf (104885 B) | — | `b8c745e0f1b0d9105f17cca8a49dd6273a700316ba9ca222e7ba054ff0634d71` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Vyhlásenie za rok 2017 (tlačivo 2 % z daní) | TAX_FORM | Vyhlasenie za r 2017.pdf (123237 B) | — | `07450ce85193a2ad10ef564fd9b0056cba8109e61f900b4b5f2764632c06aea2` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Usmernenie hlavného hygienika SR – športoviská | ANNOUNCEMENT | Usmernenie_hlavneho_hygienika_SR_sportoviska.pdf (115813 B) | — | `b2908891f6d036c3e9eec19ecb251a1e3111eed1751938af8ce82762110e9b82` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Usmernenie SFZ 24042020 (final) | ANNOUNCEMENT | Usmernenie-SFZ-24042020_final.pdf (224194 B) | — | `dfc2641be7efabd2c97358e76d0fb02628179ffb9ee80a882966c49742c2e583` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Uznesenia SFZ k 1. fáze | ANNOUNCEMENT | UZNESENIA SFZ K 1. FÁZE.pdf (168584 B) | — | `66f2b03f05f540d2c837c8b487f0a182125f36d75ac15ced71661eac188ab74a` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |
| Usmernenie SFZ 25052020 | ANNOUNCEMENT | Usmernenie-SFZ-25052020.pdf (171747 B) | — | `11b03246cab66aa7bbfb6338d53de6609e3460114e928864d09804f1b6ef546a` | áno (HTTP 200, application/pdf) | Má sa dokument ďalej zverejňovať? Doplniť dátum a skontrolovať osobné údaje v dokumente |

Poznámky: tlačivá 2 % dane (2017, 2021, 2022, 2023/„2024“) sú historické, nie aktuálna kampaň. Zmluvy a podklady k prestrešeniu tenisových kurtov (Centaury Plus s.r.o., CASSOVIA SPORT s.r.o.) sú historický záznam. Usmernenia SFZ/ÚVZ z roku 2020 sú cudzie dokumenty (príloha starých oznamov). Obsah skenov PDF sa neprepisoval.

## Dotácie a podpora

**ZASTARANÉ/NEOVERENÉ** (text z roku 2024, termíny 2023/2024). Stránka `podpora` je v stave **Archív**.

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Dotácia mesta Košice 2017 – Fond mládežníckeho futbalu | 10.000,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2018 – Fond mládežníckeho futbalu | 9.375,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2019 – Fond mládežníckeho futbalu | 11.972,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2020 – Fond mládežníckeho futbalu | 12.538,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2021 – Fond mládežníckeho futbalu | 12.128,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2022 – Fond mládežníckeho futbalu | 15.765,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2023 – Fond mládežníckeho futbalu | 27.350,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Dotácia mesta Košice 2024 – Fond mládežníckeho futbalu | 12.231,00 € | https://www.fkkosickanovaves.sk/ (titulná strana) | Archív | Správnosť sumy; či uvádzať |
| Financovanie mládeže z nadácií | V roku 2019 získané „tisíce EUR“ (kosačka, vodozáchytné opatrenia na jar 2020) | https://www.fkkosickanovaves.sk/ | Archív | ZASTARANÉ – plán z roku 2019/2020 |
| 2 % / 3 % dane 2024 | Termíny: právnické osoby do 31.03.2024, fyzické osoby do 30.04.2024; potvrdenie od zamestnávateľa do 15.02.2024; v roku 2023 „niekoľko tisíc EUR“ (zateplenie tribúny a šatní); plán 2024 osvetlenie hlavnej hracej plochy | https://www.fkkosickanovaves.sk/ | Archív | ZASTARANÉ – termíny sú preč; plán osvetlenia overiť |
| Prestrešenie tenisových kurtov | Zákazka s nízkou hodnotou, Agátová ulica; zhotoviteľ podľa zdroja CASSOVIA SPORT s.r.o. (IČO 36 810 134); zmluva o dielo s CENTAURY PLUS s.r.o. | https://www.fkkosickanovaves.sk/ | Archív | Zdroj uvádza dva názvy zhotoviteľa – overiť |

## Staré oznamy (archív)

Prevzatých 60 oznamov ako archívne články (`isArchive`, dátum z pôvodného webu). Väčšina (TMC oznamy) nemá na zdroji text, preto telo je „Obsah oznamu je dostupný na pôvodnom webe.“ a zdrojový odkaz. Neprevzaté: oznamy „Dnes má narodeniny / meniny“ (osobné údaje) – 146 položiek z rokov 2021–2022. Odkazy na cudzie weby (SFZ, sportnet, VsFZ) sú len odkazy.

**Všetko ZASTARANÉ** (2017–2024). Klub má potvrdiť, či sa majú oznamy ponechať verejne.

| Dátum | Názov | Zdroj | Stav v importe | Telo |
|---|---|---|---|---|
| 27.10.2024 | TMC č.17, 44 týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c17-44-tyzden-2024.c502.html | Archív (článok) | odkaz na pôvodný web |
| 19.10.2024 | TMC č.16, 43. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c16-43-tyzden-2024.c501.html | Archív (článok) | odkaz na pôvodný web |
| 13.10.2024 | TMC č.15, 42. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c15-42-tyzden-2024.c500.html | Archív (článok) | odkaz na pôvodný web |
| 07.10.2024 | TMC č.14, 41. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c14-41-tyzden-2024.c499.html | Archív (článok) | odkaz na pôvodný web |
| 30.09.2024 | TMC č.13, 40. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c13-40-tyzden-2024.c498.html | Archív (článok) | odkaz na pôvodný web |
| 22.09.2024 | TMC č.12, 39. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c12-39-tyzden-2024.c497.html | Archív (článok) | odkaz na pôvodný web |
| 16.09.2024 | TMC č.11, 38. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c11-38-tyzden-2024.c496.html | Archív (článok) | odkaz na pôvodný web |
| 09.09.2024 | TMC č.10, 37. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c10-37-tyzden-2024.c495.html | Archív (článok) | odkaz na pôvodný web |
| 03.09.2024 | TMC č.9, 36. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c9-36-tyzden-2024.c494.html | Archív (článok) | odkaz na pôvodný web |
| 25.08.2024 | TMC č.8, 35. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c8-35-tyzden-2024.c493.html | Archív (článok) | odkaz na pôvodný web |
| 12.08.2024 | TMC č.6, 33 týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c6-33-tyzden-2024.c492.html | Archív (článok) | odkaz na pôvodný web |
| 05.08.2024 | TMC č.5, 32 týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c5-32-tyzden-2024.c491.html | Archív (článok) | odkaz na pôvodný web |
| 19.05.2024 | TMC 20. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-20-tyzden-2024.c490.html | Archív (článok) | odkaz na pôvodný web |
| 06.05.2024 | TMC 18. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-18-tyzden-2024.c489.html | Archív (článok) | odkaz na pôvodný web |
| 29.04.2024 | TMC č.17. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c17-tyzden-2024.c488.html | Archív (článok) | odkaz na pôvodný web |
| 21.04.2024 | TMC č.16. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c16-tyzden-2024.c487.html | Archív (článok) | odkaz na pôvodný web |
| 14.04.2024 | TMC č.15. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c15-tyzden-2024.c485.html | Archív (článok) | odkaz na pôvodný web |
| 07.04.2024 | TMC č.14. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c14-tyzden-2024.c486.html | Archív (článok) | odkaz na pôvodný web |
| 01.04.2024 | TMC č.13. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c13-tyzden-2024.c484.html | Archív (článok) | odkaz na pôvodný web |
| 24.03.2024 | TMC č.12. týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c12-tyzden-2024.c483.html | Archív (článok) | odkaz na pôvodný web |
| 17.03.2024 | TMC č.11, týždeň 2024 | https://www.fkkosickanovaves.sk/tmc-c11-tyzden-2024.c482.html | Archív (článok) | odkaz na pôvodný web |
| 10.03.2024 | TMC č.10 - 2024 | https://www.fkkosickanovaves.sk/tmc-c10---2024.c480.html | Archív (článok) | odkaz na pôvodný web |
| 20.11.2022 | TMC 47. týždeň | https://www.fkkosickanovaves.sk/tmc-47-tyzden.c475.html | Archív (článok) | odkaz na pôvodný web |
| 14.11.2022 | TMC: 46. týždeň | https://www.fkkosickanovaves.sk/tmc-46-tyzden.c474.html | Archív (článok) | odkaz na pôvodný web |
| 30.10.2022 | TMC 44. týždeň 2022 | https://www.fkkosickanovaves.sk/tmc-44-tyzden-2022.c456.html | Archív (článok) | odkaz na pôvodný web |
| 24.10.2022 | TMC: 43.týždeň | https://www.fkkosickanovaves.sk/tmc-43tyzden.c452.html | Archív (článok) | odkaz na pôvodný web |
| 16.10.2022 | TMC 42. TÝŽDEŇ | https://www.fkkosickanovaves.sk/tmc-42-tyzden-.c451.html | Archív (článok) | odkaz na pôvodný web |
| 09.10.2022 | TMC 41. TÝŽDEŇ | https://www.fkkosickanovaves.sk/tmc-41-tyzden-.c440.html | Archív (článok) | odkaz na pôvodný web |
| 03.10.2022 | TMC 40. týždeň | https://www.fkkosickanovaves.sk/tmc-40-tyzden.c423.html | Archív (článok) | odkaz na pôvodný web |
| 25.09.2022 | TMC 39, týždeň 2022 | https://www.fkkosickanovaves.sk/tmc-39-tyzden-2022.c418.html | Archív (článok) | odkaz na pôvodný web |
| 18.09.2022 | TMC 38. týždeň 2022 | https://www.fkkosickanovaves.sk/tmc-38-tyzden-2022.c414.html | Archív (článok) | odkaz na pôvodný web |
| 20.02.2022 | TMC 2021/22: 8. týždeň | https://www.fkkosickanovaves.sk/tmc-202122-8-tyzden.c410.html | Archív (článok) | odkaz na pôvodný web |
| 13.02.2022 | TMC 2021/22: 7. týždeň | https://www.fkkosickanovaves.sk/tmc-202122-7-tyzden.c409.html | Archív (článok) | odkaz na pôvodný web |
| 07.02.2022 | FK KNV TMC 2022: 6.týždeň | https://www.fkkosickanovaves.sk/fk-knv-tmc-2022-6tyzden.c408.html | Archív (článok) | odkaz na pôvodný web |
| 25.10.2021 | TMC 43 . týždeň 2021/22 | https://www.fkkosickanovaves.sk/tmc-43--tyzden-202122.c375.html | Archív (článok) | odkaz na pôvodný web |
| 18.10.2021 | TMC: 42.týždeň | https://www.fkkosickanovaves.sk/tmc-42tyzden.c373.html | Archív (článok) | odkaz na pôvodný web |
| 04.10.2021 | TMC 40. týždeň 2021/22 | https://www.fkkosickanovaves.sk/tmc-40-tyzden-202122.c368.html | Archív (článok) | odkaz na pôvodný web |
| 26.09.2021 | TMC 39. týždeň - sezóna 2021/22 | https://www.fkkosickanovaves.sk/tmc-39-tyzden---sezona-202122.c361.html | Archív (článok) | odkaz na pôvodný web |
| 19.09.2021 | TMC 38. TÝŽDEŇ - SEZÓNA 2021/22 | https://www.fkkosickanovaves.sk/tmc-38-tyzden---sezona-202122.c352.html | Archív (článok) | odkaz na pôvodný web |
| 12.09.2021 | TMC 37. TÝŽDEŇ | https://www.fkkosickanovaves.sk/tmc-37-tyzden-.c347.html | Archív (článok) | odkaz na pôvodný web |
| 08.09.2021 | TMC 36 . TÝŽDEŇ | https://www.fkkosickanovaves.sk/tmc-36--tyzden.c345.html | Archív (článok) | odkaz na pôvodný web |
| 25.07.2021 | TMC 30. týždeň | https://www.fkkosickanovaves.sk/tmc-30-tyzden.c330.html | Archív (článok) | odkaz na pôvodný web |
| 23.07.2021 | SFZ – Reakcia na vydanie novej vyhlášky Úradu verejného zdravotníctva SR o organizácii hromadných podujatí | https://mediamanager.sportnet.online/media/pages/f/futbalsfz.sk/2021/07/usmernenie-k-spusteniu-sutazi.pdf | Archív (článok) | odkaz na pôvodný web |
| 19.07.2021 | Očkovanie alebo negatívny test. SFZ usmerňuje kluby pred štartom nového ročníka | https://sportnet.sme.sk/spravy/sfz-start-noveho-rocnika-2021-2022-opatrenia-koronavirus/ | Archív (článok) | odkaz na pôvodný web |
| 19.07.2021 | TMC 29. týždeň | https://www.fkkosickanovaves.sk/tmc-29-tyzden.c326.html | Archív (článok) | odkaz na pôvodný web |
| 17.05.2021 | Reštart súťaží na východe už od nedele 23. mája | https://sportnet.sme.sk/futbalnet/z/vsfz/spravy/restart-sutazi-na-vychode-uz-od-soboty-22-maja/ | Archív (článok) | odkaz na pôvodný web |
| 13.04.2021 | Uvoľnenia sa dotknú aj športu. Amatéri budú môcť trénovať spoločne | https://sportnet.sme.sk/spravy/koronavirus-na-slovensku-covid-automat-sport-uvolnenie-19-april-2021/ | Archív (článok) | odkaz na pôvodný web |
| 30.03.2021 | Blíži sa reštart amatérskeho futbalu? Nehrá sa už takmer pol roka. | https://sportnet.sme.sk/spravy/amatersky-futbal-covid-19-velka-noc-2021/ | Archív (článok) | odkaz na pôvodný web |
| 05.11.2020 | USMERNENIE SFZ K VYHLÁŠKE ÚRADU VEREJNÉHO ZDRAVOTNÍCTVA SR | https://www.futbalsfz.sk/usmernenie-sfz-k-opatreniu-uradu-verejneho-zdravotnictva-sr | Archív (článok) | odkaz na pôvodný web |
| 20.05.2020 | Usmernenie-SFZ-25052020 | https://www.fkkosickanovaves.sk/usmernenie-sfz-25052020.c97.html | Archív (článok) | odkaz na pôvodný web |
| 26.04.2020 | USMERNENIE SFZ k opatreniu Úradu verejného zdravotníctva SR č. OLP/3461/2020 zo dňa 21.04.2020 vo veci prevádzky vonkajších športovísk pre bezkontaktný šport… | https://www.fkkosickanovaves.sk/usmernenie-sfz-k-opatreniu-uradu-verejneho-zdravotnictva-sr-c-olp34612020-zo-dna-21042020-vo-veci-prevadzky-vonkajsich-sportovisk-pre-bezkontaktny-sport-vydane-dna-24042020.c85.html | Archív (článok) | odkaz na pôvodný web |
| 25.04.2020 | Usmernenie k opatreniu Úradu verejného zdravotníctva SR č. OLP/3461/2020 zo dňa 21.04.2020 vo veci prevádzky vonkajších športovísk pre bezkontaktný šport | https://www.fkkosickanovaves.sk/usmernenie-k-opatreniu-uradu-verejneho-zdravotnictva-sr-c-olp34612020-zo-dna-21042020-vo-veci-prevadzky-vonkajsich-sportovisk-pre-bezkontaktny-sport.c84.html | Archív (článok) | doslovný text |
| 16.01.2020 | Príspevok na športovú činnosť dieťaťa | https://pravneprerodica.sk/prispevok-sportova-cinnost/ | Archív (článok) | odkaz na pôvodný web |
| 16.01.2020 | Košická futbalová liga 2020 | https://vsfz.futbalnet.sk/spravy/kosicka-futbalova-ligy-2020 | Archív (článok) | odkaz na pôvodný web |
| 08.07.2019 | FK Košická Nová Ves, hľadá mladých futbalistov, futbalistky | https://www.fkkosickanovaves.sk/fk-kosicka-nova-ves-hlada-mladych-futbalistov-futbalistky.c18.html | Archív (článok) | doslovný text |
| 04.07.2019 | Vyžrebovanie súťaží VsFZ - sezóna 2019/20 dospelí | https://vsfz.futbalnet.sk/spravy/vyzrebovanie-sutazi-vsfz | Archív (článok) | odkaz na pôvodný web |
| 04.07.2019 | Pozor zmena rozlosovania 1. kola SC | https://www.fkkosickanovaves.sk/pozor-zmena-rozlosovania-1-kola-sc.c73.html | Archív (článok) | doslovný text |
| 30.06.2019 | FK Košická Nová Ves ukončila spoluprácu s FK Junior Košice ku dňu 30.06.2019 | https://www.fkkosickanovaves.sk/fk-kosicka-nova-ves-ukoncila-spolupracu-s--fk-junior-kosice-ku-dnu-30062019.c74.html | Archív (článok) | odkaz na pôvodný web |
| 01.02.2018 | "Vyhlásenie za rok 2017" o 2% z daní pre OZ FK Košická Nová Ves, tlačivo v prílohe. | https://www.fkkosickanovaves.sk/vyhlasenie-za-rok-2017-o-2-z-dani-pre-oz-fk-kosicka-nova-ves-tlacivo-v-prilohe.c19.html | Archív (článok) | doslovný text |
| 31.07.2017 | FK Košická Nová Ves a FK Junior Košice sa dohodli na spolupráci. | https://www.fkkosickanovaves.sk/fk-kosicka-nova-ves-a-fk-junior-kosice-sa-dohodli-na-spolupraci-.c26.html | Archív (článok) | odkaz na pôvodný web |

## Galéria

Fotografie sa nekopírujú, do manifestu sa nezapisujú. Zdroj obsahuje len odkazy na galérie (veľa fotiek mládeže 2013–2017).

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Galéria Klub | názov galérie „Klub“ | https://www.fkkosickanovaves.sk/galeria-klub.html | neprevzaté | Súhlasy rodičov/hráčov s fotografiami (najmä mládež), či galériu zachovať; prípadne nahrať vlastné fotky |
| Galéria História | názov galérie „História“ | https://www.fkkosickanovaves.sk/galeria-historia.html | neprevzaté | Súhlasy rodičov/hráčov s fotografiami (najmä mládež), či galériu zachovať; prípadne nahrať vlastné fotky |
| Galéria Hráči | Dorast U17/U19 2013/14, 2014/15, 2016/17; Muži 2013/14, 2016/17; spoločná fotka mládeže 2016/17 | https://www.fkkosickanovaves.sk/galeria-hraci.html | neprevzaté | Súhlasy rodičov/hráčov s fotografiami (najmä mládež), či galériu zachovať; prípadne nahrať vlastné fotky |
| Galéria Zápasy | zápasy mužov a dorastu 2014–2018 | https://www.fkkosickanovaves.sk/galeria-zapasy.html | neprevzaté | Súhlasy rodičov/hráčov s fotografiami (najmä mládež), či galériu zachovať; prípadne nahrať vlastné fotky |

## Tréningové časy a rozpis (nepreberané)

Aktuálne tvrdenia, preto sa **nepreberajú** do importu. Stránka „Rozpis tréningov“ (rozpis-treningov.c178.html) nemá na zdroji žiadny text. Na titulke boli uvedené (ZASTARANÉ/NEOVERENÉ, posledné uvedené zápasy 2023, A-mužstvo a U19 do marca 2025):

| Družstvo | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| U15 | Ut 19.00 Multi. hala CTA; Pi 18.30 Multi. hala CTA | https://www.fkkosickanovaves.sk/ | neprevzaté | Doplniť aktuálny rozpis vo vlastnom portáli |
| U13 | Po a St 16.00 TCÚŠ Poľná 2; Pi 17.00 hala CTA Agátová | https://www.fkkosickanovaves.sk/ | neprevzaté | Doplniť aktuálny rozpis vo vlastnom portáli |
| U11 | Ut 16.00 CTÚŠ Poľná; St 16.00 CVČ Charkovská; Št 10.00 CTÚŠ Poľná | https://www.fkkosickanovaves.sk/ | neprevzaté | Doplniť aktuálny rozpis vo vlastnom portáli |
| U10 | Ut 16.00 CTÚŠ Poľná; St 16.00 CVČ Charkovská; Št 16.00 CTÚŠ Poľná | https://www.fkkosickanovaves.sk/ | neprevzaté | Doplniť aktuálny rozpis vo vlastnom portáli |
| U9 | Ut a Št 16:00 CTÚČ Poľná | https://www.fkkosickanovaves.sk/ | neprevzaté | Doplniť aktuálny rozpis vo vlastnom portáli |
| A, U19, U17 | bez uvedených časov | https://www.fkkosickanovaves.sk/ | neprevzaté | Doplniť aktuálny rozpis vo vlastnom portáli |

## Štatút mládeže

| Položka | Hodnota zo zdroja | Zdroj | Stav v importe | Čo má klub potvrdiť |
|---|---|---|---|---|
| Mládež – Štatút | Stránka nemá žiadny text ani prílohu | https://www.fkkosickanovaves.sk/statut.c189.html | neprevzaté | Dodať aktuálny štatút mládeže |
