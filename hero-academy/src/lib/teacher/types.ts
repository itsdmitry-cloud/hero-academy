// Shared types for teacher data flow (server fetchers + client hooks).

export interface ClassInfo {
  id: string;
  name: string;
  invite_code: string;
  school_id: string;
}

export interface StudentRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  hero_id: string | null;
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
  streak: number;
  streak_best: number;
  status: string;
}

export interface TeacherQuestRow {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: string;
  difficulty: string;
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  deadline: string | null;
  status: string;
  context?: string;
  created_at: string;
  attempt_count: number;
  completed_count: number;
}

export interface ClassStats {
  student_count: number;
  active_quests: number;
  avg_xp: number;
  total_xp: number;
  class_streak: number;
}

export interface TeacherInitialData {
  classes: ClassInfo[];
  activeClassId: string | null;
  students: StudentRow[];
  quests: TeacherQuestRow[];
}

// Live page additionally needs realtime-shaped students + lesson counters/averages.
export interface LiveStudentState {
  hero_id: string;
  user_id: string;
  display_name: string;
  hp: number;
  hp_max: number;
  xp: number;
  level: number;
  streak_current: number;
  status: string;
  lastUpdated: number;
}

// heroId → subject (lowercase) → action label → count
export type LessonCounters = Record<string, Record<string, Record<string, number>>>;

// heroId → subject (lowercase) → average score
export type LessonAverages = Record<string, Record<string, number>>;

export interface LiveInitialData {
  liveStudents: LiveStudentState[];
  counters: LessonCounters;
  averages: LessonAverages;
}
