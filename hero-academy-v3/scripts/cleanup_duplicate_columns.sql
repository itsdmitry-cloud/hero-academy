-- ============================================================
-- Hero Academy — Cleanup: Drop Duplicate Columns
-- Запусти в Supabase SQL Editor по одному блоку
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ БЛОК 1: seasons — удалить дубли start_date / end_date    │
-- │ Код использует starts_at / ends_at (15 ссылок)           │
-- │ start_date / end_date — 0 ссылок в коде                  │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE seasons DROP COLUMN IF EXISTS start_date;
ALTER TABLE seasons DROP COLUMN IF EXISTS end_date;

-- ┌──────────────────────────────────────────────────────────┐
-- │ БЛОК 2: artifacts — удалить req_level                     │
-- │ Код использует min_level для запросов в БД (7 ссылок)     │
-- │ req_level — 0 ссылок в Supabase-запросах                  │
-- └──────────────────────────────────────────────────────────┘
ALTER TABLE artifacts DROP COLUMN IF EXISTS req_level;

-- ============================================================
-- Проверить результат:
-- ============================================================
SELECT column_name FROM information_schema.columns
WHERE table_name = 'seasons' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'artifacts' AND table_schema = 'public'
ORDER BY ordinal_position;
