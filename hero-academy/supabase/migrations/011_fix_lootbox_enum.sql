-- =============================================
-- Add 'lootbox' to effect_type enum
-- Fix: lootbox artifacts were incorrectly using 'xp_boost' as effect_type
-- =============================================

ALTER TYPE effect_type ADD VALUE IF NOT EXISTS 'lootbox';

-- Add 'lootbox' to shop_category enum
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'lootbox';

-- Update existing lootbox artifacts to use correct effect_type
UPDATE artifacts
SET effect_type = 'lootbox'
WHERE effect = 'lootbox' AND effect_type = 'xp_boost';
