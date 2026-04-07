-- =============================================
-- Hero Academy — Season Boss Model v2
-- 
-- NEW MODEL:
--   1 boss per season (globally defined), HP tracked per-class.
--   Boss lives the entire season (quarter ≈ 60 working days).
--
-- season_boss: defines the boss for the season (1 per season)
-- season_boss_class_hp: tracks HP per class (separate pool)
-- boss_damage_logs: unchanged (tracks individual hero damage)
-- =============================================

-- Season Boss definition (1 per season, school-wide)
CREATE TABLE IF NOT EXISTS public.season_boss (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                    -- "Дракон Знаний 2026"
    avatar TEXT DEFAULT '🐉',             -- Emoji or asset path
    description TEXT,                      -- Boss lore/description
    base_hp INTEGER NOT NULL DEFAULT 50000, -- Base HP before class scaling
    reward_pool_xp INTEGER NOT NULL DEFAULT 25000,
    reward_pool_gold INTEGER NOT NULL DEFAULT 5000,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(season_id)                      -- Exactly 1 boss per season
);

-- Per-class HP tracking (each class fights the same boss independently)
CREATE TABLE IF NOT EXISTS public.season_boss_class_hp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_boss_id UUID NOT NULL REFERENCES public.season_boss(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    max_hp INTEGER NOT NULL,              -- Scaled HP for this class
    current_hp INTEGER NOT NULL,          -- Current HP for this class
    is_defeated BOOLEAN NOT NULL DEFAULT false,
    defeated_at TIMESTAMPTZ,              -- When this class defeated the boss
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(season_boss_id, class_id)      -- 1 HP pool per class per boss
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_season_boss_season ON public.season_boss(season_id);
CREATE INDEX IF NOT EXISTS idx_season_boss_class_hp_boss ON public.season_boss_class_hp(season_boss_id);
CREATE INDEX IF NOT EXISTS idx_season_boss_class_hp_class ON public.season_boss_class_hp(class_id);

-- RLS
ALTER TABLE public.season_boss ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_boss_class_hp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read season_boss" ON public.season_boss
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Everyone can read season_boss_class_hp" ON public.season_boss_class_hp
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Can update season_boss_class_hp" ON public.season_boss_class_hp
    FOR UPDATE USING (auth.role() = 'authenticated');

-- boss_damage_logs now references season_boss_class_hp instead of subject_bosses
-- We keep the old table for backward compat, but new code uses season_boss_class_hp.id
-- as boss_id in boss_damage_logs.
