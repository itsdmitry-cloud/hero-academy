-- =============================================
-- Hero Academy — Seed: 25 Fire Season Artifacts
-- Run AFTER migration 010_season_artifacts.sql
-- Idempotent: ON CONFLICT (name) DO NOTHING
-- =============================================

-- First, add a unique constraint on artifact name if not exists
-- (needed for idempotent inserts)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'artifacts_name_unique'
  ) THEN
    ALTER TABLE artifacts ADD CONSTRAINT artifacts_name_unique UNIQUE (name);
  END IF;
END $$;

-- === Insert 25 Fire Season Artifacts ===

INSERT INTO artifacts (name, description, rarity, icon, effect_type, effect_value, drop_rate, min_level, season_pool, stackable, max_charges, is_shopable, duration_hours)
VALUES
  -- #1 Угли Мотивации — Зелье +10 HP
  ('Угли Мотивации', 'Тлеющие угли, наполненные огненной силой. Восстанавливает 10 HP.', 'common', '/assets/artifacts/fire_coals.png', 'hp_restore', 10, 0.080, 1, 'fire', true, 1, false, 0),

  -- #2 Искра Гения — Зелье +50 XP
  ('Искра Гения', 'Яркая вспышка вдохновения. Мгновенно даёт 50 XP.', 'common', '/assets/artifacts/fire_spark.png', 'xp_boost', 50, 0.080, 1, 'fire', true, 1, false, 0),

  -- #3 Экстракт Феникса — Зелье, полное восстановление HP
  ('Экстракт Феникса', 'Легендарный эликсир, выжатый из пера Феникса. HP восстановлен до максимума!', 'common', '/assets/artifacts/fire_phoenix_extract.png', 'hp_restore', 100, 0.030, 1, 'fire', true, 1, false, 0),

  -- #4 Слиток Гномов — Зелье +100 Золота
  ('Слиток Гномов', 'Раскалённый слиток, выкованный в подземных кузницах. +100 Золота.', 'common', '/assets/artifacts/fire_dwarven_ingot.png', 'gold_bonus', 100, 0.070, 1, 'fire', true, 1, false, 0),

  -- #5 Флакон Магмы — Зелье +200 XP
  ('Флакон Магмы', 'Запечатанный флакон с бурлящей магмой. Даёт мощный заряд опыта: +200 XP.', 'common', '/assets/artifacts/fire_magma_vial.png', 'xp_boost', 200, 0.050, 1, 'fire', true, 1, false, 0),

  -- #6 Угольный Камень — Расходник, 500 урона Боссу
  ('Угольный Камень', 'Обжигающий камень из жерла вулкана. Наносит 500 единиц урона Боссу!', 'common', '/assets/artifacts/fire_coal_stone.png', 'consumable_boss_damage', 500, 0.050, 1, 'fire', true, 1, false, 0),

  -- #7 Пепел Предков — Зелье +50 Сезонного XP
  ('Пепел Предков', 'Священный пепел великих героев прошлого. +50 Сезонного XP Пропуска.', 'common', '/assets/artifacts/fire_ashes.png', 'consumable_season_xp', 50, 0.060, 1, 'fire', true, 1, false, 0),

  -- #8 Слеза Вулкана — Зелье, случайное золото 1-500
  ('Слеза Вулкана', 'Застывшая слеза вулкана. При активации роллится награда: от 1 до 500 Золота!', 'common', '/assets/artifacts/fire_volcano_tear.png', 'consumable_random_gold', 500, 0.050, 1, 'fire', true, 1, false, 0),

  -- #9 Эликсир Пекла — Комбо зелье: +300 XP, +100 Gold, +30 HP
  ('Эликсир Пекла', 'Адское варево невиданной мощи. +300 XP, +100 Золота и +30 HP одним глотком!', 'common', '/assets/artifacts/fire_hellfire_elixir.png', 'consumable_combo', 0, 0.025, 1, 'fire', true, 1, false, 0),

  -- #10 Кольцо Огня — Пассивка +10% Золота навсегда
  ('Кольцо Огня', 'Обсидиановое кольцо с рунами пламени. Увеличивает получаемое золото на 10% навсегда.', 'common', '/assets/artifacts/fire_ring.png', 'passive_gold_multiplier', 10, 0.020, 1, 'fire', false, 0, false, 0),

  -- #11 Зелье Берсерка — Расходник, случайный урон Боссу 100-1000
  ('Зелье Берсерка', 'Ярость огня в жидком виде! Наносит от 100 до 1000 случайного урона Боссу.', 'common', '/assets/artifacts/fire_berserker.png', 'consumable_boss_damage', 1000, 0.040, 1, 'fire', true, 1, false, 0),

  -- #12 Лавовый Амулет — Пассивка: -1 HP штраф за ошибки
  ('Лавовый Амулет', 'Грубый амулет из застывшей лавы. Герой получает на 1 HP меньше штрафа за ошибки.', 'common', '/assets/artifacts/fire_lava_amulet.png', 'passive_damage_reduction', 1, 0.020, 1, 'fire', false, 0, false, 0),

  -- #13 Драконья Чешуйка — Одноразовый щит стрика
  ('Драконья Чешуйка', 'Несокрушимая чешуя огненного дракона. Защитит стрик от одного пропущенного дня.', 'common', '/assets/artifacts/fire_dragon_scale.png', 'shield_streak_protect', 1, 0.025, 1, 'fire', false, 1, false, 0),

  -- #14 Огненное Перо — Автовоскрешение с 50 HP
  ('Огненное Перо', 'Перо бессмертного Феникса. Если HP упадёт до 0, герой автоматически воскреснет с 50 HP!', 'common', '/assets/artifacts/fire_phoenix_feather.png', 'shield_auto_resurrect', 50, 0.015, 1, 'fire', false, 1, false, 0),

  -- #15 Багровое Знамя — Коллекционка
  ('Багровое Знамя', 'Великолепное боевое знамя с золотым фениксом. Украшение для полки героя.', 'common', '/assets/artifacts/fire_banner.png', 'cosmetic', 0, 0.040, 1, 'fire', false, 0, false, 0),

  -- #16 Шлем Инквизитора — Коллекционка
  ('Шлем Инквизитора', 'Обсидиановый шлем с горящими глазами. Грозное украшение для полки.', 'common', '/assets/artifacts/fire_inquisitor.png', 'cosmetic', 0, 0.040, 1, 'fire', false, 0, false, 0),

  -- #17 Око Ифрита — Коллекционка
  ('Око Ифрита', 'Пылающее око огненного джинна на золотом постаменте. Редкий предмет коллекции.', 'common', '/assets/artifacts/fire_eye_ifrit.png', 'cosmetic', 0, 0.040, 1, 'fire', false, 0, false, 0),

  -- #18 Пламенный Меч — Коллекционка
  ('Пламенный Меч', 'Клинок из обсидиана и магмы, объятый вечным пламенем. Украшение для полки.', 'common', '/assets/artifacts/fire_flaming_sword.png', 'cosmetic', 0, 0.040, 1, 'fire', false, 0, false, 0),

  -- #19 Золотой Факел — Коллекционка
  ('Золотой Факел', 'Вечно горящий золотой факел с рунической отделкой. Предмет коллекции.', 'common', '/assets/artifacts/fire_golden_torch.png', 'cosmetic', 0, 0.040, 1, 'fire', false, 0, false, 0),

  -- #20 Метеоритный Дождь — Коллективный: 3000 урона Боссу
  ('Метеоритный Дождь', '🔥 КОЛЛЕКТИВНЫЙ: Вызывает огненный шторм! Наносит 3000 единиц урона Боссу от лица всего класса!', 'common', '/assets/artifacts/fire_meteor_scroll.png', 'consumable_boss_damage', 3000, 0.010, 1, 'fire', false, 1, false, 0),

  -- #21 Тепло Очага — Коллективный: +20 HP всему классу
  ('Тепло Очага', '🔥 КОЛЛЕКТИВНЫЙ: Уют и тепло пламенного очага. Восстанавливает +20 HP каждому ученику в классе.', 'common', '/assets/artifacts/fire_hearth_scroll.png', 'consumable_class_hp', 20, 0.012, 1, 'fire', false, 1, false, 0),

  -- #22 Огненный Бум — Коллективный: +100 XP всему классу
  ('Огненный Бум', '🔥 КОЛЛЕКТИВНЫЙ: Взрывная волна знаний! +100 XP каждому ученику класса!', 'common', '/assets/artifacts/fire_boom.png', 'consumable_class_xp', 100, 0.012, 1, 'fire', false, 1, false, 0),

  -- #23 Драконий Клад — Коллективный: +50 Золота всему классу
  ('Драконий Клад', '🔥 КОЛЛЕКТИВНЫЙ: Сокровища древнего дракона! +50 Золота каждому ученику класса.', 'common', '/assets/artifacts/fire_dragon_hoard.png', 'consumable_class_gold', 50, 0.012, 1, 'fire', false, 1, false, 0),

  -- #24 Спичка Дружбы — Коллективный: случайному ученику +100 XP +100 Gold
  ('Спичка Дружбы', '🔥 КОЛЛЕКТИВНЫЙ: Зажги искру дружбы! Случайный ученик класса получит +100 XP и +100 Золота.', 'common', '/assets/artifacts/fire_friendship_match.png', 'consumable_random_student', 100, 0.015, 1, 'fire', false, 1, false, 0),

  -- #25 Коготь Дракона — Пассивка +20% урона Боссу навсегда
  ('Коготь Дракона', 'Коготь великого дракона. Герой навсегда наносит на 20% больше урона Боссу.', 'common', '/assets/artifacts/fire_dragon_claw.png', 'passive_boss_dmg_multiplier', 20, 0.015, 1, 'fire', false, 0, false, 0)

ON CONFLICT (name) DO NOTHING;

-- Verification query (run manually to check):
-- SELECT name, effect_type, effect_value, drop_rate, season_pool FROM artifacts WHERE season_pool = 'fire' ORDER BY drop_rate DESC;
