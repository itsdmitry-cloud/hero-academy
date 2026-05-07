// src/lib/hero/mappers.ts
// Pure functions: DB row -> zustand-store format.
// Used by both SSR hydration and client realtime updates.

import type { ExtendedHeroState } from '@/lib/store/heroStore';
import type { HeroRow, HeroStatsRow } from './types';

export function mapHero(row: HeroRow, _stats: HeroStatsRow | null): ExtendedHeroState {
  return {
    heroId: row.id,
    name: row.name,
    avatar: row.gender === 'female' ? '🧙‍♀️' : '🧙‍♂️',
    gender: row.gender,
    level: row.level,
    xp: row.xp,
    xp_to_next: row.xp_to_next,
    hp: row.hp,
    hp_max: row.hp_max,
    gold: row.gold,
    streak: row.streak_current ?? 0,
    streak_best: row.streak_best ?? 0,
    season_xp: row.season_xp ?? 0,
    activeArtifacts: [],
  };
}

export function mapStats(stats: HeroStatsRow | null) {
  if (!stats) return null;
  return {
    strength: stats.strength,
    knowledge: stats.knowledge,
    endurance: stats.endurance,
    luck: stats.luck,
    wisdom: stats.wisdom,
  };
}
