-- Doplní kanál „Hromadný email" každému existujúcemu družstvu.
INSERT INTO "Channel" ("id", "kind", "teamId", "name", "isDemo", "createdAt")
SELECT 'c' || substr(md5(random()::text || t."id"), 1, 24), 'TEAM_EMAIL', t."id", t."name" || ' · Hromadný email', t."isDemo", CURRENT_TIMESTAMP
FROM "Team" t
WHERE NOT EXISTS (SELECT 1 FROM "Channel" c WHERE c."teamId" = t."id" AND c."kind" = 'TEAM_EMAIL');
