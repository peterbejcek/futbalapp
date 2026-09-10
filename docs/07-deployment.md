# 07 — Deployment krok po kroku

Návod na prvé nasadenie portálu do produkcie: **API na VPS** (Docker), **web na Vercel**, **mobilné aplikácie cez EAS** do Google Play a App Store. Odhad času: 1 deň čistej práce + čakanie na schválenie Apple účtu a store review.

## Prehľad cieľového stavu

```
fkknv.sk        → Vercel (Next.js web)
api.fkknv.sk    → VPS (Caddy → NestJS API, Postgres, Redis) — TLS automaticky
mobil           → Google Play + App Store (Expo/EAS buildy)
```

---

## Krok 0 — Účty a podklady (urobiť hneď, niektoré veci trvajú dni)

| Čo | Kde | Poznámka |
|---|---|---|
| Doména **fkknv.sk** | ľubovoľný SK registrátor (Websupport, Wedos…) | ~15 €/rok |
| VPS | Hetzner Cloud (CX22, 2 vCPU/4 GB) | ~5 €/mes., lokalita Norimberg/Falkenstein (EÚ) |
| Vercel účet | vercel.com | Hobby tier zdarma stačí |
| **Apple Developer Program** | developer.apple.com | 99 USD/rok, **schvaľovanie trvá aj týždeň — začať prvé** |
| Google Play Console | play.google.com/console | 25 USD jednorazovo |
| Expo účet | expo.dev | zdarma (EAS free tier) |
| Resend účet | resend.com | e-maily; free tier 100 mailov/deň stačí |
| GitHub repo | už existuje | CI beží z `.github/workflows` |

Podklady od klubu: logo v SVG/PNG (ikona appky), IBAN klubu, výšky členského per kategória, zoznam trénerov s e-mailami.

---

## Krok 1 — DNS záznamy

U registrátora domény nastavte:

| Typ | Meno | Hodnota |
|---|---|---|
| A | `api` | IP adresa VPS |
| CNAME | `@` (alebo A podľa návodu Vercelu) | `cname.vercel-dns.com` |
| CNAME | `www` | `cname.vercel-dns.com` |
| TXT + MX | podľa Resend | až v kroku 6 (overenie domény pre e-maily) |

Propagácia trvá minúty až hodiny. Overenie: `dig api.fkknv.sk +short` musí vrátiť IP VPS.

---

## Krok 2 — Príprava VPS

```bash
# prihlásenie (IP z Hetzner konzoly, SSH kľúč nahratý pri vytváraní)
ssh root@<IP-VPS>

# aktualizácia + docker
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh

# firewall: len SSH, HTTP, HTTPS
apt install -y ufw
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable

# adresárová štruktúra
mkdir -p /opt/fkknv/app /opt/fkknv/backups
```

> Bezpečnosť: prihlasovanie len SSH kľúčom (`PasswordAuthentication no` v `/etc/ssh/sshd_config`), heslá a 2FA na Hetzner/GitHub účtoch.

---

## Krok 3 — Nasadenie API (Docker Compose)

```bash
cd /opt/fkknv/app
git clone https://github.com/peterbejcek/futbalapp.git .

# produkčné premenné — compose ich číta z infra/.env
cat > infra/.env <<'EOF'
POSTGRES_PASSWORD=<silné-heslo-1>
JWT_SECRET=<silné-heslo-2, min. 32 znakov>
RESEND_API_KEY=<re_... z resend.com, môže sa doplniť neskôr>
EOF
chmod 600 infra/.env

# build a štart (postgres + redis + api + caddy)
cd infra
docker compose --env-file .env up -d --build

# kontrola
docker compose ps
docker compose logs api | tail -20
```

Migrácie sa spúšťajú automaticky pri štarte kontajnera (`db:deploy` v Dockerfile CMD). Caddy si sám vybaví TLS certifikát pre `api.fkknv.sk` (musí už fungovať DNS z kroku 1).

**Seed — kategórie, sezóna, admin účet:**

```bash
docker compose exec \
  -e SEED_ADMIN_EMAIL=predseda@fkknv.sk \
  -e SEED_ADMIN_PASSWORD='<jednorazové-heslo>' \
  api npx ts-node prisma/seed.ts
```

**Overenie:** `curl https://api.fkknv.sk/api/v1/health` → `{"status":"ok"}`. Potom sa prihláste a heslo admina hneď zmeňte.

---

## Krok 4 — Web na Vercel

1. Vercel → **Add New → Project** → import GitHub repa `peterbejcek/futbalapp`.
2. Nastavenia projektu:
   - **Root Directory:** `apps/web`
   - Framework: Next.js (autodetekcia), build command aj install command nechať default (Vercel rozpozná pnpm workspace).
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://api.fkknv.sk/api/v1`
4. Deploy → po zbehnutí **Settings → Domains** → pridať `fkknv.sk` a `www.fkknv.sk` (DNS už smeruje z kroku 1).
5. Overenie: `https://fkknv.sk` sa načíta, prihlásenie admina funguje, chat sa pripája (v konzole prehliadača nesmú byť WebSocket chyby — API povoľuje CORS pre `https://fkknv.sk` z docker-compose).

Od teraz každý push do `main` nasadí web automaticky (Vercel) — API sa nasadzuje krokom z Kroku 8.

---

## Krok 5 — Mobilné aplikácie (Expo EAS)

Na lokálnom počítači (nie VPS):

```bash
npm i -g eas-cli
cd apps/mobile
eas login                      # Expo účet klubu
eas init                       # vytvorí projectId a zapíše ho do app.json
```

**Ikony a splash:** nahraďte `assets/` súbormi z klubového loga (icon.png 1024×1024, adaptive-icon, splash) a doplňte cesty do `app.json` (`icon`, `android.adaptiveIcon.foregroundImage`, `splash.image`).

**Buildy:**

```bash
eas build --platform android --profile production   # AAB pre Google Play
eas build --platform ios --profile production       # certifikáty vybaví EAS sprievodca
```

**Google Play (prvé nahratie ručne):**
1. Play Console → Create app („FK Košická Nová Ves", slovenčina, zadarmo).
2. Nahrať AAB do **Internal testing**, pridať testerov (tréneri), po otestovaní **Production**.
3. Vyplniť Store listing (popis, screenshoty z appky, ikona) + Data safety formulár.

**App Store:**
1. App Store Connect → New App (bundle ID `sk.fkknv.app` — zhoduje sa s `app.json`).
2. `eas submit --platform ios` nahrá build do TestFlight.
3. TestFlight → interní testeri → po otestovaní Submit for Review (uviesť demo účet pre Apple review!).
4. Review trvá typicky 1–3 dni.

**Aktualizácie appky:** JS zmeny bez store review: `eas update --branch production`. Zmeny natívnych závislostí = nový `eas build` + submit.

### Push notifikácie

Appka posiela push cez **Expo Push** (nové správy v komunikácii, nominácie, úlohy, upomienky).

- **iOS (APNs):** kľúče vybaví `eas build` sprievodca automaticky — netreba nič navyše.
- **Android (FCM):** Expo Push na Androide **vyžaduje vlastný Firebase projekt** a FCM V1
  kľúč. Bez neho appka na Androide síce vypýta povolenie, ale token sa nezaregistruje a
  žiadna notifikácia nepríde (na iOS to funguje). Nastavenie je jednorazové:

**Čo je „Firebase projekt":** Firebase je bezplatná služba Googlu; jej súčasťou je
**FCM (Firebase Cloud Messaging)** — brána, cez ktorú Google doručuje push na Android
zariadenia. Expo posiela naše notifikácie práve cez FCM, preto potrebuje prístup k
jednému Firebase projektu klubu.

1. **Vytvor Firebase projekt:** [console.firebase.google.com](https://console.firebase.google.com)
   → **Add project** → názov napr. „FK KNV" → Google Analytics môžeš vypnúť → Create.
2. **Pridaj Android aplikáciu do projektu:** v projekte klikni na ikonu **Android**
   (Add app) → do poľa *Android package name* zadaj presne **`sk.fkknv.app`**
   (musí sa zhodovať s `android.package` v `app.json`) → prezývku a SHA‑1 môžeš
   nechať prázdne → **Register app**.
3. **Stiahni `google-services.json`** (Firebase ho ponúkne hneď v ďalšom kroku) a ulož
   ho do `apps/mobile/google-services.json`. Súbor **commitni do repa** — build ho
   potrebuje (obsahuje len konfiguráciu projektu a verejný kľúč, nie tajomstvo).
   V `app.json` je už naň odkaz: `"android": { "googleServicesFile": "./google-services.json" }`.
4. **Nahraj FCM V1 kľúč do EAS** (tým Expo získa právo odosielať cez tvoj FCM):
   - Firebase → **⚙ Project settings → Service accounts → Generate new private key** →
     stiahne sa JSON so servisným účtom (**tajné — necommitovať!**).
   - V `apps/mobile` spusti `eas credentials` → *Android* → *Google Service Account* →
     *Manage push notifications (FCM V1)* → nahraj ten JSON.
5. **Nový Android build** (zmena natívnej konfigurácie, nie OTA):
   `eas build --platform android --profile production` a nahraj do Play Console.

**Overenie:** na fyzickom Androide sa prihlás, pošli správu do kanála a skontroluj
notifikáciu. V dev builde vidno v logoch `[push] token zaregistrovaný: …` (úspech)
alebo `[push] registrácia zlyhala: …` (typicky chýbajúce FCM credentials).

---

## Krok 6 — E-maily (Resend)

1. resend.com → **Domains → Add Domain** → `fkknv.sk` → pridať zobrazené TXT/MX/DKIM záznamy u registrátora.
2. Po verifikácii: **API Keys → Create** → doplniť `RESEND_API_KEY` do `/opt/fkknv/app/infra/.env`.
3. `docker compose up -d api` (reštart s novým kľúčom).
4. Test: `POST /finance/dunning/run` (ako admin) — dlžníkom odíde push aj e-mail; v Resend dashboarde vidno odoslané maily.

---

## Krok 7 — Zálohy a monitoring

**Zálohy DB — denná / týždenná / mesačná** (skript `infra/backup.sh` je v repe).
Každá vrstva má vlastný priečinok a retenciu (grandfather-father-son): denné
`/opt/fkknv/backups/daily`, týždenné `/weekly`, mesačné `/monthly`. Predvolene sa
ponecháva 14 denných, 8 týždenných a 12 mesačných (dá sa zmeniť cez env
`RETAIN_DAILY` / `RETAIN_WEEKLY` / `RETAIN_MONTHLY`). Formát je `pg_dump -Fc`;
každá záloha sa po vytvorení overí (`pg_restore -l`) a až potom uloží.

```bash
chmod +x /opt/fkknv/app/infra/backup.sh /opt/fkknv/app/infra/restore.sh
crontab -e
# denne 3:30, týždenne v nedeľu 3:40, mesačne 1. v mesiaci 3:50
30 3 * * *   /opt/fkknv/app/infra/backup.sh daily   >> /var/log/fkknv-backup.log 2>&1
40 3 * * 0   /opt/fkknv/app/infra/backup.sh weekly  >> /var/log/fkknv-backup.log 2>&1
50 3 1 * *   /opt/fkknv/app/infra/backup.sh monthly >> /var/log/fkknv-backup.log 2>&1
```

Prvú zálohu spusti ručne na overenie: `/opt/fkknv/app/infra/backup.sh daily`.

Zálohy odporúčam navyše synchronizovať mimo VPS (napr. `rclone` na Hetzner
Storage Box / S3 — RPO 24 h). **Otestujte obnovu** aspoň raz skriptom
`infra/restore.sh <dump>` (pýta potvrdenie, spustí `pg_restore --clean`).

**Monitoring (zadarmo):**
- Uptime: uptimerobot.com — HTTPS check na `https://api.fkknv.sk/api/v1/health` a `https://fkknv.sk`, alert na e-mail predsedu.
- Chyby: sentry.io (free tier) — DSN doplniť neskôr do API/webu (zatiaľ nie je zapojené, stačí uptime).

---

## Krok 8 — Aktualizácia na novú verziu

```bash
ssh root@<IP-VPS>
cd /opt/fkknv/app
git pull
cd infra && docker compose --env-file .env up -d --build api
docker compose logs api | tail -5     # migrácie prebehnú automaticky
```

Web sa nasadí sám (Vercel sleduje `main`). Mobil: `eas update` pre JS zmeny.

---

## Krok 9 — Prvotné nastavenie portálu (už v aplikácii)

Prihlásený admin:

1. **Import hráčov** — `POST /members` z CSV od vedúcich (alebo postupne cez registráciu rodičmi).
2. **Zaradenie do kategórií** — `POST /seasons/:id/assign-memberships`, skontrolovať výnimky.
3. **Poplatky** — `POST /finance/fee-plans` (mesačné členské per kategória) → `POST /finance/obligations/generate` na prvý mesiac.
4. **Futbalnet** — pre každú kategóriu `POST /futbalnet/config/:code` s URL súťaže z futbalnet.sk a presným názvom tímu, potom `POST /futbalnet/sync`.
5. **Chat** — `POST /chat/sync` (naplní kanály podľa súpisiek).
6. **Banka** — dohodnúť proces: export výpisov (CAMT/CSV) raz týždenne → `POST /finance/bank/import`; QR kódy s VS posielať rodičom.
7. Roly trénerov — vytvoriť účty a prideliť `COACH` so scope na kategóriu.

---

## Kontrolný zoznam pred spustením

- [ ] `https://api.fkknv.sk/api/v1/health` vracia ok, TLS platné
- [ ] `https://fkknv.sk` — registrácia, login, chat (WebSocket), PDF príspevok fungujú
- [ ] Admin heslo zmenené zo seed hodnoty; `infra/.env` má práva 600
- [ ] Appka na fyzickom Androide aj iPhone: login, dochádzka offline, push notifikácia doručená
- [ ] Prvá záloha DB existuje a obnova otestovaná
- [ ] Upomienky: testovací dlžník dostal push + e-mail
- [ ] GDPR: privacy policy zverejnená na webe, súhlasy vo formulári (texty dodá klub)
