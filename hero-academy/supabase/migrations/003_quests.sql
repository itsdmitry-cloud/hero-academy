-- =============================================
-- Hero Academy — Quest System
-- =============================================

-- Quests (homework, dungeons, boss fights)
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type quest_type NOT NULL DEFAULT 'quest',
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL, -- "Математика", "Русский язык", etc.
  difficulty difficulty NOT NULL DEFAULT 'medium',
  xp_reward INT NOT NULL DEFAULT 100,
  gold_reward INT NOT NULL DEFAULT 10,
  hp_damage INT NOT NULL DEFAULT 10, -- damage per mistake
  deadline TIMESTAMPTZ,
  status quest_status NOT NULL DEFAULT 'draft',
  max_attempts INT NOT NULL DEFAULT 1,
  -- For teacher grading (grade on 5-point scale)
  grade_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quest Stages (for multi-step dungeons)
CREATE TABLE quest_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  title TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'multiple_choice',
  question_data JSONB NOT NULL DEFAULT '{}', -- question content, choices, correct answer
  xp_partial INT NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (quest_id, order_index)
);

-- Quest Attempts (student submissions)
CREATE TABLE quest_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  status attempt_status NOT NULL DEFAULT 'in_progress',
  current_stage INT DEFAULT 0,
  answers JSONB DEFAULT '[]', -- array of answers submitted
  correct_count INT NOT NULL DEFAULT 0,
  mistake_count INT NOT NULL DEFAULT 0,
  xp_earned INT NOT NULL DEFAULT 0,
  gold_earned INT NOT NULL DEFAULT 0,
  hp_lost INT NOT NULL DEFAULT 0,
  -- Teacher grade (5-point scale)
  grade INT CHECK (grade >= 1 AND grade <= 5),
  teacher_comment TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ
);

-- Boss Events
CREATE TABLE boss_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id UUID REFERENCES quests(id) ON DELETE SET NULL,
  boss_name TEXT NOT NULL,
  boss_avatar TEXT, -- asset path
  boss_hp INT NOT NULL DEFAULT 1000,
  boss_hp_current INT NOT NULL DEFAULT 1000,
  timer_minutes INT NOT NULL DEFAULT 60,
  status boss_status NOT NULL DEFAULT 'pending',
  rewards JSONB DEFAULT '{}', -- {xp, gold, artifact_ids}
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Boss Participants
CREATE TABLE boss_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_event_id UUID NOT NULL REFERENCES boss_events(id) ON DELETE CASCADE,
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  damage_dealt INT NOT NULL DEFAULT 0,
  hp_lost INT NOT NULL DEFAULT 0,
  answers_correct INT NOT NULL DEFAULT 0,
  answers_wrong INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (boss_event_id, hero_id)
);
