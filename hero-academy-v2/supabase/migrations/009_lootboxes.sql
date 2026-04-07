-- =============================================
-- Loot Boxes as special artifacts
-- =============================================

-- Insert 4 loot box types into artifacts catalog
INSERT INTO artifacts (name, description, rarity, icon, effect_type, effect_value, drop_rate, stackable, max_charges, is_shopable)
VALUES
  ('Обычный сундук',      'Шанс получить Обычный или Редкий артефакт',        'common',    '📦', 'lootbox', 1, 0, true, 1, true),
  ('Редкий сундук',       'Шанс получить Редкий или Эпический артефакт',       'rare',      '🎁', 'lootbox', 2, 0, true, 1, true),
  ('Эпический сундук',    'Шанс получить Эпический или Легендарный артефакт',  'epic',      '🗡️', 'lootbox', 3, 0, true, 1, true),
  ('Легендарный сундук',  'Шанс получить Легендарный артефакт. Редкость!',     'legendary', '👑', 'lootbox', 4, 0, true, 1, true)
ON CONFLICT DO NOTHING;

-- Add loot boxes to shop at premium prices
-- First get the artifact IDs we just inserted
DO $$
DECLARE
  common_id    UUID;
  rare_id      UUID;
  epic_id      UUID;
  legendary_id UUID;
BEGIN
  SELECT id INTO common_id    FROM artifacts WHERE effect_type = 'lootbox' AND rarity = 'common'    LIMIT 1;
  SELECT id INTO rare_id      FROM artifacts WHERE effect_type = 'lootbox' AND rarity = 'rare'      LIMIT 1;
  SELECT id INTO epic_id      FROM artifacts WHERE effect_type = 'lootbox' AND rarity = 'epic'      LIMIT 1;
  SELECT id INTO legendary_id FROM artifacts WHERE effect_type = 'lootbox' AND rarity = 'legendary' LIMIT 1;

  INSERT INTO shop_items (name, description, category, artifact_id, price_gold, icon, effect_value, is_available, req_level)
  VALUES
    ('Обычный сундук',     'Попытай удачу — внутри может быть артефакт',     'lootbox', common_id,    200,  '📦', 1, true, 1),
    ('Редкий сундук',      'Редкий артефакт более вероятен',                 'lootbox', rare_id,      600,  '🎁', 2, true, 5),
    ('Эпический сундук',   'Высокий шанс Эпика',                             'lootbox', epic_id,      1500, '🗡️', 3, true, 15),
    ('Легендарный сундук', 'Только для самых богатых героев',                 'lootbox', legendary_id, 5000, '👑', 4, true, 30)
  ON CONFLICT DO NOTHING;
END $$;
