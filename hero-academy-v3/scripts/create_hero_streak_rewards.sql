-- ============================================================
-- Hero Academy — Fix: Create hero_streak_rewards table
-- Запусти в: Supabase Dashboard → SQL Editor
-- ============================================================
-- ПРОБЛЕМА: streak_rewards — это справочник конфига (шаблон награды).
-- Код ошибочно использовал её как историческую таблицу по героям.
-- РЕШЕНИЕ: отдельная таблица hero_streak_rewards для хранения
--          каких наград уже получил каждый герой.
-- ============================================================

CREATE TABLE IF NOT EXISTS hero_streak_rewards (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  hero_id        uuid        NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  days_threshold int         NOT NULL,
  xp_granted     int         NOT NULL DEFAULT 0,
  gold_granted   int         NOT NULL DEFAULT 0,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hero_id, days_threshold)
);

-- Индекс для быстрой проверки при входе ученика
CREATE INDEX IF NOT EXISTS idx_hero_streak_rewards_hero
  ON hero_streak_rewards (hero_id, days_threshold);

-- Проверить:
SELECT * FROM hero_streak_rewards LIMIT 5;
