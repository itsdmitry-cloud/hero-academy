-- =============================================
-- Fix level system: cumulative XP model alignment
-- =============================================
-- Problem: xp_to_next was initialized at 100 but formula requires 1500 for level 2.
-- The DB trigger used a subtraction model while frontend uses cumulative XP.
-- This caused levels to never increase from XP gains.

-- 1. Fix hero creation: set correct initial xp_to_next
--    cumulativeXpForLevel(2) = (2-1) * (1000 + 250*2) = 1500
CREATE OR REPLACE FUNCTION create_hero_for_student()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO heroes (id, user_id, name, gender, level, xp, xp_to_next, hp, hp_max, gold)
    VALUES (
      gen_random_uuid(),
      NEW.id,
      NEW.display_name,
      COALESCE((SELECT raw_user_meta_data->>'gender' FROM auth.users WHERE id = NEW.id), 'male'),
      1, 0, 1500, 100, 100, 0
    );

    INSERT INTO hero_stats (hero_id, strength, knowledge, endurance, luck, wisdom)
    VALUES (
      (SELECT id FROM heroes WHERE user_id = NEW.id),
      10, 10, 10, 10, 10
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Replace DB trigger: use cumulative formula, NEVER subtract XP
--    This is a safety net — the app already handles leveling correctly.
--    Formula: cumulativeXpForLevel(L) = (L-1) * (1000 + 250*L)
CREATE OR REPLACE FUNCTION check_level_up()
RETURNS TRIGGER AS $$
DECLARE
  new_level INT := NEW.level;
  next_threshold INT;
BEGIN
  -- Cumulative formula: level L+1 requires (L) * (1000 + 250*(L+1)) total XP
  next_threshold := new_level * (1000 + 250 * (new_level + 1));

  WHILE NEW.xp >= next_threshold AND new_level < 100 LOOP
    new_level := new_level + 1;
    next_threshold := new_level * (1000 + 250 * (new_level + 1));
  END LOOP;

  -- Always sync level and xp_to_next (XP is NEVER subtracted)
  NEW.level := new_level;
  NEW.xp_to_next := next_threshold;

  -- Artifact slot progression
  NEW.artifact_slots := CASE
    WHEN new_level >= 50 THEN 6
    WHEN new_level >= 40 THEN 5
    WHEN new_level >= 30 THEN 4
    WHEN new_level >= 20 THEN 3
    WHEN new_level >= 10 THEN 2
    ELSE 1
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update the update_hero_level function (used in artifact_slots migration)
CREATE OR REPLACE FUNCTION update_hero_level()
RETURNS TRIGGER AS $$
DECLARE
  new_level INT := NEW.level;
  next_threshold INT;
BEGIN
  next_threshold := new_level * (1000 + 250 * (new_level + 1));

  WHILE NEW.xp >= next_threshold AND new_level < 100 LOOP
    new_level := new_level + 1;
    next_threshold := new_level * (1000 + 250 * (new_level + 1));
  END LOOP;

  NEW.level := new_level;
  NEW.xp_to_next := next_threshold;

  NEW.artifact_slots := CASE
    WHEN new_level >= 50 THEN 6
    WHEN new_level >= 40 THEN 5
    WHEN new_level >= 30 THEN 4
    WHEN new_level >= 20 THEN 3
    WHEN new_level >= 10 THEN 2
    ELSE 1
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recalculate ALL existing heroes: correct level and xp_to_next from cumulative XP
-- Uses iterative calculation matching the app's cumulativeXpForLevel formula
DO $$
DECLARE
  hero_rec RECORD;
  calc_level INT;
  next_threshold INT;
BEGIN
  FOR hero_rec IN SELECT id, xp FROM heroes LOOP
    calc_level := 1;
    next_threshold := 1 * (1000 + 250 * 2);  -- 1500 for level 2

    WHILE hero_rec.xp >= next_threshold AND calc_level < 100 LOOP
      calc_level := calc_level + 1;
      next_threshold := calc_level * (1000 + 250 * (calc_level + 1));
    END LOOP;

    UPDATE heroes SET
      level = calc_level,
      xp_to_next = next_threshold,
      artifact_slots = CASE
        WHEN calc_level >= 50 THEN 6
        WHEN calc_level >= 40 THEN 5
        WHEN calc_level >= 30 THEN 4
        WHEN calc_level >= 20 THEN 3
        WHEN calc_level >= 10 THEN 2
        ELSE 1
      END
    WHERE id = hero_rec.id
      AND (level != calc_level OR xp_to_next != next_threshold);
  END LOOP;
END;
$$;
