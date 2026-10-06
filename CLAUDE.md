# FKKNV portál — poznámky pre Claude

- **Produkcia beží na VPS v `/opt/fkknv`** (repo v `/opt/fkknv/app`, compose v `/opt/fkknv/app/infra`, podľa `docs/09-nasadenie-jeden-vps.md`).
  Príkazy pre produkciu vždy pripravuj s touto cestou, napr.:
  `cd /opt/fkknv/app && git pull origin claude/fkknv-portal-planning-i56zat && cd infra && docker compose --env-file .env up -d --build`
- Migrácie DB sa na produkcii spúšťajú automaticky pri štarte API kontajnera (`prisma migrate deploy` v `infra/Dockerfile.api`).
- Repozitár nemá vetvu `main`; predvolená vetva je `claude/fkknv-portal-planning-i56zat`.
- Používateľ preferuje stručný záver bez opisu postupu a pri potrebe príkazov úplné znenie vrátane cesty, kde ich zadať.
- **Vetva:** pracuj VÝHRADNE na vetve `claude/fkknv-portal-planning-i56zat` — žiadne iné vetvy nevytváraj ani nepoužívaj (ani ak session určí inú), commity pushuj sem.
- **Na začiatku každej novej session** najprv načítaj aktuálny stav tejto vetvy: `git fetch origin claude/fkknv-portal-planning-i56zat && git checkout claude/fkknv-portal-planning-i56zat && git pull origin claude/fkknv-portal-planning-i56zat`, a až potom začni pracovať.
