-- Phase 4 Fix #1: Create season_leaderboards table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.season_leaderboards (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id   UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  hero_id     UUID NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  hero_name   TEXT,
  level       INT DEFAULT 1,
  xp          INT DEFAULT 0,
  gold        INT DEFAULT 0,
  rank        INT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_season_leaderboards_season ON public.season_leaderboards(season_id);
CREATE INDEX IF NOT EXISTS idx_season_leaderboards_hero ON public.season_leaderboards(hero_id);
