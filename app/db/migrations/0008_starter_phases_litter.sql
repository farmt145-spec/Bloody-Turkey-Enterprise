-- 0008: 3 receptury na pierwsze 3 tygodnie + ścielenie w belach
-- Nowa siatka faz: Prestarter 0–7 | Starter 1: 8–14 | Starter 2: 15–21 | Grower I: 22–56 | reszta bez zmian.
-- Idempotentna — bezpieczna przy wielokrotnym starcie serwera.

-- Ścielenie: liczba bel i rozmiar beli (duplikat kolumny = pomijany przez runner)
ALTER TABLE litter ADD COLUMN balesCount INT NULL;
--> statement-breakpoint
ALTER TABLE litter ADD COLUMN baleKg DECIMAL(8,1) NULL;
--> statement-breakpoint
-- Fazy: stary "starter" (15–28 d) staje się Starter 2 (15–21 d)
UPDATE genetic_line_norms SET phaseKey = 'starter2', dayFrom = 15, dayTo = 21 WHERE phaseKey = 'starter';
--> statement-breakpoint
-- Prestarter kurczy się do pierwszego tygodnia (0–7)
UPDATE genetic_line_norms SET dayFrom = 0, dayTo = 7 WHERE phaseKey = 'prestarter';
--> statement-breakpoint
-- Grower I przejmuje resztę starego zakresu (22–56)
UPDATE genetic_line_norms SET dayFrom = 22, dayTo = 56 WHERE phaseKey = 'grower1';
--> statement-breakpoint
-- Starter 1 (8–14 d) — klon wartości prestartera danej linii (do edycji w Strukturze)
INSERT INTO genetic_line_norms (geneticLineId, phaseKey, dayFrom, dayTo, proteinPct, energyKcal, lysinePct, methioninePct, feedPerBirdG, targetWeightG)
SELECT p.geneticLineId, 'starter1', 8, 14, p.proteinPct, p.energyKcal, p.lysinePct, p.methioninePct, p.feedPerBirdG, p.targetWeightG
FROM genetic_line_norms p
WHERE p.phaseKey = 'prestarter'
  AND NOT EXISTS (SELECT 1 FROM genetic_line_norms x WHERE x.geneticLineId = p.geneticLineId AND x.phaseKey = 'starter1');
