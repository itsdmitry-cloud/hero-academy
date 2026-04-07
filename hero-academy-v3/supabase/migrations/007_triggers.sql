-- =============================================
-- Hero Academy — Database Triggers
-- =============================================

-- Auto-create hero when student user is created
CREATE OR REPLACE FUNCTION create_hero_for_student()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO heroes (id, user_id, name, level, xp, xp_to_next, hp, hp_max, gold)
    VALUES (gen_random_uuid(), NEW.id, NEW.display_name, 1, 0, 100, 100, 100, 0);

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

CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_hero_for_student();

-- Auto-create guild when class is created
CREATE OR REPLACE FUNCTION create_guild_for_class()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO guilds (id, class_id, name)
  VALUES (gen_random_uuid(), NEW.id, NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_class_created
  AFTER INSERT ON classes
  FOR EACH ROW EXECUTE FUNCTION create_guild_for_class();

-- Update guild total XP when hero XP changes
CREATE OR REPLACE FUNCTION update_guild_xp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE guilds SET
    total_xp = (
      SELECT COALESCE(SUM(h.xp), 0) FROM heroes h
      JOIN users u ON h.user_id = u.id
      WHERE u.class_id = (SELECT class_id FROM users WHERE id = NEW.user_id)
    ),
    updated_at = now()
  WHERE class_id = (SELECT class_id FROM users WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_hero_xp_change
  AFTER UPDATE OF xp ON heroes
  FOR EACH ROW EXECUTE FUNCTION update_guild_xp();

-- Auto updated_at for heroes
CREATE OR REPLACE FUNCTION update_hero_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hero_updated_at
  BEFORE UPDATE ON heroes
  FOR EACH ROW EXECUTE FUNCTION update_hero_timestamp();

-- Auto updated_at for users
CREATE TRIGGER user_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_hero_timestamp();

-- Check hero death (HP = 0 → inactive)
CREATE OR REPLACE FUNCTION check_hero_death()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hp <= 0 THEN
    NEW.hp = 0;
    NEW.status = 'inactive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_hero_hp_change
  BEFORE UPDATE OF hp ON heroes
  FOR EACH ROW EXECUTE FUNCTION check_hero_death();

-- Level up calculation (XP-based)
CREATE OR REPLACE FUNCTION check_level_up()
RETURNS TRIGGER AS $$
DECLARE
  new_level INT;
  new_xp_to_next INT;
BEGIN
  -- Simple formula: each level needs level * 100 XP
  new_level = NEW.level;
  WHILE NEW.xp >= NEW.xp_to_next AND new_level < 100 LOOP
    new_level := new_level + 1;
    new_xp_to_next := new_level * 100;
  END LOOP;

  IF new_level > NEW.level THEN
    NEW.level = new_level;
    NEW.xp_to_next = new_level * 100;
    -- Bonus: increase artifact slots every 10 levels
    NEW.artifact_slots = GREATEST(1, new_level / 10 + 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_hero_level_check
  BEFORE UPDATE OF xp ON heroes
  FOR EACH ROW EXECUTE FUNCTION check_level_up();

-- Auto create user profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
