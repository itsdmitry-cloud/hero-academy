-- ============================================================
-- Battle Pass: SQL Migration
-- Adds season_xp tracking, BP reward claims, and seasonal lootboxes
-- ============================================================

-- 1. Add season_xp to heroes (tracks XP earned in current season only)
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS season_xp integer NOT NULL DEFAULT 0;

-- 2. Table: hero_season_rewards — tracks which BP tiers the hero has claimed
CREATE TABLE IF NOT EXISTS hero_season_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id     uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier        integer NOT NULL,           -- BP level 1–30
  reward_type text NOT NULL,              -- 'gold', 'artifact', 'lootbox', 'collectible'
  reward_data jsonb DEFAULT '{}'::jsonb,  -- details (artifact_id, amount, name, etc.)
  claimed_at  timestamptz DEFAULT now(),
  UNIQUE (hero_id, season_id, tier)       -- prevent double-claim
);

-- 3. Table: hero_collectibles — seasonal cosmetic items (emoji badges, relics)
--    Separate from hero_artifacts so they never expire / get deleted
CREATE TABLE IF NOT EXISTS hero_collectibles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id     uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  code        text NOT NULL,              -- unique identifier e.g. 'fire_spark', 'fire_dragon_heart'
  name        text NOT NULL,              -- display name
  icon        text NOT NULL DEFAULT '🏆', -- emoji (or future asset path)
  description text DEFAULT '',
  season_id   uuid REFERENCES seasons(id),
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE (hero_id, code)                  -- one collectible per hero
);

-- 4. Seasonal Lootbox artifacts (4 elements × 4 rarities = 16 new artifacts)
-- These will be granted by the BP reward system. Contents TBD later.

-- 🔥 Fire Season (Осень / Autumn)
INSERT INTO artifacts (name, description, rarity, icon, effect, effect_type, effect_value, duration_hours, max_charges, artifact_type, drop_rate, stackable, min_level, is_shopable)
VALUES
  ('🔥 Огненный Сундук (Обычный)',     'Сезонный сундук Огня. Что внутри — решит судьба!', 'common',    '🔥', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('🔥 Огненный Сундук (Редкий)',      'Сезонный сундук Огня. Повышенный шанс на редкости!', 'rare',    '🔥', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('🔥 Огненный Сундук (Эпический)',   'Сезонный сундук Огня. Эпические сокровища ждут!',  'epic',     '🔥', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('🔥 Огненный Сундук (Легендарный)', 'Сезонный сундук Огня. Легендарное пламя внутри!',  'legendary','🔥', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false)
ON CONFLICT DO NOTHING;

-- ❄️ Ice Season (Зима / Winter)
INSERT INTO artifacts (name, description, rarity, icon, effect, effect_type, effect_value, duration_hours, max_charges, artifact_type, drop_rate, stackable, min_level, is_shopable)
VALUES
  ('❄️ Ледяной Сундук (Обычный)',      'Сезонный сундук Льда. Морозные тайны!',            'common',    '❄️', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('❄️ Ледяной Сундук (Редкий)',       'Сезонный сундук Льда. Ледяные артефакты внутри!',  'rare',      '❄️', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('❄️ Ледяной Сундук (Эпический)',    'Сезонный сундук Льда. Хрустальные сокровища!',     'epic',      '❄️', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('❄️ Ледяной Сундук (Легендарный)',  'Сезонный сундук Льда. Вечная мерзлота хранит легенды!', 'legendary','❄️', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false)
ON CONFLICT DO NOTHING;

-- 🌿 Earth Season (Весна / Spring)
INSERT INTO artifacts (name, description, rarity, icon, effect, effect_type, effect_value, duration_hours, max_charges, artifact_type, drop_rate, stackable, min_level, is_shopable)
VALUES
  ('🌿 Земляной Сундук (Обычный)',     'Сезонный сундук Земли. Ростки знаний!',            'common',    '🌿', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('🌿 Земляной Сундук (Редкий)',      'Сезонный сундук Земли. Корни мудрости!',            'rare',      '🌿', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('🌿 Земляной Сундук (Эпический)',   'Сезонный сундук Земли. Каменные реликвии!',         'epic',      '🌿', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('🌿 Земляной Сундук (Легендарный)', 'Сезонный сундук Земли. Сердце горы!',               'legendary', '🌿', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false)
ON CONFLICT DO NOTHING;

-- 💧 Water Season (Лето / Summer)
INSERT INTO artifacts (name, description, rarity, icon, effect, effect_type, effect_value, duration_hours, max_charges, artifact_type, drop_rate, stackable, min_level, is_shopable)
VALUES
  ('💧 Водяной Сундук (Обычный)',      'Сезонный сундук Воды. Океан возможностей!',         'common',    '💧', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('💧 Водяной Сундук (Редкий)',       'Сезонный сундук Воды. Глубинные сокровища!',        'rare',      '💧', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('💧 Водяной Сундук (Эпический)',    'Сезонный сундук Воды. Жемчужины бездны!',           'epic',      '💧', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false),
  ('💧 Водяной Сундук (Легендарный)',  'Сезонный сундук Воды. Трезубец Посейдона!',         'legendary', '💧', 'lootbox', 'xp_boost', 0, 0, 1, 'consumable', 0, false, 1, false)
ON CONFLICT DO NOTHING;

-- 5. RLS Policies
ALTER TABLE hero_season_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_collectibles ENABLE ROW LEVEL SECURITY;

-- Students can read their own rewards
CREATE POLICY "hero_season_rewards_select" ON hero_season_rewards
  FOR SELECT USING (
    hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
  );

-- Service role inserts (via API)
CREATE POLICY "hero_season_rewards_insert_service" ON hero_season_rewards
  FOR INSERT WITH CHECK (true);

-- Students can read their own collectibles
CREATE POLICY "hero_collectibles_select" ON hero_collectibles
  FOR SELECT USING (
    hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
  );

-- Service role inserts
CREATE POLICY "hero_collectibles_insert_service" ON hero_collectibles
  FOR INSERT WITH CHECK (true);

-- 6. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_hero_season_rewards_hero_season
  ON hero_season_rewards (hero_id, season_id);
CREATE INDEX IF NOT EXISTS idx_hero_collectibles_hero
  ON hero_collectibles (hero_id);
