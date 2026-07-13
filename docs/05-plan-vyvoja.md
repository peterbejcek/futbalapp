# 05 — Plán vývoja

Postup je rozdelený do fáz tak, aby klub dostal použiteľný systém čo najskôr (MVP pred štartom sezóny 07/2026 → reálne pred jesennou časťou) a ďalšie funkcie pribúdali priebežne. Odhady sú pre 1 – 2 vývojárov.

## Fáza 0 — Príprava (1 – 2 týždne)

- [ ] Potvrdenie zadania s klubom: kategórie, výšky poplatkov, banka klubu, zoznam trénerov
- [ ] Zber podkladov: logo, farby, fotky; export hráčov (futbalnet / excel od vedúcich)
- [ ] Registrácia domény **fkknv.sk**, zriadenie e-mailu, Google Play + Apple Developer účtov (schvaľovanie Apple účtu trvá — začať hneď)
- [ ] Založenie monorepa, CI, dev prostredia, VPS
- **Výstup:** bežiaci skeleton (prázdne API + web + mobil, CI zelené)

## Fáza 1 — Základ: členovia, kategórie, autentifikácia (3 – 4 týždne)

- [ ] Dátová schéma (Prisma) + migrácie + seed kategórií a sezóny 2026/2027
- [ ] Auth (e-mail/heslo, magic link), roly a oprávnenia (RBAC + scope na kategórie)
- [ ] Správa členov: adresár, profil, väzba rodič–dieťa
- [ ] Sezónna logika: CategoryRule, automatické zaradenie podľa dátumu narodenia, výnimky
- [ ] **Import hráčov** (CSV šablóna + pokus o import z futbalnetu) — naplnenie databázy podľa skupín
- [ ] Online registračný formulár + schvaľovací workflow
- **Výstup:** klub má v systéme všetkých členov v správnych kategóriách, funguje registrácia

## Fáza 2 — Kalendár, dochádzka, základ mobilnej appky (3 – 4 týždne)

- [ ] Udalosti: tréningy (aj opakované), zápasy, turnaje, klubové akcie; kalendár per kategória
- [ ] Dochádzka: odklikanie trénerom, RSVP rodičom, štatistiky dochádzky
- [ ] Mobilná appka v1: login, dashboard, kalendár, dochádzka (s offline zápisom)
- [ ] Push notifikácie (zmena tréningu, nová udalosť)
- [ ] Interné testovanie: TestFlight + Play internal track s trénermi
- **Výstup:** tréneri evidujú dochádzku z mobilu pri ihrisku, rodičia vidia účasť detí

## Fáza 3 — Financie (4 – 5 týždňov)

- [ ] Poplatky: FeePlan per kategória, individuálne výnimky/zľavy, generovanie mesačných predpisov s VS a QR (PAY by square)
- [ ] Import bankových výpisov (CAMT/CSV) + automatické párovanie, manuálna fronta nespárovaných
- [ ] Prehľad platieb: rodič (svoje deti), tréner/vedenie (kategória/klub), dlžníci
- [ ] **Automatické upomienky** pri nezaplatení (push + e-mail, eskalácia)
- [ ] Podklady pre **športový príspevok** (PDF na stiahnutie rodičom)
- **Výstup:** členské beží cez systém, párovanie automatické, klub vidí dlžníkov — jadro hodnoty paysy.sk

## Fáza 4 — Zápasy: nominácie a živý zápis (3 – 4 týždne)

- [ ] Vytvorenie zápasu/turnaja: deň, hodina, miesto, súper; nominácia hráčov (pridávanie/odoberanie kedykoľvek)
- [ ] Notifikácia nominovaným + potvrdenie účasti rodičom/hráčom
- [ ] **Živý zápis v mobile:** góly (strelec + minúta), asistencie, striedania, karty, poznámky; offline tolerantné
- [ ] Sync plánu zápasov z **futbalnet.sk** (naplánovaný job + manuálna korekcia)
- [ ] Štatistiky hráčov zo zápasov (góly, účasť, minutáž)
- **Výstup:** tréner odohrá celý zápasový deň v appke — od nominácie po zápis gólov

## Fáza 5 — Komunikácia (2 – 3 týždne)

- [ ] Kanály per kategória (rodičia/hráči + tréneri), kanály vedenia, celoklubové oznamy
- [ ] Chat (WebSocket) na webe aj mobile, push pri nových správach
- [ ] Hromadné správy s filtrami (kategória, rola, stav platieb), potvrdenie prečítania oznamov
- **Výstup:** komunikácia klubu sa presúva z WhatsApp/Messenger skupín do portálu

## Fáza 6 — Reporty, štatistiky, dolaďovanie (2 – 3 týždne)

- [ ] Dashboard podľa rolí (stav platieb, členovia, najbližšie udalosti, grafy)
- [ ] Exporty XLSX/PDF: členovia, platby, dochádzka, zápasové štatistiky; plánované reporty e-mailom
- [ ] Audit log, výkonnostné a bezpečnostné dolaďovanie, GDPR checklist (doc 06)
- [ ] Publikácia do App Store a Google Play (review proces ~1 – 2 týždne rezerva)
- **Výstup:** ostrá prevádzka v plnom rozsahu

## Harmonogram (orientačne)

```
Fáza 0  ██                                     ~2 týž.
Fáza 1    ████                                 ~4 týž.   ← členovia v systéme
Fáza 2        ████                             ~4 týž.   ← dochádzka + mobil v1
Fáza 3            █████                        ~5 týž.   ← financie (MVP hotové)
Fáza 4                 ████                    ~4 týž.   ← zápasy + živý zápis
Fáza 5                     ███                 ~3 týž.   ← komunikácia
Fáza 6                        ███              ~3 týž.   ← reporty + store release
────────────────────────────────────────────
Spolu ~ 5 – 6 mesiacov (1 – 2 vývojári)
```

MVP pre klub = koniec Fázy 3 (~3 mesiace): členovia, kategórie, dochádzka, kalendár, platby s párovaním a upomienkami.

## Priebežné praktiky

- **Testovanie:** unit testy doménovej logiky (zaradenie do kategórií, párovanie platieb, generovanie VS), integračné testy API, Playwright e2e pre kritické toky (registrácia, platba), Maestro/Detox smoke testy mobilu.
- **Nasadzovanie:** trunk-based, každý merge do `main` → staging; produkčný deploy tagom. Mobil: EAS Update pre JS zmeny, store release pre natívne zmeny.
- **Pilot:** každú fázu testuje jedna „pilotná" kategória (napr. U11 — tréner + pár rodičov) pred zapnutím pre celý klub.
- **Dokumentácia pre klub:** krátke návody (PDF/video) pre trénerov a rodičov pri spustení každej fázy.

## Prevádzkové náklady (odhad)

| Položka | Ročne |
|---|---|
| Doména fkknv.sk | ~15 € |
| VPS (Hetzner CX22) + zálohy | ~80 – 120 € |
| Apple Developer | 99 USD |
| Google Play | 25 USD (jednorazovo) |
| E-maily (Resend free tier / SMTP) | 0 – 20 € |
| Sentry, Expo EAS (free tiery) | 0 € |
| **Spolu** | **~200 – 250 € ročne** |
