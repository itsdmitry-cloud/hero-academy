export type SeasonStatus = 'upcoming' | 'active' | 'ended';

export interface Season {
  id: string;
  school_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: SeasonStatus;
  created_by: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  xp_reward: number;
  gold_reward: number;
}

export interface AchievementUnlocked {
  id: string;
  hero_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  hero_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  xp_change: number | null;
  hp_change: number | null;
  gold_change: number | null;
  created_at: string;
}

export interface StreakReward {
  id: string;
  day_threshold: number;
  xp_bonus: number;
  gold_bonus: number;
  artifact_id: string | null;
  description: string;
}
