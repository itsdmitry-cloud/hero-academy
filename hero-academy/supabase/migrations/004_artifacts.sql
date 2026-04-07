-- =============================================
-- Hero Academy — Artifacts, Streaks, Achievements
-- =============================================

-- Artifacts (master catalog)
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rarity rarity NOT NULL DEFAULT 'common',
  icon TEXT, -- asset path
  effect_type effect_type NOT NULL,
  effect_value INT NOT NULL DEFAULT 0, -- e.g. 50 for +50% XP
  duration_hours INT DEFAULT 0, -- 0 = permanent
  drop_rate DECIMAL(4,3) NOT NULL DEFAULT 0.1, -- 0.0–1.0
  req_level INT NOT NULL DEFAULT 1,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  stackable BOOLEAN DEFAULT false,
  max_charges INT DEFAULT 1, -- number of uses
  is_shopable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hero Artifacts (inventory)
CREATE TABLE hero_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  slot_index INT, -- equipped slot position (null = not equipped)
  is_equipped BOOLEAN DEFAULT false,
  quantity INT NOT NULL DEFAULT 1,
  charges_remaining INT DEFAULT 1,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- for time-limited artifacts
  source artifact_source NOT NULL DEFAULT 'drop'
);

-- Streak Rewards (config table)
CREATE TABLE streak_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_threshold INT NOT NULL UNIQUE, -- 3, 7, 14, 30
  xp_bonus INT NOT NULL DEFAULT 0,
  gold_bonus INT NOT NULL DEFAULT 0,
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  description TEXT
);

-- Streak Claims (log of claimed streak rewards)
CREATE TABLE streak_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  streak_reward_id UUID NOT NULL REFERENCES streak_rewards(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hero_id, streak_reward_id)
);

-- Achievements (master catalog)
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  condition_type TEXT NOT NULL, -- "quests_completed", "streak_days", "bosses_killed", etc.
  condition_value INT NOT NULL, -- threshold
  xp_reward INT NOT NULL DEFAULT 0,
  gold_reward INT NOT NULL DEFAULT 0
);

-- Achievements Unlocked
CREATE TABLE achievements_unlocked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hero_id, achievement_id)
);
