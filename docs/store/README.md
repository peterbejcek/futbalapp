# Vizuály a texty pre obchody (FK KNV)

Assety pre záznam v **Google Play** a **App Store**. Generuje ich
`pripravit-vizualy.py` z klubových assetov v `apps/mobile/assets/`, takže sa
dajú kedykoľvek prerobiť bez grafického editora.

```bash
pip install Pillow
python3 docs/store/pripravit-vizualy.py                        # ikona + feature graphic
python3 docs/store/pripravit-vizualy.py --screenshoty ~/snimky # + úprava screenshotov
```

## Čo je v priečinku

| Súbor | Rozmer | Kde sa použije |
|---|---|---|
| `icon-512.png` | 512×512 | Play → ikona aplikácie |
| `feature-graphic-1024x500.png` | 1024×500 | Play → hlavná grafika (povinná) |
| `01-prehlad-zapasy.png` | 1125×2000 | Play → screenshot telefónu |
| `02-kalendar.png` | 1125×2000 | Play → screenshot telefónu |
| `03-ulohy.png` | 1125×2000 | Play → screenshot telefónu |
| `04-komunikacia.png` | 1125×2000 | Play → screenshot telefónu |

## ⚠️ Pomer screenshotov

Google Play vyžaduje pri telefónnych screenshotoch pomer medzi **16:9 a 9:16**
(0,5625–1,7778) a stranu 320–3840 px. Snímky z telefónu majú často pomer
**mimo** tohto rozsahu — napríklad 899×2000 je 0,450 a **upload spadne**.

Skript preto obsah nedeformuje: odstrihne stavovú lištu (čas, batéria,
notifikácie) aj navigačnú lištu Androidu a snímku doplní klubovou navy na
presných **1125×2000 = 9:16**.

## Texty záznamu

**Názov (max 30 znakov)**

```
FK Košická Nová Ves
```

**Krátky popis (max 80 znakov)**

```
Kalendár, nominácie, dochádzka a komunikácia pre členov FK Košická Nová Ves.
```

**Úplný popis (max 4000 znakov)**

```
Oficiálna aplikácia mládežníckeho futbalového klubu FK Košická Nová Ves. Rodičom, hráčom, trénerom a vedeniu klubu prináša celé klubové dianie na jedno miesto — namiesto skupinových chatov, v ktorých sa informácie strácajú.

ČO V APLIKÁCII NÁJDETE

• Kalendár — tréningy, zápasy a klubové podujatia podľa družstiev, v prehľade najbližších udalostí aj v mesačnom zobrazení.
• Zápasy a nominácie — nominácia na zápas, čas a miesto zrazu, potvrdenie účasti jedným klepnutím.
• Dochádzka — evidencia účasti na tréningoch a prehľady za celé obdobie.
• Komunikácia — klubové oznamy a samostatné kanály jednotlivých družstiev vrátane fotiek a dokumentov.
• Úlohy — zadania pre trénerov a vedenie klubu s termínmi.
• Členské príspevky — prehľad platieb a variabilných symbolov.
• Upozornenia — nová nominácia, zmena času zrazu, nový oznam.

PRE KOHO JE APLIKÁCIA

Pre členov FK Košická Nová Ves — rodičov, hráčov, trénerov a vedenie klubu. Obsah je dostupný po prihlásení a každý vidí len to, čo sa týka jeho družstiev.

PRÍSTUP DO APLIKÁCIE

Aplikácia neumožňuje vytvorenie konta. Prihlasovacie údaje vytvára vedenie klubu svojim členom po schválení prihlášky, ktorú rodič podáva na klubovej stránke fkknv.sk. Ak prístup ešte nemáte alebo vám prihlásenie nefunguje, napíšte nám na support@fkknv.sk.

BEZ REKLÁM A BEZ PLATIEB

Aplikácia neobsahuje reklamy ani platby v aplikácii. Osobné údaje neposkytujeme na reklamné účely.

Podpora: https://fkknv.sk/podpora
Ochrana osobných údajov: https://fkknv.sk/dokumenty/ochrana-osobnych-udajov
```

Odsek **Prístup do aplikácie** tam je zámerne: recenzent uvidí prihlasovaciu
obrazovku a v popise nájde vysvetlenie, ktoré sedí s tým, čo je zadané
v *Prístup k aplikácii* (Play) a v *App Review Information* (Apple).

## Ostatné polia záznamu

- **Kategória:** Šport
- **Kontaktný e-mail:** `support@fkknv.sk` · **telefón:** `+421 944 566 226` · **web:** `https://fkknv.sk`
- **Zásady ochrany osobných údajov:** `https://fkknv.sk/dokumenty/ochrana-osobnych-udajov`
- **URL na vymazanie údajov (Data safety):** `https://fkknv.sk/podpora#vymazanie-udajov`
- **Demo konto pre recenzenta:** `review@fkknv.sk` (izolované demo dáta, viď sekcia 1 v `10-publikovanie-do-obchodov.md`)

## Poznámky k jednotlivým screenshotom

- `03-ulohy.png` je najslabší — v pôvodnej snímke nadpis „Nová úloha" prerastal
  stavovú lištu, takže horný okraj je nahusto. Navyše je to administrátorská
  funkcia, ktorá rodiča nezaujme. Pri ďalšom fotení ho nahraď **nomináciou na
  zápas** alebo **dochádzkou**.
- **Prihlasovaciu obrazovku medzi screenshoty nedávaj**, kým nemáš snímku
  z aktuálneho buildu. Staršie snímky majú na sebe tlačidlo „Registrácia do
  klubu", ktoré už v appke nie je (odstránené kvôli App Store Guideline 4) —
  publikovaný screenshot by zobrazoval UI, ktoré neexistuje.

## Pred fotením nových screenshotov

Snímky rob z buildu postaveného na **aktuálnom** kóde, nie z appky, ktorú máš
práve v telefóne:

```bash
git pull
grep -n "Registrácia do klubu" apps/mobile/app/index.tsx   # nesmie nič vypísať
```
