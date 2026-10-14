# Dev nástroje (mimo `src/`)

`mock-public-api.mjs` je malý node http server, ktorý napodobňuje verejné API portálu (`/api/v1/public/*`)
podľa kontraktu `packages/shared/src/public-api.ts`. Všetky mená a údaje sú FIKTÍVNE; dátumy sú relatívne k dnešku
(odohraný zápas s výsledkom, zrušený zápas, tréningy, 2 články, mužstvá U13 A, U13 B, U15 A, hráč bez fotky). CORS je povolený.
Nie je súčasťou aplikácie a nesmie sa importovať zo `src/`.

```bash
# 1. terminál (z koreňa repozitára)
MOCK_PORT=3101 node apps/web/dev/mock-public-api.mjs

# 2. terminál
API_INTERNAL_URL=http://localhost:3101/api/v1 NEXT_PUBLIC_API_URL=http://localhost:3101/api/v1 pnpm --filter @fkknv/web dev
```
