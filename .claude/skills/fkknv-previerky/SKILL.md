---
name: fkknv-previerky
description: Previerky výkonnosti hráčov FKKNV — disciplíny, kategórie (silové/vytrvalostné/technické), kde je kód a ako pridať novú disciplínu. Použi pri úpravách previerok na webe, v API alebo v mobile.
---

# Previerky výkonnosti

## Kde je kód
- Zdieľané definície: `packages/shared/src/fitness.ts` (`FITNESS_DISCIPLINES`, `FITNESS_CATEGORIES`, `validateFitnessValue`, `fitnessDelta`, `previousFitnessValue`).
- API: `apps/api/src/fitness-tests/*` (validácia je generická podľa shared definícií), model `FitnessTest` v `apps/api/prisma/schema.prisma`.
- Web: `apps/web/src/components/fitness.tsx` (karta hráča, `CategoryTabs`), `apps/web/src/app/portal/prehlady/previerky/page.tsx` (prehľad), `.../previerky/nova/page.tsx` (zadávanie; výber disciplín chipmi, pamätá sa v localStorage `fkknv.previerky.disciplines`).
- Mobil: `apps/mobile/src/fitness.ts`, `apps/mobile/app/previerky/*`.

## Disciplíny a kategórie
- Silové: run10m, run30m, standingJump, pullUpHang (s), sitUps30, medicineBallThrow (m).
- Vytrvalostné: enduranceRun (m, dĺžka 6/12 min podľa kategórie), shuttleEndurance (úseky), shuttleRun (s).
- Technické: dribbleSlalom (s), juggling, passesRunning, shooting.
- `run20m` je zrušená — stĺpec v DB ostáva (staré dáta), v UI/API sa nepoužíva.

## Nová disciplína
1. Pridaj kľúč do `FitnessDisciplineKey`, `FitnessTestLike` a riadok do `FITNESS_DISCIPLINES` (kategória, jednotka, `integer`, `max`, `lowerIsBetter`).
2. Pridaj nullable stĺpec do `FitnessTest` + migráciu (`ALTER TABLE ... ADD COLUMN`), `npx prisma generate`.
3. Doplň kľúč do `FitnessTestInput` (API), `FitnessTest` v `apps/web/src/components/fitness.tsx` a `apps/mobile/src/fitness.ts`.
4. `pnpm --filter @fkknv/shared build`, typecheck api/web/mobile.
