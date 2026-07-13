# 06 — Bezpečnosť a GDPR

Portál spracúva **osobné údaje detí** a finančné údaje rodín — ochrana údajov je požiadavka prvej triedy, nie doplnok.

## 1. GDPR

- **Právny základ:** plnenie zmluvy (členstvo v klube) + súhlasy pre nadštandard (fotografie, marketing). Súhlasy sa zbierajú v registračnom formulári, sú verzované a kedykoľvek odvolateľné v profile.
- **Deti:** za dieťa koná rodič/zákonný zástupca — účet dieťaťa (U15+) vytvára a schvaľuje rodič.
- **Minimalizácia:** zbierame len údaje potrebné pre chod klubu (registrácia vo zväze, zdravotné poznámky len nevyhnutné pre trénera).
- **Práva dotknutých osôb:** export vlastných údajov (JSON/PDF) a žiadosť o výmaz priamo z profilu; výmaz anonymizuje člena, ale zachová účtovné záznamy (zákonná archivácia).
- **Retencia:** dáta neaktívnych členov sa po definovanej dobe (napr. 2 roky po ukončení členstva) anonymizujú; účtovné dáta podľa zákona (10 rokov).
- **Dokumenty:** privacy policy a podmienky na fkknv.sk; záznam o spracovateľských činnostiach pre klub; zmluvy o spracúvaní s poskytovateľmi (hosting, e-mail).
- **Umiestnenie dát:** EÚ región pre všetky služby (VPS, S3, e-mail).

## 2. Aplikačná bezpečnosť

- **Autentifikácia:** bcrypt/argon2 hash hesiel, rate-limit na login, JWT s krátkou platnosťou + rotované refresh tokeny, magic linky jednorazové s expiráciou.
- **Autorizácia:** každý endpoint vynucuje rolu + scope (kategória / vlastné deti) na úrovni API — nikdy len v UI. Testy oprávnení sú súčasťou CI.
- **Citlivé dáta:** zdravotné poznámky viditeľné len trénerom danej kategórie a vedeniu; bankové dáta len ADMIN/MANAGER.
- **Audit log:** zmeny financií, členov a rolí sa logujú (kto, kedy, čo).
- **Transport a infra:** všade TLS (Caddy, HSTS), DB a Redis neprístupné z internetu (len docker sieť), secrets mimo repozitára (env/secret manager), pravidelné aktualizácie závislostí (Renovate/Dependabot).
- **Vstupy:** validácia Zod schémami na API aj klientoch, ochrana proti XSS/CSRF (Next.js + httpOnly cookies), parametrizované dotazy (Prisma).
- **Mobil:** tokeny v SecureStore/Keychain, certifikátne pripnutie voliteľne, žiadne citlivé dáta v logoch.

## 3. Zálohovanie a obnova

- Denné automatické zálohy PostgreSQL (pg_dump + WAL) na iné úložisko (S3, iný región), retencia 30 dní.
- Zálohy S3 bucketu (dokumenty, potvrdenia) verzovaním.
- Otestovaný postup obnovy (restore drill raz za polrok), cieľ RPO 24 h / RTO 4 h — pre klub postačujúce.

## 4. Prevádzková bezpečnosť

- Monitoring chýb (Sentry) a dostupnosti (uptime check na fkknv.sk a api.fkknv.sk).
- Oddelené prostredia: `staging` (testovacie dáta) a `production` — nikdy sa nemiešajú.
- Prístup na server len cez SSH kľúče, 2FA na GitHub, Google Play aj App Store Connect účtoch klubu.
