-- =============================================
-- Hero Academy — Season Artifacts: Schema Extensions
-- Migration 010: Adds support for seasonal artifact pools,
-- hero multipliers/shields, and class-wide buffs.
-- =============================================

-- -----------------------------------------------
-- 1. Extend effect_type enum with new mechanics
-- -----------------------------------------------
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'lootbox';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'hp_restore';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_boss_damage';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_class_hp';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_class_xp';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_class_gold';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_random_student';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_season_xp';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_random_gold';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'consumable_combo';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'passive_gold_multiplier';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'passive_boss_dmg_multiplier';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'passive_damage_reduction';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'shield_streak_protect';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'shield_auto_resurrect';
ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'cosmetic';

-- -----------------------------------------------
-- 2. Extend artifact_source enum
-- -----------------------------------------------
ALTER TYPE artifact_source ADD VALUE IF NOT EXISTS 'streak_reward';
ALTER TYPE artifact_source ADD VALUE IF NOT EXISTS 'lootbox';
ALTER TYPE artifact_source ADD VALUE IF NOT EXISTS 'boss';

-- -----------------------------------------------
-- 3. Add hero multiplier & shield columns
-- -----------------------------------------------
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS gold_multiplier NUMERIC(4,2) DEFAULT 1.00;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS xp_multiplier NUMERIC(4,2) DEFAULT 1.00;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS boss_dmg_multiplier NUMERIC(4,2) DEFAULT 1.00;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS hp_shield INT DEFAULT 0;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS protect_streak_active BOOLEAN DEFAULT false;
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS auto_resurrect_hp INT DEFAULT 0;

-- -----------------------------------------------
-- 4. Add season_pool column to artifacts catalog
-- -----------------------------------------------
-- This column tags artifacts into seasonal pools ('fire', 'ice', 'earth', 'water')
-- NULL means the artifact belongs to the standard (non-seasonal) pool.
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS season_pool TEXT;

-- -----------------------------------------------
-- 5. Create class_buffs table for timed class-wide effects
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS class_buffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  buff_type TEXT NOT NULL,             -- e.g. 'gold_multiplier', 'xp_multiplier', 'streak_protect'
  power NUMERIC(4,2) DEFAULT 1.0,     -- multiplier value (1.5 = +50%)
  activated_by UUID REFERENCES heroes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for efficient lookup of active buffs per class
CREATE INDEX IF NOT EXISTS idx_class_buffs_active
  ON class_buffs (class_id, expires_at);

-- RLS: everyone can read buffs for their class; inserts via service role only
ALTER TABLE class_buffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class buffs are viewable by class members"
  ON class_buffs FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM users WHERE id = auth.uid()
    )
  );
