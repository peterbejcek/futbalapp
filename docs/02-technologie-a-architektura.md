# 02 — Technológie a architektúra

## 1. Zhrnutie odporúčaného stacku

| Vrstva | Technológia | Zdôvodnenie |
|---|---|---|
| Web portál | **Next.js 15 (React, TypeScript)** | SSR pre verejné stránky (registrácia, info), SPA komfort pre portál; jednoduchý deploy |
| Mobil (Android + iOS) | **React Native + Expo** | Jeden kód pre obe platformy, zdieľanie logiky a typov s webom, OTA aktualizácie (EAS Update), push notifikácie bez vlastnej infra |
| Backend API | **NestJS (Node.js, TypeScript)** | Štruktúrovaný framework (moduly, DI, guards) vhodný na roly/oprávnenia; jeden jazyk v celom projekte |
| Databáza | **PostgreSQL 16** | Relačné dáta (členovia, platby, dochádzka), spoľahlivé, lacná prevádzka |
| ORM | **Prisma** | Typovo bezpečný prístup k DB, migrácie, zdieľané typy do frontendov |
| Fronty / cache | **Redis + BullMQ** | Naplánované úlohy: párovanie banky, notifikácie o nezaplatení, sync futbalnetu, generovanie reportov |
| Realtime | **WebSocket (Socket.io)** cez NestJS gateway | Chat a živý zápis zápasu |
| Súbory | S3-kompatibilné úložisko (Cloudflare R2 / MinIO) | Fotky, prílohy, vygenerované PDF |
| Push notifikácie | **Expo Push** (FCM + APNs) | Jednotné API pre Android aj iOS |
| E-maily | Resend / SMTP | Notifikácie, záložný kanál, reporty |
| Monorepo | **Turborepo + pnpm** | Zdieľané balíky (typy, API klient, doménová logika, dizajn tokeny) |
| API kontrakt | REST + **OpenAPI** (generovaný z NestJS), typovaný klient pre web/mobil | Jeden kontrakt pre obe klientske aplikácie |

**Princíp:** celý projekt v **TypeScripte** — jeden jazyk, zdieľané typy a validácie (Zod) medzi backendom, webom a mobilom. To je pre malý tím najlacnejšie na vývoj aj údržbu.

### Zvažované alternatívy (a prečo nie)

- **Flutter** — dobrá alternatíva pre mobil, ale nezdieľa kód s webom a pridáva druhý jazyk (Dart). React Native + Expo umožní zdieľať 60 – 80 % logiky s webom.
- **Supabase/Firebase ako celý backend** — rýchly štart, ale párovanie banky, sezónna logika kategórií a zápis zápasu vyžadujú netriviálnu serverovú logiku; vlastné NestJS API je dlhodobo čistejšie. (Supabase možno použiť ako managed Postgres.)
- **Natívny vývoj (Kotlin + Swift)** — dvojnásobné náklady na vývoj a údržbu, pre klubovú aplikáciu zbytočné.

## 2. Architektúra systému

```
                        ┌──────────────────────────┐
                        │        fkknv.sk          │
        ┌───────────┐   │  Next.js web portál      │
        │  Rodič /  │──▶│  (verejný web +          │
        │  hráč /   │   │   prihlásená zóna)       │
        │  tréner / │   └────────────┬─────────────┘
        │  vedenie  │                │ HTTPS (REST + WS)
        └─────┬─────┘   ┌────────────▼─────────────┐
              │         │   api.fkknv.sk           │
              └────────▶│   NestJS API             │
   mobilná app          │  - Auth (JWT, roly)      │
  (Expo RN,             │  - moduly domény         │
   Android + iOS)       │  - WebSocket gateway     │
                        │  - OpenAPI               │
                        └──┬───────┬───────┬───────┘
                           │       │       │
                 ┌─────────▼──┐ ┌──▼────┐ ┌▼──────────────┐
                 │ PostgreSQL │ │ Redis │ │ S3 (R2/MinIO) │
                 │  (Prisma)  │ │BullMQ │ │ súbory, PDF   │
                 └────────────┘ └──┬────┘ └───────────────┘
                                   │  naplánované joby
              ┌────────────────────┼─────────────────────┐
              │                    │                     │
      ┌───────▼───────┐   ┌────────▼────────┐   ┌────────▼───────┐
      │ Banka         │   │ futbalnet.sk    │   │ Notifikácie    │
      │ import výpisov│   │ sync zápasov a  │   │ Expo Push,     │
      │ + párovanie VS│   │ súpisiek        │   │ e-mail (Resend)│
      └───────────────┘   └─────────────────┘   └────────────────┘
```

## 3. Kľúčové integrácie

### 3.1 Banka — párovanie platieb
Postupná stratégia (od najjednoduchšej po najpohodlnejšiu):

1. **Fáza 1 — import výpisov:** admin nahrá výpis (CAMT.053 XML / CSV z internet bankingu), systém spáruje pohyby s predpismi podľa **variabilného symbolu** a sumy. Nespárované → manuálna fronta.
2. **Fáza 2 — automatický prísun dát:** podľa banky klubu buď e-mailové notifikácie o pohyboch (parsovanie), alebo **PSD2 AIS API** cez agregátora (napr. Nordigen/GoCardless Bank Account Data — pre AIS bez licencie, zadarmo pre malé objemy). Denný job stiahne pohyby a spáruje.
3. **QR platby:** predpis platby obsahuje PAY by square QR kód s VS — minimalizuje preklepy a nespárované platby.

### 3.2 futbalnet.sk
Futbalnet (sportnet.online) nemá verejne garantované API — preto:

- **Import súpisiek** pri zakladaní databázy hráčov (jednorazovo, s manuálnou kontrolou; ak nebude technicky schodné, CSV šablóna na hromadný import).
- **Sync plánu zápasov** per kategória: naplánovaný job číta verejné stránky súťaží (parsovanie), ukladá zápasy ako `EXTERNAL` udalosti do kalendára. Každý import je idempotentný (kľúč = ID zápasu vo futbalnete) a manuálne editovateľný.
- Architektúrne oddelené v module `integrations/futbalnet` — ak sa zmení štruktúra stránok alebo pribudne API, mení sa len adaptér.

### 3.3 Notifikácie
- **Expo Push** pre mobil (FCM/APNs), **web push** voliteľne neskôr.
- E-mail ako záložný/paralelný kanál (nastaviteľné per používateľ).
- Notifikačné typy: nezaplatené členské (D+X po splatnosti, opakovanie), nový zápas/nominácia, zmena/zrušenie tréningu, nová správa v skupine, oznam klubu.

## 4. Autentifikácia a autorizácia

- **Auth:** e-mail + heslo, magic link pre rodičov (nízka bariéra), voliteľne Google/Apple Sign-In (Apple povinný pri App Store, ak je iný sociálny login). JWT access + refresh tokeny.
- **Autorizácia:** RBAC — roly (`ADMIN`, `MANAGER`, `COACH`, `PLAYER`, `PARENT`) + **scope na kategórie** (tréner U11 vidí len U11). Rodič má prístup k dátam len svojich detí.
- Účty detí: mladší hráči nemusia mať vlastný účet (všetko rieši rodič), starší (napr. U15+) môžu dostať vlastný login s obmedzeným rozsahom.

## 5. Dizajn

- Dizajn tokeny (farby, typografia, logo) odvodené z webu klubu — zelená/biela identita FK Košická Nová Ves; uložené v zdieľanom balíku `packages/ui-tokens`, používané webom aj mobilom.
- Web: Tailwind CSS + komponentová knižnica (shadcn/ui) prefarbená klubovými tokenmi.
- Mobil: rovnaké tokeny, natívne pôsobiace komponenty (React Native Paper alebo vlastné).
- Svetlý aj tmavý režim.

## 6. Prevádzka a nasadenie

| Časť | Riešenie |
|---|---|
| Doména | `fkknv.sk` (web), `api.fkknv.sk` (API), `admin` je súčasť webu podľa roly |
| Hosting | **1 VPS (napr. Hetzner) + Docker Compose**: API, Postgres, Redis, Caddy (TLS). Web na **Vercel** (alebo tiež na VPS). Nízke fixné náklady (~10 – 20 €/mes.) |
| CI/CD | GitHub Actions: lint + testy + build; deploy API cez Docker image, web cez Vercel, mobil cez **EAS Build/Submit** |
| Mobil distribúcia | Google Play + Apple App Store (vývojárske účty klubu: 25 USD jednorazovo / 99 USD ročne); interné testovanie cez TestFlight a Google Play internal track; drobné opravy cez EAS Update bez re-submitu |
| Monitoring | Sentry (web, mobil, API), uptime monitoring, denné zálohy DB (pozri doc 06) |
