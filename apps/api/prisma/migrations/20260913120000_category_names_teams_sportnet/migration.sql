-- Oprava názvov vekových kategórií (boli posunuté o stupeň)
UPDATE "TeamCategory" SET name = 'Prípravka U11'     WHERE code = 'U11';
UPDATE "TeamCategory" SET name = 'Mladší žiaci U13'  WHERE code = 'U13';
UPDATE "TeamCategory" SET name = 'Starší žiaci U15'  WHERE code = 'U15';
UPDATE "TeamCategory" SET name = 'Mladší dorast U17' WHERE code = 'U17';

-- Per-družstvo URL súťaže pre sekciu Tabuľka (nezávislé od sportnetProgramUrl pre import)
ALTER TABLE "Team" ADD COLUMN "sportnetUrl" TEXT;

-- Premenovanie hlavného družstva U13/U15 (pomenované len kódom) na variant „A"
-- vrátane názvov jeho podkanálov („U13 · Oznamy" → „U13 A · Oznamy").
UPDATE "Channel" SET name = 'U13 A' || substring(name from 4)
  WHERE name LIKE 'U13 · %'
    AND "teamId" IN (SELECT t.id FROM "Team" t JOIN "TeamCategory" c ON c.id = t."teamCategoryId"
                     WHERE c.code = 'U13' AND t.name = 'U13');
UPDATE "Team" t SET name = 'U13 A' FROM "TeamCategory" c
  WHERE c.id = t."teamCategoryId" AND c.code = 'U13' AND t.name = 'U13';

UPDATE "Channel" SET name = 'U15 A' || substring(name from 4)
  WHERE name LIKE 'U15 · %'
    AND "teamId" IN (SELECT t.id FROM "Team" t JOIN "TeamCategory" c ON c.id = t."teamCategoryId"
                     WHERE c.code = 'U15' AND t.name = 'U15');
UPDATE "Team" t SET name = 'U15 A' FROM "TeamCategory" c
  WHERE c.id = t."teamCategoryId" AND c.code = 'U15' AND t.name = 'U15';

-- Doplnenie B družstiev (ak ešte nie sú)
INSERT INTO "Team" (id, "teamCategoryId", name, "sortOrder")
SELECT gen_random_uuid()::text, c.id, 'U13 B', 1 FROM "TeamCategory" c
WHERE c.code = 'U13'
  AND NOT EXISTS (SELECT 1 FROM "Team" t WHERE t."teamCategoryId" = c.id AND t.name = 'U13 B');

INSERT INTO "Team" (id, "teamCategoryId", name, "sortOrder")
SELECT gen_random_uuid()::text, c.id, 'U15 B', 1 FROM "TeamCategory" c
WHERE c.code = 'U15'
  AND NOT EXISTS (SELECT 1 FROM "Team" t WHERE t."teamCategoryId" = c.id AND t.name = 'U15 B');

-- Podkanály (Oznamy/Tréningy/Všeobecné) pre novo pridané B družstvá, ak chýbajú
INSERT INTO "Channel" (id, kind, "teamId", name)
SELECT gen_random_uuid()::text, k.kind::"ChannelKind", t.id, t.name || k.suffix
FROM "Team" t
JOIN "TeamCategory" c ON c.id = t."teamCategoryId"
CROSS JOIN (VALUES
  ('TEAM_ANNOUNCEMENTS', ' · Oznamy'),
  ('TEAM_TRAINING', ' · Tréningy'),
  ('TEAM_GENERAL', ' · Všeobecné')
) AS k(kind, suffix)
WHERE ((c.code = 'U13' AND t.name = 'U13 B') OR (c.code = 'U15' AND t.name = 'U15 B'))
  AND NOT EXISTS (SELECT 1 FROM "Channel" ch WHERE ch."teamId" = t.id AND ch.kind = k.kind::"ChannelKind");
