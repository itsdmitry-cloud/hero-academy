-- Миграция: устранение дубликатов "одинаковых боссов" на дашборде учителя.
--
-- Корень проблемы:
--   1. `subject_bosses.subject_id` — TEXT без нормализации,
--      поэтому "Математика", "математика", " Математика " — три разных id.
--   2. `/api/bosses/ensure` ищет существующих боссов через .in()/eq() и,
--      не найдя точного совпадения, всегда вставляет новую строку.
--   3. Фильтр на дашборде case-insensitive (.toLowerCase()) — пропускает
--      обе строки и выводит двух визуально одинаковых боссов.
--
-- Что делаем:
--   A) Триммим subject_id (убираем внешние и лишние внутренние пробелы).
--   B) Сливаем дубликаты по (season_id, class_id, LOWER(subject_id)):
--      победитель — самый "поврежденный" (наименьший current_hp), остальных
--      удаляем. damage-логи перевешиваем на победителя через update FK.
--   C) Аналогично нормализуем users.subjects[] (trim + dedupe по lower).
--   D) Создаем UNIQUE индекс по (season_id, class_id, LOWER(subject_id)) —
--      чтобы дубликаты больше не пролезли даже при гонке запросов.

BEGIN;

-- A. Trim subject_id (REGEXP_REPLACE схлопывает внутренние whitespace).
UPDATE public.subject_bosses
SET subject_id = regexp_replace(btrim(subject_id), '\s+', ' ', 'g')
WHERE subject_id IS DISTINCT FROM regexp_replace(btrim(subject_id), '\s+', ' ', 'g');

-- B. Находим дубликаты: группируем по (season_id, class_id, LOWER(subject_id)).
--    Победитель в каждой группе — с наименьшим current_hp (учёл больше урона).
--    При равенстве — самый ранний created_at (первый созданный).
WITH ranked AS (
  SELECT
    id,
    season_id,
    class_id,
    subject_id,
    current_hp,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY season_id, class_id, LOWER(subject_id)
      ORDER BY current_hp ASC, created_at ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY season_id, class_id, LOWER(subject_id)
      ORDER BY current_hp ASC, created_at ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS keeper_id,
    FIRST_VALUE(subject_id) OVER (
      PARTITION BY season_id, class_id, LOWER(subject_id)
      ORDER BY current_hp ASC, created_at ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS keeper_subject_id
  FROM public.subject_bosses
),
losers AS (
  SELECT id AS loser_id, keeper_id, keeper_subject_id
  FROM ranked
  WHERE rn > 1
)
-- Переносим damage-логи с проигравших на победителя, затем удаляем проигравших.
, move_logs AS (
  UPDATE public.boss_damage_logs bdl
  SET boss_id = l.keeper_id
  FROM losers l
  WHERE bdl.boss_id = l.loser_id
  RETURNING 1
)
DELETE FROM public.subject_bosses sb
USING losers l
WHERE sb.id = l.loser_id;

-- C. Нормализуем users.subjects[] (trim каждого элемента, dedupe по LOWER).
UPDATE public.users u
SET subjects = normalized.arr
FROM (
  SELECT
    id,
    ARRAY(
      SELECT DISTINCT ON (LOWER(trimmed))
        trimmed
      FROM (
        SELECT regexp_replace(btrim(elem), '\s+', ' ', 'g') AS trimmed
        FROM unnest(subjects) AS elem
        WHERE btrim(elem) <> ''
      ) t
      ORDER BY LOWER(trimmed), trimmed
    ) AS arr
  FROM public.users
  WHERE role = 'teacher'
    AND subjects IS NOT NULL
    AND array_length(subjects, 1) IS NOT NULL
) normalized
WHERE u.id = normalized.id
  AND u.subjects IS DISTINCT FROM normalized.arr;

-- D. Уникальный индекс: один босс на (сезон × класс × предмет) без учёта регистра.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subject_bosses_season_class_subject_ci
  ON public.subject_bosses (season_id, class_id, LOWER(subject_id));

COMMIT;
