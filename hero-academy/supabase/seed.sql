-- =============================================
-- Hero Academy — Seed Data
-- =============================================

-- ===== ARTIFACTS CATALOG =====
INSERT INTO artifacts (name, description, rarity, icon, effect_type, effect_value, duration_hours, drop_rate, stackable, max_charges, is_shopable) VALUES
('Зелье опыта', 'Увеличивает получаемый XP на 50% на 24 часа', 'common', '/assets/artifacts/xp_potion.png', 'xp_boost', 50, 24, 0.15, true, 3, true),
('Щит стража', 'Блокирует 1 урон от ошибки', 'rare', '/assets/artifacts/shield.png', 'hp_shield', 1, 0, 0.08, false, 1, true),
('Мешок золота', '+100 Gold мгновенно', 'common', '/assets/artifacts/gold_pouch.png', 'gold_bonus', 100, 0, 0.12, true, 1, true),
('Свеча Полуночника', 'Защищает стрик на 1 день', 'rare', '/assets/artifacts/candle.png', 'streak_protect', 1, 0, 0.06, false, 1, true),
('Перо мудрости', 'Снижает урон от ошибок на 50% на 24 часа', 'epic', '/assets/artifacts/quill.png', 'damage_reduce', 50, 24, 0.04, false, 1, true),
('Сфера знаний', 'Пропуск 1 задания без штрафа', 'epic', '/assets/artifacts/orb.png', 'skip_day', 1, 0, 0.03, false, 1, false),
('Корона героя', 'XP ×2 на 48 часов', 'legendary', '/assets/artifacts/crown.png', 'xp_boost', 100, 48, 0.01, false, 1, false),
('Крест воскрешения', 'Восстанавливает HP до максимума', 'legendary', '/assets/artifacts/cross.png', 'hp_shield', 100, 0, 0.005, false, 1, false),
('Малое зелье HP', 'Восстанавливает 25 HP', 'common', '/assets/artifacts/hp_potion_small.png', 'hp_shield', 25, 0, 0.2, true, 1, true),
('Большое зелье HP', 'Восстанавливает 50 HP', 'rare', '/assets/artifacts/hp_potion_large.png', 'hp_shield', 50, 0, 0.08, true, 1, true);

-- ===== ACHIEVEMENTS =====
INSERT INTO achievements (name, description, icon, condition_type, condition_value, xp_reward, gold_reward) VALUES
('Первый квест', 'Выполни первый квест', '⭐', 'quests_completed', 1, 50, 10),
('Марафонец', 'Выполни 10 квестов', '🏃', 'quests_completed', 10, 200, 50),
('Мастер', 'Выполни 50 квестов', '🏅', 'quests_completed', 50, 500, 100),
('Легенда', 'Выполни 100 квестов', '👑', 'quests_completed', 100, 1000, 250),
('Огонёк', 'Стрик 3 дня', '🔥', 'streak_days', 3, 100, 20),
('Пламя', 'Стрик 7 дней', '🔥', 'streak_days', 7, 250, 50),
('Инферно', 'Стрик 14 дней', '💙', 'streak_days', 14, 500, 100),
('Бессмертный', 'Стрик 30 дней', '💎', 'streak_days', 30, 1000, 250),
('Истребитель', 'Победи 1 босса', '🐉', 'bosses_killed', 1, 200, 50),
('Охотник на боссов', 'Победи 5 боссов', '⚔️', 'bosses_killed', 5, 500, 100),
('Коллекционер', 'Собери 10 артефактов', '💎', 'artifacts_collected', 10, 300, 75),
('Богач', 'Накопи 1000 Gold', '💰', 'gold_total', 1000, 200, 0);

-- ===== STREAK REWARDS (Alpha-test 2026-05: 3/6/10/14, math-only calendar) =====
-- После альфы откатить на стандарт 3/7/14/30.
INSERT INTO streak_rewards (day_threshold, xp_bonus, gold_bonus, description) VALUES
(3,  150,  50,  '3 дня: «поймал ритм» — Common Lootbox'),
(6,  300,  150, '6 дней: половина теста — Rare Lootbox'),
(10, 600,  300, '10 дней: почти весь тест — Epic Lootbox'),
(14, 1000, 500, '14 дней: идеальная серия — Legendary Lootbox');

-- ===== SHOP ITEMS =====
INSERT INTO shop_items (name, description, category, price_gold, icon, effect_value, is_available) VALUES
('Малое зелье HP', 'Восстанавливает 25 HP', 'hp_potion', 50, '❤️‍🩹', 25, true),
('Большое зелье HP', 'Восстанавливает 50 HP', 'hp_potion', 100, '❤️', 50, true),
('Полное восстановление', 'HP до максимума', 'hp_potion', 250, '💖', 100, true),
('Свиток опыта', '+50% XP на 24 часа', 'xp_boost', 150, '📜', 50, true),
('Свиток мастера', '+100% XP на 24 часа', 'xp_boost', 300, '📜', 100, true),
('Щит стража', 'Блокирует 1 урон', 'artifact', 200, '🛡️', 1, true),
('Свеча Полуночника', 'Защита стрика на 1 день', 'artifact', 150, '🕯️', 1, true),
('Золотая рамка', 'Косметика для профиля', 'cosmetic', 500, '🖼️', 0, true),
('Эффект сияния', 'Сияние вокруг аватара', 'cosmetic', 300, '✨', 0, true);

-- ===== ECONOMY CONFIG =====
INSERT INTO economy_config (key, value) VALUES
('xp_per_quest_easy', '{"value": 100}'),
('xp_per_quest_medium', '{"value": 150}'),
('xp_per_quest_hard', '{"value": 250}'),
('gold_per_quest_easy', '{"value": 10}'),
('gold_per_quest_medium', '{"value": 20}'),
('gold_per_quest_hard', '{"value": 40}'),
('hp_damage_per_mistake', '{"value": 10}'),
('boss_reward_xp', '{"value": 300}'),
('boss_reward_gold', '{"value": 50}'),
('artifact_drop_chance_base', '{"value": 0.1}');
