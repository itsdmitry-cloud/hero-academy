-- Add gender column to heroes table
ALTER TABLE heroes ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female')) DEFAULT 'male';
-- Update trigger to pull gender from auth.users meta data
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
      1, 0, 100, 100, 100, 0
    );

    -- Also create hero_stats
    INSERT INTO hero_stats (hero_id, strength, knowledge, endurance, luck, wisdom)
    VALUES (
      (SELECT id FROM heroes WHERE user_id = NEW.id),
      10, 10, 10, 10, 10
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- =============================================
-- FIX Level up calculation (consistent with frontend)
-- =============================================
CREATE OR REPLACE FUNCTION check_level_up()
RETURNS TRIGGER AS $$
DECLARE
  new_level INT;
  new_xp_to_next INT;
BEGIN
  -- We start tracing from the NEW records's current context
  new_level = NEW.level;
  new_xp_to_next = NEW.xp_to_next;

  -- Frontend uses formula where xp drops by xp_to_next, and xp_to_next increments by 500
  WHILE NEW.xp >= new_xp_to_next AND new_level < 100 LOOP
    NEW.xp := NEW.xp - new_xp_to_next;
    new_level := new_level + 1;
    new_xp_to_next := new_xp_to_next + 500;
  END LOOP;

  -- Apply the new states if the hero leveled up
  IF new_level > NEW.level THEN
    NEW.level = new_level;
    NEW.xp_to_next = new_xp_to_next;
    -- Bonus: increase artifact slots every 10 levels
    NEW.artifact_slots = GREATEST(1, new_level / 10 + 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
