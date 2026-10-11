-- Zápas: odkaz na highlighty
ALTER TABLE "Match" ADD COLUMN "highlightsUrl" TEXT;

-- Previerky: doplnenie dĺžky vytrvalostného behu pre staršie záznamy
-- (mladší žiaci U13 = 6 min, starší žiaci U15 = 12 min; zálohou aj podľa názvu kategórie)
UPDATE "FitnessTest" f SET "enduranceMinutes" = CASE
  WHEN c.code = 'U13' OR c.name ILIKE 'Mladší žiaci%' THEN 6
  WHEN c.code = 'U15' OR c.name ILIKE 'Starší žiaci%' THEN 12
END
FROM "Team" t JOIN "TeamCategory" c ON c.id = t."teamCategoryId"
WHERE f."teamId" = t.id AND f."enduranceMinutes" IS NULL
  AND (c.code IN ('U13', 'U15') OR c.name ILIKE 'Mladší žiaci%' OR c.name ILIKE 'Starší žiaci%');
