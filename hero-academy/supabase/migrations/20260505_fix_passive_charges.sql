-- Fix passive artifacts that were inserted with charges_remaining=1
-- due to a bug in lootbox/drop insert paths (`max_charges > 0 ? max_charges : 1`).
-- Passive artifacts with max_charges=0 should never have charges shown.
-- This migration cleans up existing rows. Source code already fixed to write 0.

UPDATE hero_artifacts ha
SET    charges_remaining = 0
FROM   artifacts a
WHERE  ha.artifact_id = a.id
  AND  a.max_charges = 0
  AND  ha.charges_remaining IS DISTINCT FROM 0;
