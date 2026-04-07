-- streak_rewards: tracks which milestones have been granted per hero
CREATE TABLE IF NOT EXISTS streak_rewards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id         UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  days_threshold  INT NOT NULL,
  xp_granted      INT NOT NULL DEFAULT 0,
  gold_granted    INT NOT NULL DEFAULT 0,
  granted_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hero_id, days_threshold)
);

CREATE INDEX IF NOT EXISTS idx_streak_rewards_hero ON streak_rewards(hero_id);
