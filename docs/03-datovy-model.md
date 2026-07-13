# 03 — Dátový model

Návrh hlavných entít (Prisma/PostgreSQL). Názvy stĺpcov orientačné — finálna schéma vznikne vo Fáze 1.

## 1. Používatelia, členovia a roly

```
User            – účet na prihlásenie
  id, email, phone, passwordHash, locale, notificationPrefs, createdAt

Role            – ADMIN | MANAGER | COACH | PLAYER | PARENT
UserRole        – user ↔ rola, voliteľne scope na kategóriu (COACH/MANAGER)
  userId, role, teamCategoryId?

Member          – člen klubu (hráč) — existuje aj bez User účtu (malé deti)
  id, firstName, lastName, birthDate, gender,
  futbalnetId?, registrationNumber?, photoUrl?,
  healthNotes?, equipmentSizes?, status (ACTIVE|INACTIVE|GUEST),
  userId?          – vyplnené, ak má hráč vlastný login (starší)

Guardian        – väzba rodič/zástupca ↔ dieťa
  userId (rodič), memberId (dieťa), relation (MOTHER|FATHER|GUARDIAN)

RegistrationRequest – online prihláška nového člena
  id, dáta z formulára (JSON + normalizované polia), consents,
  status (PENDING|APPROVED|REJECTED), reviewedBy?, createdAt
```

## 2. Sezóny a kategórie

```
Season          – sezóna klubu
  id, name ("2026/2027"), startDate (2026-07-01), endDate (2027-06-30), isActive

TeamCategory    – kategória (U8 … U19, MUZI); číselník klubu
  id, code ("U11"), name, sortOrder

CategoryRule    – pravidlo zaradenia podľa ročníka pre danú sezónu
  seasonId, teamCategoryId, birthYearFrom, birthYearTo

TeamMembership  – zaradenie hráča do kategórie v sezóne
  memberId, seasonId, teamCategoryId,
  isException (manuálne preradenie, napr. hráva za vyššiu kategóriu),
  joinedAt, leftAt?
```

**Logika:** pri štarte sezóny job podľa `CategoryRule` a `birthDate` navrhne `TeamMembership` pre všetkých aktívnych členov; vedúci potvrdí / upraví výnimky.

## 3. Financie

```
FeePlan         – predpis poplatku pre skupinu
  id, seasonId, teamCategoryId?, name ("Členské mesačné"),
  amount, currency, period (MONTHLY|QUARTERLY|ONE_TIME|SEASON),
  dueDay, activeFrom, activeTo

FeeAssignment   – priradenie predpisu členovi (s možnou individuálnou sumou)
  feePlanId, memberId, overrideAmount?, discountReason?, active

PaymentObligation – konkrétna vygenerovaná povinnosť (mesiac × člen)
  id, feeAssignmentId, memberId, periodLabel ("2026-09"),
  amount, variableSymbol, dueDate,
  status (PENDING|PAID|PARTIAL|OVERDUE|WAIVED), paidAmount, qrPayload

BankTransaction – pohyb z banky (import/API)
  id, source (CAMT|CSV|API), externalId, date, amount, currency,
  variableSymbol?, counterpartyIban?, counterpartyName?, message?,
  matchStatus (UNMATCHED|MATCHED|IGNORED|MANUAL)

PaymentMatch    – spárovanie pohybu s povinnosťou (M:N kvôli súhrnným platbám)
  bankTransactionId, paymentObligationId, amount, matchedBy (AUTO|MANUAL), matchedAt

DunningNotice   – odoslaná upomienka
  paymentObligationId, sentAt, channel (PUSH|EMAIL), level (1|2|3)
```

**Párovanie:** job páruje `BankTransaction` → `PaymentObligation` podľa VS + sumy; jeden pohyb môže pokryť viac povinností (rodič platí za 3 mesiace / 2 deti naraz).

## 4. Udalosti, dochádzka, zápasy

```
Event           – spoločný základ udalostí kalendára
  id, type (TRAINING|MATCH|TOURNAMENT|CLUB_EVENT),
  seasonId, teamCategoryId?, title, startAt, endAt?, location,
  source (INTERNAL|FUTBALNET), futbalnetId?,
  recurrenceRule? (opakované tréningy), createdBy

Attendance      – dochádzka na udalosť
  eventId, memberId,
  status (PRESENT|ABSENT|EXCUSED|INJURED|UNKNOWN),
  rsvp (GOING|NOT_GOING|NO_REPLY)   – potvrdenie účasti vopred rodičom/hráčom,
  markedBy, markedAt

Match           – rozšírenie Eventu typu MATCH/TOURNAMENT
  eventId, opponent, isHome, competition?,
  scoreUs?, scoreThem?, state (PLANNED|LIVE|FINISHED|CANCELLED)

MatchNomination – nominácia hráča na zápas
  matchId, memberId, status (NOMINATED|CONFIRMED|DECLINED|REMOVED),
  shirtNumber?, isStarting?

MatchEvent      – udalosť počas zápasu (živý zápis s minutážou)
  id, matchId, minute, type (GOAL|ASSIST|SUB_IN|SUB_OUT|YELLOW|RED|NOTE|GOAL_CONCEDED),
  memberId?, relatedMemberId? (asistencia/striedanie), note?, createdBy, createdAt
```

**Živý zápis:** `MatchEvent` je append-only log — v appke tréner klikaním pridáva góly/striedania s minútou; skóre a štatistiky hráčov (góly, minutáž) sa z logu dopočítavajú. Offline zápis sa synchronizuje po pripojení (idempotentné klientske UUID).

## 5. Komunikácia

```
Channel         – komunikačný kanál/skupina
  id, type (CATEGORY|COACHES|BOARD|ANNOUNCEMENT|DIRECT),
  teamCategoryId?, name

ChannelMember   – členstvo v kanáli (automaticky z TeamMembership + Guardian,
                  manuálne pre ostatné typy)
  channelId, userId, role (MEMBER|MODERATOR), muted

Message         – správa
  id, channelId, senderId, body, attachments?, createdAt, editedAt?

MessageReceipt  – doručenie/prečítanie (pre oznamy s potvrdením)
  messageId, userId, deliveredAt, readAt?

Broadcast       – hromadná správa s filtrom
  id, senderId, filter (JSON: kategórie, roly, stav platieb…),
  body, channels (PUSH|EMAIL|CHAT), sentAt
```

**Automatika skupín:** kanál kategórie = všetci rodičia a hráči (U15+) danej kategórie + jej tréneri; členstvo sa preváži pri zmene `TeamMembership` na novú sezónu.

## 6. Reporty a dokumenty

```
GeneratedDocument – vygenerované PDF/XLSX
  id, type (SPORT_ALLOWANCE|PAYMENTS_REPORT|ATTENDANCE_REPORT|MEMBERS_EXPORT|…),
  params (JSON: obdobie, kategória…), requestedBy, fileUrl, createdAt

AuditLog        – kto, kedy, čo zmenil (financie, členovia, roly)
  id, userId, action, entity, entityId, diff (JSON), createdAt
```

**Športový príspevok:** rodič zvolí dieťa + obdobie → server z `PaymentMatch`/`PaymentObligation` vygeneruje PDF potvrdenie s hlavičkou klubu (uložené v S3, dostupné na stiahnutie).

## 7. Vzťahový diagram (zjednodušene)

```
User ─┬─ UserRole ── TeamCategory
      ├─ Guardian ── Member ─┬─ TeamMembership ── TeamCategory / Season
      │                      ├─ FeeAssignment ── FeePlan
      │                      │      └─ PaymentObligation ── PaymentMatch ── BankTransaction
      │                      ├─ Attendance ── Event
      │                      └─ MatchNomination / MatchEvent ── Match ── Event
      └─ ChannelMember ── Channel ── Message
```
