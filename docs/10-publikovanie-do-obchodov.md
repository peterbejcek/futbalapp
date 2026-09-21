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

👉 Ak má byť vydavateľom **MS ART Design s.r.o.**, ale appku chceš v obchodoch čo
najskôr, čítaj **sekciu 6** — dá sa vydať pod súkromným účtom a firemný subjekt
doplniť dodatočne (Apple konverziou účtu, Google prenosom appky).

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

---

## 6. Vydavateľ: súkromná osoba teraz, MS ART Design s.r.o. potom

Cieľ: **appka v obchodoch čo najskôr**, vydavateľ (názov pod menom appky)
nakoniec **MS ART Design s.r.o.** Oboje sa dá — netreba čakať na firemný účet.

### 6.1 Apple — odporúčaná cesta: vydaj teraz, účet potom *prekonvertuj*

Aktuálny stav: platené členstvo ako **jednotlivec**, testovacia verzia už beží
v App Store Connect.

1. **Vydaj appku pod súkromným účtom.** Review typicky 1–3 dni. Appka pôjde von
   s vydavateľom „Peter Bejček“.
2. **Paralelne vyrieš D-U-N-S číslo pre MS ART Design s.r.o.**
   Najprv over, či firma už jedno má (D&B ich prideľuje aj bez žiadosti) —
   Apple má na to bezplatný nástroj: <https://developer.apple.com/enroll/duns-lookup/>.
   Ak existuje, nečakáš ani deň; ak nie, vyžiadanie je zdarma a trvá rádovo
   dni až 30 dní.
3. **Požiadaj Apple o zmenu typu subjektu** (Individual → Organization):
   Apple Developer → *Contact us* → **Membership and Account → Program Enrollment**.
   V žiadosti uveď: názov firmy vrátane „s.r.o.“, D-U-N-S číslo, právnu adresu,
   telefón a menu konateľa. Apple do ~2 týždňov zavolá na uvedené číslo kvôli
   verifikácii a potom dožiada doklady.

**Prečo konverzia a nie prenos appky:** účet zostáva ten istý — rovnaké
**Team ID**, rovnaké certifikáty a APNs kľúč, rovnaké TestFlight, žiadny druhý
poplatok 99 $. Mení sa len typ a názov subjektu, ktorý sa prepíše aj pod appkou
v App Store. Nulový technický dopad na už nainštalované appky.

### 6.2 Apple — záložná cesta: App Transfer

Ak by Apple konverziu nepovolil, funguje **prenos appky** do nového firemného
účtu (nové členstvo 99 $/rok pre s.r.o.) — appka si ponechá bundle ID
`sk.fkknv.app`, hodnotenia, recenzie aj inštalačnú bázu a používatelia dostávajú
updaty ďalej.

Podmienky prenosu (splníme ich práve tým, že najprv vydáme):
- appka **musí mať aspoň jednu verziu vydanú v App Store** (TestFlight nestačí);
- nesmie byť v stave *Waiting for Review / In Review / Pending Developer Release*
  a pod.; prenos teda rob medzi vydaniami;
- obidva účty musia mať odklikané aktuálne zmluvy.

Čo si pri tejto ceste treba odpracovať:
- **TestFlight sa musí pred prenosom vypnúť** (zmažú sa buildy aj testeri) —
  po prenose testerov pozvi nanovo;
- **nové APNs kľúče** pod novým teamom → `eas credentials` (staré platia do
  expirácie, ale nové buildy potrebujú nový kľúč);
- **zmena Team ID mení keychain access group** → appka používa `expo-secure-store`
  na uloženie prihlásenia, takže po prvom builde pod novým účtom sa
  **používatelia raz odhlásia**. Naplánuj oznam v klubovej komunikácii;
- v `eas.json` / EAS credentials prepíš `appleTeamId` a App Store Connect API kľúč.

### 6.3 Google Play — tu je reálne úzke hrdlo

Play Console **nekonvertuje** typ účtu. Zásadné je, ktorý typ účtu zakladáme:

| | Osobný účet | Firemný účet (s.r.o.) |
|---|---|---|
| D-U-N-S | netreba | **povinné** |
| Closed testing pred produkciou | **12 testerov × 14 dní v kuse** + žiadosť o production access (review ≤ 7 dní) | **neplatí** — ide sa priamo do produkcie |
| Reálny čas do vydania | ~3 týždne | pár dní po overení účtu (ak je D-U-N-S) |
| Cena | 25 $ jednorazovo | 25 $ jednorazovo |

Požiadavku na closed testing Google definuje výslovne len na *personal developer
accounts created after November 13, 2023* — firemný účet do toho rozsahu nepadá.
Firemný účet má namiesto toho vlastnú bránu: povinné D-U-N-S číslo a overenie
identity, pri ktorom Google páruje názov firmy, adresu a telefón s D&B záznamom.

**Rozhodovacie pravidlo — všetko závisí od D-U-N-S:**

- **D-U-N-S už existuje (alebo príde do ~týždňa)** → zakladaj **len firemný účet**.
  Je to rýchlejšie aj čistejšie: bez osobného účtu, bez prenosu appky, bez
  duplicitných 25 $, a vydavateľom je hneď MS ART Design s.r.o.
- **D-U-N-S neexistuje a D&B sa vlečie** (až 30 dní) → až vtedy sa vyplatí hedge
  nižšie, aby 14-dňový odpočet bežal počas čakania.

⚠️ Ak D&B záznam existuje, ale má **neaktuálne údaje** (adresa, názov, telefón),
oprav ho *pred* založením účtu — nesúlad údajov je najčastejší dôvod, prečo
verifikácia firemného účtu spadne. Ten istý záznam použije aj Apple pri konverzii.

⚠️ Typ Play účtu sa **nedá zmeniť** a D-U-N-S sa nedá prepísať na existujúcom
payments profile. Vydanie z osobného účtu teda znamená, že cesta k s.r.o. už
vedie len cez prenos appky. (Apple je opačný prípad — tam konverzia existuje,
preto vydanie pod súkromným Apple účtom nič nekazí.)

Hedge, ak D-U-N-S nie je po ruke: **rozbeh obe cesty naraz** (25 $ navyše je
zanedbateľné oproti týždňom):

1. **Dnes** založ osobný účet, nahraj produkčný AAB do **Closed testing** a pozvi
   **12+ testerov** (tréneri, vedenie, rodičia — klub ich má dosť). Tým sa hneď
   rozbehne 14-dňový odpočet. Testeri musia pozvánku *prijať a appku nainštalovať*
   pod pozvaným Google kontom, inak sa nepočítajú.
2. **Paralelne** s D-U-N-S číslom založ firemný účet pre MS ART Design s.r.o.
   Ak je overený skôr, publikuj priamo z neho a osobný účet zahoď.
3. Ak vyhrá osobný účet, publikuj z neho a appku neskôr **prenes** do firemného
   (Play Console → *Transfer app*; treba transaction ID z platby 25 $ cieľového
   účtu, Google to spracuje typicky do 2 pracovných dní). Prenášajú sa
   používatelia, štatistiky, hodnotenia, recenzie aj podpisový kľúč
   (Play App Signing).
   Po prenose treba ručne prenastaviť prístupy k prepojeným službám
   (Firebase/FCM, Analytics) a znovu vytvoriť testovacie skupiny.
   `google-services.json` sa nemení — Firebase projekt na Play účte nezávisí,
   takže push notifikácie idú ďalej.

### 6.4 EU DSA — „trader status“ (dôležité pre súkromný účet)

Pri distribúcii v EU treba v App Store Connect aj v Play Console deklarovať
*trader status*. Kto je **trader**, má na stránke appky **verejne zobrazenú
adresu, telefón a e-mail**. Pri firemnom účte je to adresa firmy; pri súkromnom
účte by to bola **tvoja osobná adresa a telefón**.

- FK KNV je appka **zdarma, bez reklám a bez in-app nákupov** — pri takom
  nasadení sa dá deklarovať **non-trader** a kontaktné údaje sa nezverejňujú
  (appka v EU zostáva dostupná, len sa používateľom zobrazí, že sa na vzťah
  neuplatňujú spotrebiteľské práva).
- Ak sa trader status deklarovať musí, Apple pripúšťa namiesto adresy aj
  **P. O. Box** (treba doklad o vzťahu k nemu).
- Ak si nie si istý zaradením, poraď sa — posúdenie „trader vs non-trader“ je
  právna otázka, nie technická.

### 6.5 Časová os v kocke

| Kedy | Apple | Google Play |
|---|---|---|
| Deň 0 | submit pod súkromným účtom; D-U-N-S lookup | osobný účet + closed testing s 12 testermi; D-U-N-S lookup |
| Deň 1–4 | **appka live v App Store** | beží 14-dňový test |
| Deň ~7–30 | žiadosť o konverziu na s.r.o. → verifikačný telefonát | firemný účet po D-U-N-S; alebo production access po teste |
| Potom | vydavateľ = MS ART Design s.r.o. (bez prenosu, bez ďalších 99 $) | publikácia; prípadný *Transfer app* na s.r.o. |

### 6.6 Čo ešte treba dotiahnuť v repozitári

- [ ] Verziu v obchode rieši EAS (`appVersionSource: "remote"` v `eas.json`) —
      pole `version` v `app.json` nie je pre store zdrojom pravdy.
- [ ] `eas.json` → `submit.production` je prázdny; po založení appky doplň
      `ascAppId` (a `appleTeamId`, ak ho budeš fixovať).
- [ ] Veľkosti iOS screenshotov ber podľa toho, čo aktuálne žiada App Store
      Connect (požiadavky Apple sa menili, sada v sekcii 1 je orientačná).

---

## 7. Zamietnutie z App Store review (18. 9. 2026) a čo sa opravilo

Prvé odoslanie (verzia 1.0 build 2) bolo zamietnuté z dvoch dôvodov. Oba sú
vyriešené v kóde; nižšie je aj to, čo treba prekliknúť v App Store Connect.

### 7.1 Guideline 4 (Design) — presmerovanie do prehliadača pri prihlásení

**Čo Apple vytkol:** používateľ bol presmerovaný do predvoleného prehliadača,
aby sa prihlásil alebo zaregistroval.

**Čo to reálne bolo:** samotné prihlásenie je natívne (`POST /auth/login`
priamo z appky). Problém robilo jedno tlačidlo „Registrácia do klubu“ na
prihlasovacej obrazovke, ktoré cez `Linking.openURL` otváralo
`fkknv.sk/registracia` v Safari.

**Oprava:** tlačidlo je odstránené a nahradené informačným textom (bez odkazu,
bez otvárania prehliadača). Appka je čítačkou klubových údajov a **neumožňuje
vytvorenie konta** — prihlášku podáva rodič na webe a konto zakladá vedenie
klubu po jej schválení. Tým zároveň na appku nedopadá požiadavka *Guideline
5.1.1(v)* na mazanie konta v aplikácii, keďže appka konto nevytvára.

> Alternatíva, ktorú Apple v zamietnutí sám ponúkol, bolo otvoriť registráciu
> cez **Safari View Controller** (`expo-web-browser`). Nešli sme do nej zámerne:
> ponechať v appke cestu k vytvoreniu konta by aktivovalo požiadavku na mazanie
> konta v appke a hrozilo ďalším kolom review.

### 7.2 Guideline 1.5 (Safety) — nefunkčná Support URL

**Čo Apple vytkol:** ako Support URL bolo uvedené `https://fkknv.sk`, čo je
rozcestník bez informácií o podpore.

**Oprava:** pridaná verejná stránka podpory **`/podpora`**
(`apps/web/src/app/podpora/page.tsx`) — kontaktný e-mail, čo priložiť do
požiadavky, najčastejšie problémy (prístup, heslo, notifikácie, oprava údajov)
a odkazy na prihlásenie a zásady ochrany údajov. Je dostupná **bez prihlásenia**
(na rozdiel od `/portal/pomoc`, ktorá je za loginom a na Support URL sa
nehodí). Odkazuje sa na ňu päta hlavnej stránky a prihlasovacia stránka.

⚠️ **Musíš dokončiť:** e-mail `podpora@fkknv.sk` musí reálne fungovať a niekto
ho musí čítať. Ak použijete inú adresu, zmeňte ju na dvoch miestach:
`apps/web/src/app/podpora/page.tsx` a `apps/mobile/app/index.tsx`
(konštanta `SUPPORT_EMAIL`).

### 7.3 Čo prekliknúť v App Store Connect

- [ ] **Support URL** → `https://fkknv.sk/podpora` (App Information).
- [ ] **Marketing URL** (nepovinné) → `https://fkknv.sk`.
- [ ] **Privacy Policy URL** → `https://fkknv.sk/dokumenty/ochrana-osobnych-udajov`.
- [ ] **App Review Information** → demo konto (login je povinný) + poznámka, že
      appka konto nevytvára a prístup zakladá vedenie klubu.
- [ ] Nasadiť web (`/podpora` musí byť online **pred** odoslaním) a až potom
      poslať nový build.

### 7.4 Poradie krokov pri resubmite

1. Nasaď web s novou stránkou podpory a over ju v prehliadači na mobile.
2. `eas build --profile production --platform ios` (buildNumber narastie sám —
   `autoIncrement` v `eas.json`).
3. `eas submit --profile production --platform ios`.
4. V App Store Connect uprav Support URL a doplň odpoveď recenzentovi do
   *Resolution Center* (vysvetli obe opravy).
5. Submit for Review.

> Pozn.: `eas.json` má `appVersionSource: "remote"`, takže marketingovú verziu
> (1.0) aj buildNumber spravuje EAS — pole `version` v `app.json` nie je pre
> store zdrojom pravdy a netreba ho meniť.
