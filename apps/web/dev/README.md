# Dev nástroje (mimo `src/`)

`mock-public-api.mjs` je malý node http server, ktorý napodobňuje verejné API portálu (`/api/v1/public/*`)
podľa kontraktu `packages/shared/src/public-api.ts`. Všetky mená a údaje sú FIKTÍVNE; dátumy sú relatívne k dnešku
(odohraný zápas s výsledkom, zrušený zápas, tréningy, mužstvá U13 A, U13 B, U15 A, hráč bez fotky).
Obsah z portálu (ukážka): `GET /pages`, `/pages/:slug` (o-klube PUBLISHED, historia a podpora ARCHIVED, `kontakt` a `zverejnovanie` chýbajú
→ web ukáže „Aktuálne informácie pripravujeme.“, koncept `koncept-stranka` je DRAFT → 404), `GET /people` (publikovaný, archívny; DRAFT sa nevracia),
`GET /documents[?category=]` (publikovaný, archívny, jeden bez `downloadUrl`; DRAFT sa nevracia), `GET /documents/:id/file` (malé testovacie PDF),
články (`/articles`) vrátane jedného archívneho (`isArchive`, `sourceUrl`). CORS je povolený.
Nie je súčasťou aplikácie a nesmie sa importovať zo `src/`.

```bash
# 1. terminál (z koreňa repozitára)
MOCK_PORT=3101 node apps/web/dev/mock-public-api.mjs

# 2. terminál
API_INTERNAL_URL=http://localhost:3101/api/v1 NEXT_PUBLIC_API_URL=http://localhost:3101/api/v1 pnpm --filter @fkknv/web dev
```
