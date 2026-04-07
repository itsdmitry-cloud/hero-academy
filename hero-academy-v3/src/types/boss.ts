export type BossStatus = 'pending' | 'active' | 'defeated' | 'expired';

export interface BossEvent {
  id: string;
  class_id: string;
  created_by: string;
  quest_id: string;
  boss_name: string;
  boss_avatar: string;
  boss_hp: number;
  boss_hp_current: number;
  timer_minutes: number;
  status: BossStatus;
  rewards: BossRewards;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  participants?: BossParticipant[];
}

export interface BossRewards {
  xp: number;
  gold: number;
  artifact_ids?: string[];
}

export interface BossParticipant {
  id: string;
  boss_event_id: string;
  hero_id: string;
  damage_dealt: number;
  hp_lost: number;
  answers_correct: number;
  answers_wrong: number;
  joined_at: string;
}

export interface SubjectBoss {
  id: string;
  season_id: string;
  class_id: string;
  subject_id: string;
  name: string;
  avatar: string;
  max_hp: number;
  current_hp: number;
  is_defeated: boolean;
  created_at: string;
}

export interface BossDamageLog {
  id: string;
  boss_id: string;
  hero_id: string;
  damage_dealt: number;
  action_type: string;
  created_at: string;
  hero?: {
    name: string;
  };
}
