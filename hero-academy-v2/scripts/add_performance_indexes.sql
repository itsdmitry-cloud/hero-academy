-- ============================================================
-- Hero Academy — Performance Indexes
-- ИНСТРУКЦИЯ: Запускай каждый блок ОТДЕЛЬНО в SQL Editor
-- если один упадёт — пропусти его, остальные работают
-- ============================================================

-- БЛОК 1: heroes — базовые индексы
CREATE INDEX IF NOT EXISTS idx_heroes_user_id   ON heroes (user_id);
CREATE INDEX IF NOT EXISTS idx_heroes_xp_desc   ON heroes (xp DESC);
CREATE INDEX IF NOT EXISTS idx_heroes_status     ON heroes (status);

-- БЛОК 2: users — поиск по классу и школе  
CREATE INDEX IF NOT EXISTS idx_users_class_id_role   ON users (class_id, role);
CREATE INDEX IF NOT EXISTS idx_users_school_id_role  ON users (school_id, role);

-- БЛОК 3: activity_log — лента активности
CREATE INDEX IF NOT EXISTS idx_activity_log_hero_created
  ON activity_log (hero_id, created_at DESC);

-- БЛОК 4: hero_artifacts — рюкзак
CREATE INDEX IF NOT EXISTS idx_hero_artifacts_hero_id
  ON hero_artifacts (hero_id);

-- БЛОК 5: quests — задания класса
CREATE INDEX IF NOT EXISTS idx_quests_class_status
  ON quests (class_id, status);

-- БЛОК 6: boss_damage_logs — урон по боссу
-- Запусти ОТДЕЛЬНО — тут была ошибка
CREATE INDEX IF NOT EXISTS idx_boss_damage_boss_hero
  ON boss_damage_logs (boss_id, hero_id);

-- БЛОК 7: subject_bosses — боссы класса  
CREATE INDEX IF NOT EXISTS idx_subject_bosses_class_season
  ON subject_bosses (class_id, season_id);

-- БЛОК 8: streak_rewards — ПРОПУСТИТЬ
-- Эта таблица является справочником наград (конфиг), не содержит hero_id.
-- Реальные колонки: id, day_threshold, xp_bonus, gold_bonus, artifact_id, description

-- ============================================================
-- Проверить все созданные индексы:
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
-- ============================================================
