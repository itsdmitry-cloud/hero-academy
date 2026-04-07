export type QuestType = 'quest' | 'dungeon' | 'boss';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestStatus = 'draft' | 'active' | 'completed' | 'archived';
export type AttemptStatus = 'in_progress' | 'completed' | 'failed';
export type QuestionType = 'multiple_choice' | 'text_input' | 'number_input';

export interface Quest {
  id: string;
  class_id: string;
  created_by: string;
  type: QuestType;
  title: string;
  description: string;
  subject: string;
  difficulty: Difficulty;
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  deadline: string | null;
  status: QuestStatus;
  max_attempts: number;
  quest_stages?: QuestStage[];
  created_at: string;
}

export interface QuestStage {
  id: string;
  quest_id: string;
  order_index: number;
  title: string;
  question_type: QuestionType;
  question_data: QuestionData;
  xp_partial: number;
  created_at: string;
}

export interface QuestionData {
  question: string;
  choices?: string[];
  correct_answer: string;
  explanation?: string;
  image_url?: string;
}

export interface QuestAttempt {
  id: string;
  quest_id: string;
  hero_id: string;
  status: AttemptStatus;
  current_stage: number;
  answers: AnswerRecord[];
  correct_count: number;
  mistake_count: number;
  xp_earned: number;
  gold_earned: number;
  hp_lost: number;
  started_at: string;
  completed_at: string | null;
  quest?: Quest;
}

export interface AnswerRecord {
  stage_index: number;
  answer: string;
  correct: boolean;
  xp: number;
  hp_lost: number;
}
