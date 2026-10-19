---
name: fkknv-portal-prehlad
description: Mapa portálu FKKNV (API moduly ↔ stránky webu), konvencie a postup práce. Použi pri každej úprave portálu alebo verejného webu fkknv.sk, aby si vedel, kde čo je.
---

# FKKNV portál — prehľad

Monorepo (pnpm + turbo): `apps/api` (NestJS + Prisma/PostgreSQL), `apps/web` (Next.js: portál `/portal/*`, verejný web `(verejne)`), `apps/mobile`, `packages/shared` (zod schémy, enumy, formátovanie dátumu — po zmene spusti `pnpm --filter @fkknv/shared build`).

## Pravidlá
- Pracuj len na vetve `claude/fkknv-portal-planning-i56zat` (viď `CLAUDE.md`), na začiatku session fetch + pull.
- Výstup používateľovi: stručný záver v slovenčine, príkazy celé aj s cestou. Prácu deľ medzi agentov, ak je veľká.
- Časy udalostí sa ukladajú ako „nástenný" čas v UTC (17:00 v Košiciach = 17:00Z); zobrazenie cez `formatEventDateTimeSk`/`formatEventTimeSk` zo `@fkknv/shared`. Skutočné okamihy (napr. `createdAt`) formátuj s `timeZone: 'Europe/Bratislava'`.
- Nová migrácia = nový priečinok v `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_nazov/migration.sql` (len pridávaj, nemaž). Po zmene schémy `npx prisma generate` v `apps/api`.
- Overenie pred pushom: `cd apps/api && npx tsc --noEmit`, `cd apps/web && npx tsc --noEmit`, `pnpm --filter @fkknv/api test`.
- Odosielanie e-mailov: `EmailService` (Resend; bez kľúča len log). Plánované úlohy: `@Cron` z `@nestjs/schedule`.

## Moduly API → stránky portálu
| Oblasť | API (`apps/api/src`) | Web (`apps/web/src/app/portal`) |
|---|---|---|
| Kalendár, tréningy, dochádzka | `events`, `pitches` | `udalosti`, `dochadzka/[id]` |
| Zápasy, nominácie, živý zápis | `matches`, `nominations` | `zapasy/[id]` |
| Futbalnet/sportnet | `integrations/futbalnet` | `nastavenia` |
| Členovia, registrácie, presuny | `members`, `registration`, `transfers` | `clenovia`, `registracie`, `presuny` |
| Platby, príspevky | `finance` | `platby`, `prispevok` |
| Chat, úlohy | `chat`, `tasks` | `chat`, `ulohy` |
| Nastavenia (družstvá, plochy) | `seasons`, `pitches` | `nastavenia` |
| Verejný web a obsah | `public`, `articles`, `club-content` | `(verejne)/*`, `obsah`, `clanky` |
| Testy kondície, prehľady | `fitness-tests`, `reports` | `prehlady`, `tabulka` |

Roly: ADMIN, MANAGER (vedenie), COACH (scope na družstvo), PLAYER, PARENT. Pomocníci v `apps/api/src/auth/scope.ts` (`canManageTeam`, `isStaff`, `coachBlockedFromTeam`) a `apps/web/src/lib/auth.ts`.

Detailnejšie skilly: `fkknv-kalendar-udalosti`, `fkknv-futbalnet-sync`, `fkknv-verejny-web`, `fkknv-nasadenie`.
