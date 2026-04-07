-- Expand artifact slot progression: 6 slots total, unlocking every 10 levels starting from 2nd slot
-- Slots: 1(lv1), 2(lv10), 3(lv20), 4(lv30), 5(lv40), 6(lv50)

CREATE OR REPLACE FUNCTION update_hero_level()
RETURNS TRIGGER AS $$
DECLARE
  new_level INT;
  new_xp_to_next INT;
BEGIN
  new_level = NEW.level;
  new_xp_to_next = NEW.xp_to_next;

  WHILE NEW.xp >= new_xp_to_next AND new_level < 100 LOOP
    NEW.xp := NEW.xp - new_xp_to_next;
    new_level := new_level + 1;
    new_xp_to_next := new_xp_to_next + 500;
  END LOOP;

  IF new_level > NEW.level THEN
    NEW.level = new_level;
    NEW.xp_to_next = new_xp_to_next;
    -- Artifact slot progression: every 10 levels
    NEW.artifact_slots = CASE
      WHEN new_level >= 50 THEN 6
      WHEN new_level >= 40 THEN 5
      WHEN new_level >= 30 THEN 4
      WHEN new_level >= 20 THEN 3
      WHEN new_level >= 10 THEN 2
      ELSE 1
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing heroes' artifact_slots to match new progression
UPDATE heroes SET artifact_slots = CASE
  WHEN level >= 50 THEN 6
  WHEN level >= 40 THEN 5
  WHEN level >= 30 THEN 4
  WHEN level >= 20 THEN 3
  WHEN level >= 10 THEN 2
  ELSE 1
END;
