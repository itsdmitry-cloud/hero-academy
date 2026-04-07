-- ═══════════════════════════════════════════════════════════════
-- Migration: Convert XP system from reset-on-level-up to cumulative
-- 
-- WHAT THIS DOES:
-- 1. Recalculates total XP for each hero based on their current level + xp
-- 2. Updates xp_to_next to the cumulative threshold for the next level
--
-- FORMULA:
-- cumulativeXpForLevel(L) = (L-1) * (1000 + 250*L)
-- xp_to_next = L * (1000 + 250*(L+1))
--
-- SAFE TO RUN: This is idempotent if heroes already have cumulative XP.
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Add totalXp = cumulativeForCurrentLevel + currentXp
UPDATE heroes SET
  xp = ((level - 1) * (1000 + 250 * level)) + xp,
  xp_to_next = level * (1000 + 250 * (level + 1));

-- Verify: check a few heroes
-- SELECT id, name, level, xp, xp_to_next,
--   (level - 1) * (1000 + 250 * level) as floor_xp
-- FROM heroes ORDER BY level DESC LIMIT 10;
