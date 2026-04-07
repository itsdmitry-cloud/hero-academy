-- Таблица "Сезоны" (Задаются администратором на школу)
CREATE TABLE IF NOT EXISTS public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Первая четверть 2026"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Индексы для быстрого поиска активного сезона по школе
CREATE INDEX IF NOT EXISTS idx_seasons_school_id ON public.seasons(school_id);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON public.seasons(school_id, is_active) WHERE is_active = true;

-- Таблица "Сезонные Боссы по предметам" (Назначаются для каждого класса)
CREATE TABLE IF NOT EXISTS public.subject_bosses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL, -- Ссылка на таблицу предметов (или текстовый id, если у вас предметы захардкожены)
    name TEXT NOT NULL, -- "Дракон Алгебры"
    avatar TEXT DEFAULT '🐉', -- Эмодзи или путь к картинке
    max_hp INTEGER NOT NULL DEFAULT 15000,
    current_hp INTEGER NOT NULL DEFAULT 15000,
    is_defeated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Индекс для быстрого поиска босса по классу и сезону
CREATE INDEX IF NOT EXISTS idx_subj_bosses_class_season ON public.subject_bosses(class_id, season_id, subject_id);

-- Таблица логов урона по Боссам (Чтобы выводить Ленту Ударов)
CREATE TABLE IF NOT EXISTS public.boss_damage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boss_id UUID NOT NULL REFERENCES public.subject_bosses(id) ON DELETE CASCADE,
    hero_id UUID NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
    damage_dealt INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- "lesson_mark", "homework", "control_work"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Индекс для получения истории ударов по конкретному боссу
CREATE INDEX IF NOT EXISTS idx_boss_dmg_logs_boss ON public.boss_damage_logs(boss_id);

-- Настройка RLS (Row Level Security) - Безопасность
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boss_damage_logs ENABLE ROW LEVEL SECURITY;

-- Временные базовые политики доступа (чтобы все авторизованные могли читать)
CREATE POLICY "Everyone can read seasons" ON public.seasons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Everyone can read subject_bosses" ON public.subject_bosses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Everyone can read boss logs" ON public.boss_damage_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Позволяем учителям/системе вставлять логи урона (временно разрешено всем для тестов)
CREATE POLICY "Can insert boss logs" ON public.boss_damage_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Can update boss hp" ON public.subject_bosses FOR UPDATE USING (auth.role() = 'authenticated');
