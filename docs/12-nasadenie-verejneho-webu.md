# Nasadenie verejného webu fkknv.sk

Vetva: `claude/fkknv-portal-planning-i56zat`. Všetky príkazy sa zadávajú na VPS (SSH). Produkcia: `/opt/fkknv`.

## Čo sa nasadzuje
- Verejný web na `/` (mužstvá, kalendár, klub, novinky, galéria), pôvodná úvodná stránka portálu je na `/klubovy-portal`.
- Verejné API `/api/v1/public/*`, správa obsahu a článkov v portáli (`/portal/obsah`, `/portal/clanky`).
- Migrácie `20261014120000_public_web_consent_articles` a `20261015120000_club_content` (len pridávajú stĺpce a tabuľky, nič nemažú ani nemenia). Spustia sa automaticky pri štarte API.
- Po nasadení nie je verejný žiadny hráč (chýba súhlas), žiaden tréning (chýba príznak) a žiaden nový obsah (všetko je koncept), kým to klub nenastaví.

## 1. Pred nasadením: záloha DB
```
/opt/fkknv/app/infra/backup.sh daily
ls -lh /opt/fkknv/backups/daily | tail -3
```

## 2. Nasadenie
```
cd /opt/fkknv/app && git pull origin claude/fkknv-portal-planning-i56zat && cd infra && docker compose --env-file .env up -d --build
```
Voliteľné premenné v `/opt/fkknv/app/infra/.env` (nemusíte nastavovať): `CLUB_NAME` (predvolené „FK Košická Nová Ves"), `CLUB_TIMEZONE` (predvolené „Europe/Bratislava"). Web číta API cez `API_INTERNAL_URL=http://api:3001/api/v1` (už v `docker-compose.yml`).

## 3. Kontrola po nasadení
```
cd /opt/fkknv/app/infra && docker compose --env-file .env ps
docker compose --env-file .env logs --tail=40 api | grep -i "migrat\|error"
curl -s -o /dev/null -w "%{http_code}\n" https://fkknv.sk/
curl -s -o /dev/null -w "%{http_code}\n" https://fkknv.sk/prihlasenie
curl -s https://api.fkknv.sk/api/v1/public/teams | head -c 300; echo
curl -s -o /dev/null -w "%{http_code}\n" https://api.fkknv.sk/api/v1/members
curl -s https://fkknv.sk/sitemap.xml | head -20
curl -sI https://fkknv.sk/portal | grep -i x-robots-tag
```
Očakávanie: `/` 200, `/prihlasenie` 200, `public/teams` vráti JSON s mužstvami, `/members` bez tokenu 401, sitemap neobsahuje `/portal` ani `/prihlasenie`, `/portal` má `X-Robots-Tag: noindex`. Prihláste sa do portálu a skontrolujte, že prihlásenie, registrácia a mobilná aplikácia fungujú.

Limit nahrávania dokumentov je 15 MB (Caddy ho nekráti, `request_body` nie je v `Caddyfile` nastavený). Otestujte nahratie najväčšieho dokumentu (13,4 MB) cez `/portal/obsah`.

## 4. Spustenie obsahu (po potvrdení klubom)
Najprv skontrolujte `docs/11-obsah-webu-na-potvrdenie.md`. Potom importér (nezapisuje, kým nepoužijete `--apply`):
```
cd /opt/fkknv/app/apps/api && DATABASE_URL="<produkčná DATABASE_URL z infra/.env>" pnpm content:import
cd /opt/fkknv/app/apps/api && DATABASE_URL="<produkčná DATABASE_URL z infra/.env>" pnpm content:import -- --apply --verify-files
```
Pozor: po `--apply` je 60 archívnych článkov verejných. Ak ich klub nechce, odstráňte ich pred importom z `apps/api/prisma/content-import/club-content.json`. Importér beží na hostiteľovi (nie v kontajneri), preto musí byť `DATABASE_URL` dosiahnuteľná z hostiteľa. Ak PostgreSQL nie je publikovaný na hostiteľa, spustite importér v kontajneri `api` (`docker compose --env-file .env exec api ...`) alebo začnite bez importu a obsah zadajte ručne v `/portal/obsah`.

## 5. Spustenie verejných údajov
1. Súhlasy hráčov: v `/portal/clenovia` pri úprave člena (sekcia „Zverejnenie na webe"). Bez súhlasu sa hráč na webe nezobrazí.
2. Tréningy na webe: pri vytváraní tréningu zaškrtnúť „Zverejniť v kalendári na verejnom webe". Zápasy a turnaje sú verejné vždy.
3. Obsah: `/portal/obsah`, publikovať možno len s potvrdením klubu.

## Vrátenie späť
Migrácie sú len aditívne, kód sa dá vrátiť bez obnovy DB:
```
cd /opt/fkknv/app && git checkout b8a5436 && cd infra && docker compose --env-file .env up -d --build
```
(`b8a5436` je posledný commit pred verejným webom.) Návrat na vetvu potom: `git checkout claude/fkknv-portal-planning-i56zat`. Obnovu DB zo zálohy (`infra/restore.sh`) netreba, ak nešlo o chybu dát.

## Známe riziká
- `GET /api/v1/members/:id/photo` je verejný bez kontroly súhlasu (existujúce správanie, používa ho portál a mobilná aplikácia). Kto pozná ID člena, dostane fotku.
- Stav „odložený zápas" model neobsahuje.
- Rate-limit verejného API je v pamäti jednej inštancie API.
