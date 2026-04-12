-- Fix: old "Песочные Часы Времени" (retry_quest) still in DB after rename to "Песочные Часы Стойкости" (team_dmg_reduce)
-- The upsert-by-name created a duplicate instead of updating. This migration:
--   1. Moves any hero_artifacts from the old artifact to the new one
--   2. Deletes the orphaned old artifact row

BEGIN;

-- Step 1: Move hero_artifacts referencing the old artifact to the new one
UPDATE hero_artifacts
SET    artifact_id = new.id
FROM   artifacts old, artifacts new
WHERE  old.name = 'Песочные Часы Времени'
  AND  new.name = 'Песочные Часы Стойкости'
  AND  hero_artifacts.artifact_id = old.id;

-- Step 2: Delete the orphaned old artifact (no hero_artifacts point to it now)
DELETE FROM artifacts WHERE name = 'Песочные Часы Времени';

COMMIT;
