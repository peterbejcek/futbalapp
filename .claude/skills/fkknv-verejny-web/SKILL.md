---
name: fkknv-verejny-web
description: Verejný web fkknv.sk (mužstvá, kalendár, klub, novinky, galéria) a jeho vzťah k portálu — súhlasy, čo sa zverejňuje, verejné API a SEO. Použi pri úpravách verejného webu alebo verejného API.
---

# Verejný web

Kód: web `apps/web/src/app/(verejne)/*` + `components/verejne/*` + `lib/verejne/*`; API `apps/api/src/public/*` (`/api/v1/public/*`, mapper `public.mapper.ts`), kontrakt DTO v `packages/shared/src/public-api.ts`; správa obsahu v portáli `/portal/obsah`, `/portal/clanky`; obsah klubu `apps/api/src/club-content`.

## Pravidlá zverejňovania
- Hráč je verejný len so súhlasom (profil/fotka); tréning len s `Event.isPublic`; zápasy a turnaje vždy; ostatné typy udalostí nikdy; nový obsah je koncept, kým ho klub nepublikuje.
- Pri novom poli v udalosti/zápase doplň `PublicEventDto`/mapper a test v `public.service.test.ts`.
- `/portal` a `/prihlasenie` nie sú v sitemap a majú noindex. Pôvodná úvodná stránka portálu je na `/klubovy-portal`.
- Mapa/adresa na verejnom webe: `PublicMap`; ICS export `kalendar/[id]/ics`.

Dokumenty: `docs/11-obsah-webu-na-potvrdenie.md` (obsah na potvrdenie klubom), `docs/12-nasadenie-verejneho-webu.md` (nasadenie, importér obsahu, kontrola).
