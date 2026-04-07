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
