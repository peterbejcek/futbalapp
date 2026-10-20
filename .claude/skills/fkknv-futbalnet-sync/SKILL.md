---
name: fkknv-futbalnet-sync
description: Napojenie portálu FKKNV na futbalnet/sportnet.sme.sk — import rozpisu zápasov družstva a večerná kontrola výsledku a strelcov. Použi pri úpravách importu, parsera sportnetu alebo synchronizácie výsledkov.
---

# Futbalnet / sportnet

Kód: `apps/api/src/integrations/futbalnet/`. Žiadne oficiálne API — sťahujeme verejné HTML stránky `sportnet.sme.sk` (Next.js SSR, dáta v RSC payloade s `\"`), `fetch` s `User-Agent: Mozilla/5.0 (fkknv.sk portal)`. Pri zmene štruktúry stránok upravuj len parsery.

## Rozpis zápasov (existujúce)
- Per družstvo v Nastaveniach: `Team.sportnetProgramUrl` + `Team.sportnetTeamName` (presný názov tímu na sportnete).
- `FutbalnetService.importTeamProgram` (cron pondelok 4:00 pre všetky družstvá) → `sportnet.parser.ts` vytiahne ID zápasu, dvojicu tímov, dátum, logá. Udalosť sa vytvára idempotentne s `Event.futbalnetId = "sn:<id>"` (ID prežije zmenu termínu), čas cez `toBratislavaWallClock`.

## Kontrola výsledku a strelcov (večer o 20:00)
- `MatchSyncService` (`match-sync.service.ts`): `@Cron('0 20 * * *', { timeZone: 'Europe/Bratislava' })` — zápasy dňa s `futbalnetId` začínajúcim `sn:` alebo s `Match.sportnetUrl`.
- URL zápasu: `https://sportnet.sme.sk/futbalnet/z/<appSpace>/zapas/<id>/` — appSpace MUSÍ sedieť so súťažou zápasu (inak 404; U13A hrá `vsfz`, iné družstvá napr. `mfz-kosice`). Import rozpisu ukladá celý odkaz do `Match.sportnetUrl` (appSpace z fixture). Ak chýba, sync skúša kandidátov: uložený odkaz → appSpace z programov všetkých družstiev → `vsfz`, a funkčný uloží.
- `sportnet-match.parser.ts` číta z protokolu skóre, tímy a gólové udalosti (hráč, tím, minúta). `match-sync.plan.ts` (čistá funkcia, testovaná) porovná so zapísanými `MatchEvent` a vráti plán: futbalnet je zdroj pravdy pre skóre a strelcov; strelci sa párujú podľa mena (bez diakritiky, na poradí nezáleží) v súpiske/nomináciách; ak zoznam strelcov nie je úplný, upraví sa len počet gólov; minúty zapísaných gólov sa nemenia; zápas sa označí ako ukončený.
- Priebeh sa importuje až po termíne ukončenia zápasu (`endAt`, inak začiatok + 2×polčas + 15 min; porovnanie v bratislavskom nástennom čase). Pred tým sync len oznámi, že zápas ešte neskončil (nič nemení). Netreba klikať na Začať/Ukončiť — sync nastaví zápas ako ukončený. Tlačidlo „Skontrolovať teraz" je v karte Priebeh zápasu vždy (aj v stave PLANNED), pred výkopom slúži na prepojenie zápasu odkazom.
- Každá kontrola sa zapisuje do `MatchSyncLog` (čo sa upravilo) a zobrazuje v detaile zápasu („Kontrola s futbalnetom"). Cron loguje len zmeny/chyby.
- Ručne: `POST /matches/:id/futbalnet-sync` (ADMIN/MANAGER/COACH svojho družstva), voliteľne `{ url }` — zápas sa nalinkuje a over sa zhoda súpera. V UI tlačidlo „Skontrolovať teraz".
- Testovací zápas: Janočko Academy B – FK KNV U13A (18. 10. 2026), `https://sportnet.sme.sk/futbalnet/z/vsfz/zapas/6a5df7f4705f8e9a4941ee5d/` (6:0, 6 gólov domácich).
- Nie je pokryté: karty a striedania; posun termínu pri importe programu neposiela e-mail.
