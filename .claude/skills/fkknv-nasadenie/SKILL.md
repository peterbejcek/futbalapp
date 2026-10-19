---
name: fkknv-nasadenie
description: Nasadenie FKKNV portálu na produkčný VPS (/opt/fkknv) — príkazy, kontrola po nasadení, záloha DB. Použi, keď používateľ pýta nasadenie alebo sa pripravujú príkazy pre produkciu.
---

# Nasadenie

Produkcia: VPS `/opt/fkknv` (repo `/opt/fkknv/app`, compose `/opt/fkknv/app/infra`), podľa `docs/09-nasadenie-jeden-vps.md` a `docs/12-nasadenie-verejneho-webu.md`. Príkazy píš vždy s plnou cestou a uveď, že sa zadávajú na serveri (SSH).

Nasadenie (migrácie DB sa spustia samy pri štarte API kontajnera):
```
cd /opt/fkknv/app && git pull origin claude/fkknv-portal-planning-i56zat && cd infra && docker compose --env-file .env up -d --build
```
Záloha pred rizikovou zmenou: `/opt/fkknv/app/infra/backup.sh daily`.
Kontrola: `cd /opt/fkknv/app/infra && docker compose --env-file .env ps` a `docker compose --env-file .env logs --tail=40 api | grep -i "migrat\|error"`.
Vetva `main` neexistuje; predvolená a jediná pracovná vetva je `claude/fkknv-portal-planning-i56zat`.
