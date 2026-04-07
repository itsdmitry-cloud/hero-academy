export interface Guild {
  id: string;
  class_id: string;
  name: string;
  banner_url: string | null;
  total_xp: number;
  total_quests: number;
  total_bosses: number;
  streak_current: number;
  streak_best: number;
  season_id: string | null;
  updated_at: string;
}

export interface SeasonRanking {
  id: string;
  season_id: string;
  entity_type: 'hero' | 'guild';
  entity_id: string;
  rank: number;
  xp_total: number;
  score: number;
  rewards_given: Record<string, unknown>;
}
