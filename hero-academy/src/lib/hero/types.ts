// src/lib/hero/types.ts
// DB row types — narrow shapes for what fetchers/mappers actually read.

export interface HeroRow {
  id: string;
  user_id: string;
  name: string;
  gender: 'male' | 'female';
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
  streak_current: number | null;
  streak_best: number | null;
  season_xp: number | null;
  status?: string;
}

export interface HeroStatsRow {
  strength: number;
  knowledge: number;
  endurance: number;
  luck: number;
  wisdom: number;
}

export interface ActivityLogRow {
  id: string;
  user_id: string;
  hero_id: string;
  action: string;
  xp_change: number;
  gold_change: number;
  hp_change: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ArtifactRow {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  effect: string;
  effect_type?: string;
  effect_value: number;
  duration_hours: number;
  drop_rate: number;
  stackable: boolean;
  max_charges: number;
  is_shopable: boolean;
  min_level?: number;
  artifact_type?: string;
}

export interface HeroArtifactRow {
  id: string;
  artifact_id: string;
  hero_id: string;
  slot_index: number | null;
  is_equipped: boolean;
  quantity: number;
  charges_remaining: number;
  acquired_at: string;
  expires_at: string | null;
  source: string;
  artifact?: ArtifactRow;
}

export interface ClassRank {
  rank: number;
  total: number;
}

export interface HeroPageInitialData {
  hero: HeroRow | null;
  stats: HeroStatsRow | null;
  activityLog: ActivityLogRow[];
  artifactCatalog: ArtifactRow[];
  heroArtifacts: HeroArtifactRow[];
  classRank: ClassRank | null;
  seasonName: string | null;
  schoolName: string | null;
  className: string | null;
}
