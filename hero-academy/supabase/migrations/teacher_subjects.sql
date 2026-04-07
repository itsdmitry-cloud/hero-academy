-- Добавляем колонку "Предметы" (subjects) в профиль учителя (таблица users)
-- Эта колонка будет хранить массив строк, например: '{Алгебра, Геометрия}'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}';

-- Индекс для возможного поиска учителей по предмету (в будущем)
CREATE INDEX IF NOT EXISTS idx_users_subjects ON public.users USING gin (subjects);
