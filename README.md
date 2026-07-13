# FKKNV Portál — FK Košická Nová Ves

Klubový portál pre mládežnícky futbalový klub **FK Košická Nová Ves** na doméne **fkknv.sk**, dostupný cez web a mobilné aplikácie pre Android a iOS. Funkčne inšpirovaný službou paysy.sk, dizajnovo vychádza z identity klubu (fkkosickanovaves.sk).

## Dokumentácia

| Dokument | Obsah |
|---|---|
| [docs/01-zadanie-a-pozadovane-funkcie.md](docs/01-zadanie-a-pozadovane-funkcie.md) | Zadanie, roly používateľov, funkčné požiadavky |
| [docs/02-technologie-a-architektura.md](docs/02-technologie-a-architektura.md) | Výber technológií, architektúra systému, integrácie |
| [docs/03-datovy-model.md](docs/03-datovy-model.md) | Dátový model — entity, vzťahy, sezónna logika kategórií |
| [docs/04-struktura-projektu.md](docs/04-struktura-projektu.md) | Štruktúra monorepa a jednotlivých aplikácií |
| [docs/05-plan-vyvoja.md](docs/05-plan-vyvoja.md) | Fázy vývoja, míľniky, harmonogram, prevádzka |
| [docs/06-bezpecnost-a-gdpr.md](docs/06-bezpecnost-a-gdpr.md) | Bezpečnosť, GDPR (údaje detí), zálohovanie |

## Spustenie vývojového prostredia

Vyžaduje Node 22+, pnpm 10+ a PostgreSQL 16.

```bash
pnpm install

# API — databáza, migrácie, seed (kategórie, sezóna 2026/2027, admin účet)
cd apps/api
cp .env.example .env          # uprav DATABASE_URL a SEED_ADMIN_*
npx prisma migrate dev
npx ts-node prisma/seed.ts
pnpm dev                      # API na http://localhost:3001/api/v1

# Web (v druhom termináli)
pnpm --filter @fkknv/web dev  # http://localhost:3000

# Mobil (Expo)
pnpm --filter @fkknv/mobile dev
```

Testy a build celého monorepa: `pnpm test`, `pnpm build`.

## Stav implementácie

| Oblasť | Stav |
|---|---|
| Monorepo, CI, Docker/Caddy infra | ✅ hotové |
| Doménová logika (kategórie podľa ročníkov, VS, sezóny) + testy | ✅ hotové |
| API: auth (JWT + roly), členovia, sezóny, automatické zaradenie | ✅ hotové |
| API: verejná registrácia + schvaľovanie | ✅ hotové |
| API: tréningy, dochádzka, zápasy, nominácie, živý zápis (idempotentný) | ✅ hotové |
| API: predpisy platieb, generovanie povinností, import banky + párovanie, dlžníci | ✅ hotové |
| Web: landing, registrácia, login, dashboard, členovia, dlžníci | ✅ hotové |
| Mobil: login + dashboard (Expo skeleton) | ✅ základ |
| Chat, push notifikácie, upomienky (joby), futbalnet sync, reporty PDF/XLSX | 🔜 ďalšie fázy (pozri docs/05) |

## Rýchly prehľad

- **Web portál:** Next.js (TypeScript) na doméne `fkknv.sk`
- **Mobilné aplikácie:** React Native + Expo (jeden kód pre Android aj iOS)
- **Backend:** NestJS API + PostgreSQL + Prisma, Redis pre fronty a notifikácie
- **Monorepo:** Turborepo + pnpm — zdieľané typy, API klient a doménová logika medzi webom a mobilom
- **Kľúčové funkcie:** správa členov a platieb s párovaním banky, dochádzka, kalendár tréningov/zápasov/turnajov, nominácie a živý zápis zápasu (góly, minutáž), skupinová komunikácia, reporty a export (Excel/PDF), podklady pre športový príspevok, integrácia s futbalnet.sk
