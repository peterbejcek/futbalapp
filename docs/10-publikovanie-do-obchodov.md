# 10 — Publikovanie mobilnej aplikácie (Google Play + App Store)

Návod na prvé vydanie aplikácie **FK KNV** do obchodov. Kód je hotový; ide o
zriadenie účtov, vyplnenie listingu (popisy, screenshoty), nahratie buildu a
prejdenie review. Buildy sa robia cez EAS z `apps/mobile` (viď `07-deployment.md`).

Identifikátory aplikácie (už nastavené v `app.json` / `eas.json`):
- Názov: **FK KNV**  ·  slug `fkknv`  ·  EAS owner `petobejos-team`
- Android package / iOS bundle ID: **`sk.fkknv.app`**
- Privacy policy URL: **https://fkknv.sk/dokumenty/ochrana-osobnych-udajov**

---

## 0. Prerekvizity (účty a náklady)

| Položka | Kde | Cena |
|---|---|---|
| Google Play Developer účet | play.google.com/console | jednorazovo **25 $** |
| Apple Developer Program | developer.apple.com | **99 $/rok** |
| Expo/EAS účet klubu | expo.dev | zdarma (už máš — `petobejos-team`) |

⚠️ **Apple:** schválenie vývojárskeho účtu (najmä ako organizácia, cez D-U-N-S číslo)
môže trvať aj niekoľko dní až týždňov — založ ho čo najskôr. Ako jednotlivec je to
rýchlejšie. Review appky potom trvá typicky 1–3 dni.

---

## 1. Spoločná príprava (obe platformy)

- [ ] **Ikona 1024×1024** bez priehľadnosti (`assets/icon.png`) — už je, over kvalitu.
- [ ] **Screenshoty** z reálnej appky (fyzický telefón alebo emulátor):
  - Android: min. 2 (telefón), odporúčane 4–8. Pomer 16:9 alebo 9:16.
  - iOS: sada pre 6,7" (iPhone 15 Pro Max) a 5,5"; App Store Connect ich vyžaduje.
  - Vhodné obrazovky: Prehľad/kalendár, Detail zápasu + nominácia, Komunikácia, Dochádzka.
- [ ] **Krátky popis** (Google, max 80 znakov):
  > Klubový portál FK Košická Nová Ves — kalendár, dochádzka, komunikácia.
- [ ] **Dlhý popis** (SK):
  > Oficiálna aplikácia mládežníckeho futbalového klubu FK Košická Nová Ves.
  > Rodičom, hráčom a trénerom prináša na jedno miesto:
  > • kalendár tréningov, zápasov a podujatí,
  > • nominácie na zápas s potvrdením účasti,
  > • dochádzku na tréningy,
  > • klubovú komunikáciu v kanáloch družstiev,
  > • úlohy a oznamy,
  > • prehľad členských príspevkov a platieb,
  > • push upozornenia na novinky.
  > Aplikácia je určená členom klubu; prístup je po prihlásení.
- [ ] **Kategória:** Šport.
- [ ] **Kontaktný e-mail podpory:** `<doplň klubový e-mail>`.
- [ ] **Privacy policy URL:** https://fkknv.sk/dokumenty/ochrana-osobnych-udajov
- [ ] **Demo účet pre review** (appka je za loginom!): priprav testovacie konto s
      ukážkovými dátami (napr. rodič `review@fkknv.sk`) a uveď ho do poznámok pre
      recenzenta v oboch obchodoch. Bez neho appku zamietnu.

### ⚠️ Citlivé údaje a deti — dôležité pre schválenie
Appka spracúva **osobné a citlivé údaje** (mená a rodné čísla hráčov, e-maily,
telefóny, fotky, zdravotné poznámky) vrátane **údajov maloletých**. Preto:
- V **cieľovom publiku** nastav **dospelých** (rodičia/tréneri/vedenie spravujú dáta).
  Nedeklaruj appku ako určenú pre deti — vyhneš sa prísnym pravidlám Google Play
  *Families* / Apple *Kids Category*.
- V dotazníku **Data safety / App Privacy** priznaj zber: meno, e-mail, telefón,
  fotky, „zdravotné údaje" (health), identifikátory. Uveď účel: *App functionality*
  (chod klubu), **nezdieľané s tretími stranami na reklamu**. Prenos k spracovateľom:
  Resend (e-mail), Expo (push) — ako spracovatelia, nie na reklamu.
- Over, že Privacy policy stránka toto pokrýva (spracovanie údajov maloletých,
  právny základ, kontakt, práva dotknutých osôb).

---

## 2. Google Play

1. **Play Console → Create app**: názov „FK Košická Nová Ves", jazyk slovenčina,
   typ *App*, zadarmo.
2. **App content** (ľavé menu) — vyplniť postupne:
   - Privacy policy (URL vyššie),
   - Data safety (podľa sekcie o citlivých údajoch),
   - Ads: **žiadne reklamy**,
   - Target audience & content: **dospelí (18+)**,
   - Content rating dotazník → vygeneruje sa rating,
   - Government apps / news: nie.
3. **Store listing:** krátky + dlhý popis, ikona, feature graphic (1024×500),
   screenshoty.
4. **Build:** produkčný **AAB** cez EAS:
   ```bash
   cd apps/mobile
   eas build --platform android --profile production
   ```
5. **Nahratie:** najprv do **Internal testing** (pridaj testerov — trénerov),
   po otestovaní posuň do **Production**.
   - Automatizovane: `eas submit --platform android --profile production`
     (vyžiada / použije Google Play service-account kľúč — vytvor ho v Play Console
     → Setup → API access, JSON **necommitovať**).
   - Alebo ručne: stiahni AAB z EAS a nahraj v Play Console.

---

## 3. App Store (iOS)

1. **App Store Connect → My Apps → +**: nová appka, bundle ID **`sk.fkknv.app`**
   (musí sa zhodovať s `app.json`), jazyk slovenčina, SKU napr. `fkknv-app`.
2. **App Privacy:** vyplň zber údajov (rovnako ako Data safety vyššie).
3. **App Information / Pricing:** kategória Šport, zdarma, privacy policy URL.
4. **Screenshoty** pre požadované veľkosti + popis + kľúčové slová.
5. **Build + submit:**
   ```bash
   cd apps/mobile
   eas build --platform ios --profile production   # certifikáty vybaví EAS sprievodca
   eas submit --platform ios --profile production  # nahrá do App Store Connect / TestFlight
   ```
6. **TestFlight:** interní testeri → po otestovaní **Submit for Review**.
   V *App Review Information* uveď **demo účet** (login je povinný) a poznámku, že
   ide o internú klubovú appku pre členov.

---

## 4. Aktualizácie po vydaní

- **JS zmeny** (bez natívnych závislostí): `eas update --branch production` —
  doručí sa okamžite, bez review.
- **Natívne zmeny** (nová knižnica, zmena `app.json` plugin/permissions, zmena
  ikony): nový `eas build` + `eas submit` + review.
- Verziu (`version` v `app.json`) zvyšuj pri každom store vydaní; `versionCode`
  (Android) / `buildNumber` (iOS) rieši `autoIncrement` v `eas.json`.

---

## 5. Checklist pred prvým odoslaním

- [ ] Ikona a splash finálne, appka sa spúšťa a login funguje na fyzickom zariadení.
- [ ] Push notifikácie doručené (Android: FCM V1 kľúč nahratý — viď `07-deployment.md`).
- [ ] Privacy policy stránka je online a pokrýva spracovanie údajov maloletých.
- [ ] Data safety / App Privacy dotazníky vyplnené pravdivo.
- [ ] Demo účet pre recenzenta pripravený a uvedený v poznámkach.
- [ ] Screenshoty pre obe platformy.
- [ ] Internal testing / TestFlight prešlo bez pádov.
