# 04 — Štruktúra projektu (monorepo)

Turborepo + pnpm workspaces. Jeden repozitár pre backend, web, mobil a zdieľané balíky.

```
futbalapp/
├── apps/
│   ├── api/                        # NestJS backend (api.fkknv.sk)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # login, JWT, magic link, RBAC guards
│   │   │   │   ├── users/          # účty, roly, notifikačné preferencie
│   │   │   │   ├── members/        # členovia, rodičia (Guardian), profily
│   │   │   │   ├── registration/   # online prihlášky + schvaľovací workflow
│   │   │   │   ├── seasons/        # sezóny, kategórie, CategoryRule,
│   │   │   │   │                   #   automatické zaradenie hráčov
│   │   │   │   ├── finance/        # FeePlan, predpisy, VS, QR (PAY by square)
│   │   │   │   ├── banking/        # import výpisov, párovanie, manuálna fronta
│   │   │   │   ├── dunning/        # upomienky pri nezaplatení (joby)
│   │   │   │   ├── events/         # kalendár, tréningy, opakovanie
│   │   │   │   ├── attendance/     # dochádzka + RSVP
│   │   │   │   ├── matches/        # zápasy, nominácie, MatchEvent (živý zápis)
│   │   │   │   ├── chat/           # kanály, správy, WebSocket gateway
│   │   │   │   ├── notifications/  # push (Expo), e-mail; šablóny
│   │   │   │   ├── reports/        # exporty XLSX/PDF, športový príspevok
│   │   │   │   └── stats/          # agregované štatistiky pre dashboard
│   │   │   ├── integrations/
│   │   │   │   ├── futbalnet/      # adaptér: sync zápasov a súpisiek
│   │   │   │   └── bank/           # adaptéry: CAMT/CSV parser, PSD2 agregátor
│   │   │   ├── jobs/               # BullMQ definície (sync, párovanie, upomienky)
│   │   │   └── common/             # guards, interceptory, filtre, config
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts             # číselníky, kategórie, demo dáta
│   │   └── test/
│   │
│   ├── web/                        # Next.js portál (fkknv.sk)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/       # verejný web: úvod, registrácia člena
│   │   │   │   ├── (portal)/       # prihlásená zóna
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── members/
│   │   │   │   │   ├── finance/    # platby, párovanie, dlžníci
│   │   │   │   │   ├── calendar/
│   │   │   │   │   ├── attendance/
│   │   │   │   │   ├── matches/
│   │   │   │   │   ├── chat/
│   │   │   │   │   ├── reports/
│   │   │   │   │   └── settings/   # sezóny, kategórie, poplatky, roly
│   │   │   │   └── api/            # len BFF drobnosti (auth callbacky)
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── e2e/                    # Playwright testy
│   │
│   └── mobile/                     # Expo React Native (Android + iOS)
│       ├── app/                    # expo-router obrazovky
│       │   ├── (tabs)/
│       │   │   ├── index.tsx       # dashboard podľa roly
│       │   │   ├── calendar.tsx
│       │   │   ├── chat.tsx
│       │   │   └── profile.tsx
│       │   ├── attendance/[eventId].tsx   # odklikanie dochádzky
│       │   ├── match/[id]/
│       │   │   ├── nomination.tsx  # nominácia hráčov
│       │   │   └── live.tsx        # živý zápis: góly, minutáž, striedania
│       │   └── payments/           # stav platieb, QR, potvrdenia
│       ├── src/
│       │   ├── offline/            # lokálna queue + synchronizácia
│       │   └── notifications/      # registrácia Expo push tokenov
│       ├── app.json / eas.json     # Expo + EAS Build konfigurácia
│       └── assets/                 # ikony, splash v klubových farbách
│
├── packages/
│   ├── shared/                     # doménové typy, Zod schémy, enums,
│   │                               #   výpočet kategórie z dátumu narodenia,
│   │                               #   generovanie VS, PAY by square payload
│   ├── api-client/                 # typovaný klient generovaný z OpenAPI
│   │                               #   (používa web aj mobil)
│   ├── ui-tokens/                  # klubové farby, typografia, spacing
│   └── config/                     # zdieľané eslint/tsconfig/prettier
│
├── infra/
│   ├── docker-compose.yml          # api + postgres + redis + caddy (VPS)
│   ├── Dockerfile.api
│   └── caddy/Caddyfile             # TLS, domény fkknv.sk / api.fkknv.sk
│
├── .github/workflows/
│   ├── ci.yml                      # lint, typecheck, testy, build
│   ├── deploy-api.yml              # build + deploy Docker image na VPS
│   └── mobile-build.yml            # EAS build/submit (manuálny trigger)
│
├── docs/                           # táto dokumentácia
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Zásady

- **Zdieľanie logiky:** všetko, čo potrebuje web aj mobil (typy, validácie, výpočet kategórie, formátovanie), žije v `packages/shared` — nikdy sa neduplikuje.
- **API kontrakt ako zdroj pravdy:** NestJS generuje OpenAPI → `packages/api-client` sa generuje automaticky; zmena API bez úpravy klientov neprejde CI.
- **Integrácie za adaptérmi:** futbalnet a banka sú izolované v `integrations/` s vlastnými rozhraniami — zmena externého systému nezasiahne doménu.
- **Offline-first tam, kde treba:** dochádzka a živý zápis zápasu v mobile zapisujú do lokálnej queue (SQLite/AsyncStorage) a synchronizujú sa idempotentne.
