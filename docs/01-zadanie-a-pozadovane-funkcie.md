# 01 — Zadanie a požadované funkcie

## 1. Cieľ projektu

Mládežnícky futbalový klub **FK Košická Nová Ves** (fkkosickanovaves.sk) potrebuje klubový portál s funkciami podobnými službe **paysy.sk**:

- Samostatná doména: **fkknv.sk**
- Prístup cez **web** aj cez **mobilnú aplikáciu pre Android a iOS**
- Dizajn vychádza z vizuálnej identity klubu (farby, logo, typografia z fkkosickanovaves.sk)

## 2. Používatelia a roly

| Rola | Popis a oprávnenia |
|---|---|
| **Predseda klubu** (admin) | Plný prístup — financie, členovia, nastavenia, reporty, správa rolí |
| **Vedúci klubu / kategórie** | Správa členov, platieb a dochádzky v pridelených kategóriách, organizácia zápasov a turnajov, komunikácia |
| **Tréner** | Správa svojich kategórií: tréningy, dochádzka, nominácie, zápis zápasu (góly, minutáž), komunikácia so skupinou |
| **Hráč** | Vlastný profil, kalendár, nominácie, dochádzka, skupinový chat (starší hráči) |
| **Rodič** | Profily svojich detí, stav platieb, dochádzka detí, kalendár, notifikácie, chat, potvrdzovanie účasti, podklady pre športový príspevok |

Jeden účet môže mať viac rolí (napr. tréner je zároveň rodič; rodič má viac detí v rôznych kategóriách).

## 3. Vekové kategórie a sezóny

Kategórie: **U8, U9, U10, U11, U13, U15, U17, U19, Muži**

- Zaradenie hráča do kategórie je **automatické podľa dátumu narodenia** a pravidiel príslušnej sezóny (sezóna = 07/2026 – 06/2027 atď.).
- Pri prechode na novú sezónu systém navrhne preradenie hráčov do vyšších kategórií (tréner/vedúci potvrdí — musí byť možná aj manuálna výnimka, napr. hráč hráva za vyššiu kategóriu).
- Hranice ročníkov pre kategórie sú konfigurovateľné per sezóna (admin ich nastaví, systém dopočíta zaradenie).

## 4. Funkčné požiadavky

### 4.1 Dashboard — rýchly stav klubu
- Prehľad na pár klikov: stav platieb, počty členov, najbližšie tréningy/zápasy/podujatia.
- Obsah dashboardu podľa roly (predseda vidí celý klub, tréner svoju kategóriu, rodič svoje deti).

### 4.2 Správa financií
- Definícia poplatkov: skupiny (kategórie), sumy, periodicita (mesačné členské), termíny splatnosti, individuálne výnimky/zľavy (súrodenecká zľava, polovičné členské…).
- Generovanie predpisov platieb s **variabilným symbolom** per člen/obdobie + QR kód (PAY by square) pre jednoduchú úhradu.
- **Automatické párovanie s bankou** — import/napojenie bankových pohybov a párovanie podľa VS, sumy a mena; nespárované platby do manuálnej fronty.
- Prehľad úhrad mesačných poplatkov per člen, kategória aj celý klub.
- **Automatické notifikácie pri nezaplatení** členského (push + e-mail rodičovi, eskalácia po X dňoch, prehľad dlžníkov pre vedenie).

### 4.3 Správa členov
- Adresár členov s kompletnými údajmi (osobné údaje, kontakty na rodičov, zdravotné poznámky, číslo registrácie vo futbalnete, veľkosti výstroja…).
- Väzba rodič ↔ dieťa (jeden rodič — viac detí, dieťa — viac rodičov/zástupcov).
- História členstva, aktívny/neaktívny stav, hosťovania.

### 4.4 Registrácia nových členov
- Verejný online formulár na fkknv.sk — rodič zaregistruje dieťa, klub má ihneď všetky údaje.
- Workflow schválenia: prihláška → kontrola vedúcim → zaradenie do kategórie → vytvorenie účtov (rodič + hráč) → predpis platieb.
- Súhlasy GDPR a fotografovanie ako súčasť formulára.

### 4.5 Evidencia dochádzky
- Tréner vytvorí tréningy (jednorazovo aj opakovane), systém priradí členov kategórie.
- Rýchle odklikanie účasti na mobile (prítomný / neprítomný / ospravedlnený / zranený).
- Štatistiky dochádzky per hráč a kategória — rodič vidí, či dieťa (hlavne staršie) na tréningy naozaj chodí; vedenie vidí pomery účasti k plateným poplatkom.

### 4.6 Kalendár a plán zápasov/turnajov
- Kalendár tréningov, zápasov, turnajov a klubových podujatí per kategória aj celoklubový.
- **Integrácia s futbalnet.sk** — načítanie plánu súťažných zápasov a súpisiek pre kategórie (import pri založení + pravidelná synchronizácia), s možnosťou manuálnej korekcie.
- Rodič/hráč potvrdí účasť na udalosti (prídem / neprídem).

### 4.7 Zápasy — nominácie a živý zápis
- Tréner vytvorí zápas/turnaj: **deň, hodina, miesto, súper** a **nominuje hráčov** zo svojej kategórie (databáza hráčov naplnená na začiatku podľa skupín, resp. importom z futbalnet.sk).
- Hráčov v nominácii možno **pridávať a odoberať** podľa potreby, aj tesne pred zápasom.
- **Počas zápasu** tréner/vedúci v mobilnej aplikácii zapisuje udalosti s minutážou: góly (strelec, minúta), asistencie, striedania, karty, ďalšie poznámky.
- Výsledky a individuálne štatistiky sa automaticky premietajú do štatistík hráčov a kategórií.

### 4.8 Komunikácia
- **Skupiny (kanály)** per kategória: hráči/rodičia danej kategórie + ich tréneri; navyše kanály pre vedenie, trénerov, celoklubové oznamy.
- Priame správy členom alebo rodičom, hromadné správy s filtrovaním podľa skupín a kritérií (napr. „rodičia U11 s nezaplateným členským").
- Push notifikácie (mobil), e-mail ako záložný kanál, oznamy s potvrdením prečítania.

### 4.9 Reporty a exporty
- Export dát do **Excelu (XLSX)** a **PDF**: členovia, platby, dlžníci, dochádzka, štatistiky zápasov.
- Uložené/naplánované reporty pre vedenie (napr. mesačný prehľad financií na e-mail).

### 4.10 Štatistiky
- Dochádzka (per hráč, kategória, obdobie), platby (výber, dlhy, trendy), zápasové štatistiky (góly, minutáž, účasť na zápasoch), počty členov v čase.
- Grafy na dashboarde, podklad pre rozhodovanie vedenia.

### 4.11 Podklady pre športový príspevok
- Automatické vygenerovanie **PDF potvrdenia pre rodiča** — prehľad zaplatených poplatkov za zvolené obdobie ako podklad pre športový príspevok od zamestnávateľa.
- Rodič si potvrdenie stiahne sám z portálu/aplikácie, klub nemá administratívu.

## 5. Nefunkčné požiadavky

- **Slovenčina** ako primárny jazyk UI, pripravené na ďalšie jazyky (i18n).
- Mobile-first — tréneri a rodičia budú primárne na telefóne (dochádzka a zápis zápasu sa odklikáva pri ihrisku).
- **Offline tolerancia v mobilnej appke** pre dochádzku a zápis zápasu (pri ihrisku býva slabý signál) — lokálny zápis so synchronizáciou.
- GDPR — spracúvajú sa údaje detí (pozri [06-bezpecnost-a-gdpr.md](06-bezpecnost-a-gdpr.md)).
- Malý klub → dôraz na nízke prevádzkové náklady a jednoduchú údržbu.
