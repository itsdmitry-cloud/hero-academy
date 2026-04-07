-- =============================================
-- Hero Academy — Core Tables: Schools, Classes, Users, Heroes
-- =============================================

-- Schools
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID, -- admin who created
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "5-А"
  teacher_id UUID, -- FK to users, added later
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Зима 2026"
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status season_status DEFAULT 'upcoming',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK back from classes.teacher_id → users.id
ALTER TABLE classes ADD CONSTRAINT fk_classes_teacher
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add FK from schools.created_by → users.id
ALTER TABLE schools ADD CONSTRAINT fk_schools_creator
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add FK from seasons.created_by → users.id
ALTER TABLE seasons ADD CONSTRAINT fk_seasons_creator
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Heroes (1:1 with student user)
CREATE TABLE heroes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 100),
  xp INT NOT NULL DEFAULT 0,
  xp_to_next INT NOT NULL DEFAULT 100,
  hp INT NOT NULL DEFAULT 100,
  hp_max INT NOT NULL DEFAULT 100,
  gold INT NOT NULL DEFAULT 0,
  streak_current INT NOT NULL DEFAULT 0,
  streak_best INT NOT NULL DEFAULT 0,
  streak_last_date DATE,
  streak_protected BOOLEAN DEFAULT false,
  status hero_status DEFAULT 'active',
  artifact_slots INT NOT NULL DEFAULT 1,
  avatar_config JSONB DEFAULT '{}',
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hero Stats (radar chart values)
CREATE TABLE hero_stats (
  hero_id UUID PRIMARY KEY REFERENCES heroes(id) ON DELETE CASCADE,
  strength INT NOT NULL DEFAULT 10,
  knowledge INT NOT NULL DEFAULT 10,
  endurance INT NOT NULL DEFAULT 10,
  luck INT NOT NULL DEFAULT 10,
  wisdom INT NOT NULL DEFAULT 10
);

-- Guilds (1:1 with class)
CREATE TABLE guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID UNIQUE NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  banner_url TEXT,
  total_xp BIGINT NOT NULL DEFAULT 0,
  total_quests INT NOT NULL DEFAULT 0,
  total_bosses INT NOT NULL DEFAULT 0,
  streak_current INT NOT NULL DEFAULT 0,
  streak_best INT NOT NULL DEFAULT 0,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Season Rankings (snapshot at season end)
CREATE TABLE season_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('hero', 'guild')),
  entity_id UUID NOT NULL,
  rank INT NOT NULL,
  xp_total BIGINT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  rewards_given JSONB DEFAULT '{}'
);
