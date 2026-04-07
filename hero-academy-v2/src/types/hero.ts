export type HeroStatus = 'active' | 'inactive';

export interface HeroStats {
  hero_id: string;
  strength: number;
  knowledge: number;
  endurance: number;
  luck: number;
  wisdom: number;
}

export interface Hero {
  id: string;
  user_id: string;
  name: string;
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
  streak_current: number;
  streak_best: number;
  streak_last_date: string | null;
  streak_protected: boolean;
  status: HeroStatus;
  gender: 'male' | 'female';
  avatar_config: AvatarConfig;
  season_id: string | null;
  hero_stats?: HeroStats;
  created_at: string;
  updated_at: string;
}

export interface AvatarConfig {
  body: string;
  hair: string;
  outfit: string;
  color_primary: string;
  color_secondary: string;
  accessory?: string;
}
