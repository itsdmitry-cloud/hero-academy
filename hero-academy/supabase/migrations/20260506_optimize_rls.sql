-- =============================================
-- RLS Performance Optimization
-- =============================================
-- Применяет рекомендованную Supabase оптимизацию:
-- 1. auth.uid() → (SELECT auth.uid()) — Postgres кэширует результат
--    функции на весь запрос вместо вычисления для каждой строки.
-- 2. Helper-функции (is_admin, user_class_id, user_school_id) помечены
--    STABLE — позволяет планировщику закэшировать результат.
-- 3. Добавлен композитный индекс activity_log(hero_id, created_at DESC)
--    для useSupabaseSync — раньше шёл filter+sort вместо index scan.
--
-- Эффект: 2-10× ускорение SELECT'ов на heroes / hero_artifacts /
-- activity_log / quest_attempts / hero_stats / boss_participants /
-- transactions / streak_claims / achievements_unlocked / news.

-- ========== HELPER FUNCTIONS — STABLE + cached uid ==========

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION user_class_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT class_id FROM users WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION user_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM users WHERE id = (SELECT auth.uid());
$$;

-- ========== USERS ==========
DROP POLICY IF EXISTS users_own ON users;
DROP POLICY IF EXISTS users_teacher ON users;
DROP POLICY IF EXISTS users_parent ON users;
DROP POLICY IF EXISTS users_admin ON users;

CREATE POLICY users_own ON users FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY users_teacher ON users FOR SELECT USING (class_id IN (
  SELECT id FROM classes WHERE teacher_id = (SELECT auth.uid())
));
CREATE POLICY users_parent ON users FOR SELECT USING (parent_id = (SELECT auth.uid()));
CREATE POLICY users_admin ON users FOR ALL USING (is_admin());

-- ========== HEROES ==========
DROP POLICY IF EXISTS hero_own ON heroes;
DROP POLICY IF EXISTS hero_teacher ON heroes;
DROP POLICY IF EXISTS hero_parent ON heroes;
DROP POLICY IF EXISTS hero_admin ON heroes;

CREATE POLICY hero_own ON heroes FOR ALL USING (user_id = (SELECT auth.uid()));
CREATE POLICY hero_teacher ON heroes FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE class_id IN (
    SELECT id FROM classes WHERE teacher_id = (SELECT auth.uid())
  ))
);
CREATE POLICY hero_parent ON heroes FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE parent_id = (SELECT auth.uid()))
);
CREATE POLICY hero_admin ON heroes FOR ALL USING (is_admin());

-- ========== HERO_STATS ==========
DROP POLICY IF EXISTS hero_stats_own ON hero_stats;
DROP POLICY IF EXISTS hero_stats_teacher ON hero_stats;
DROP POLICY IF EXISTS hero_stats_admin ON hero_stats;

CREATE POLICY hero_stats_own ON hero_stats FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY hero_stats_teacher ON hero_stats FOR SELECT USING (
  hero_id IN (SELECT h.id FROM heroes h JOIN users u ON h.user_id = u.id
    WHERE u.class_id IN (SELECT id FROM classes WHERE teacher_id = (SELECT auth.uid())))
);
CREATE POLICY hero_stats_admin ON hero_stats FOR ALL USING (is_admin());

-- ========== QUESTS ==========
DROP POLICY IF EXISTS quest_student ON quests;
DROP POLICY IF EXISTS quest_teacher ON quests;
DROP POLICY IF EXISTS quest_admin ON quests;

CREATE POLICY quest_student ON quests FOR SELECT USING (class_id = user_class_id());
CREATE POLICY quest_teacher ON quests FOR ALL USING (created_by = (SELECT auth.uid()));
CREATE POLICY quest_admin ON quests FOR ALL USING (is_admin());

-- ========== QUEST_ATTEMPTS ==========
DROP POLICY IF EXISTS attempt_own ON quest_attempts;
DROP POLICY IF EXISTS attempt_teacher ON quest_attempts;
DROP POLICY IF EXISTS attempt_teacher_grade ON quest_attempts;
DROP POLICY IF EXISTS attempt_admin ON quest_attempts;

CREATE POLICY attempt_own ON quest_attempts FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY attempt_teacher ON quest_attempts FOR SELECT USING (
  quest_id IN (SELECT id FROM quests WHERE created_by = (SELECT auth.uid()))
);
CREATE POLICY attempt_teacher_grade ON quest_attempts FOR UPDATE USING (
  quest_id IN (SELECT id FROM quests WHERE created_by = (SELECT auth.uid()))
);
CREATE POLICY attempt_admin ON quest_attempts FOR ALL USING (is_admin());

-- ========== BOSS_EVENTS ==========
DROP POLICY IF EXISTS boss_student ON boss_events;
DROP POLICY IF EXISTS boss_teacher ON boss_events;
DROP POLICY IF EXISTS boss_admin ON boss_events;

CREATE POLICY boss_student ON boss_events FOR SELECT USING (class_id = user_class_id());
CREATE POLICY boss_teacher ON boss_events FOR ALL USING (created_by = (SELECT auth.uid()));
CREATE POLICY boss_admin ON boss_events FOR ALL USING (is_admin());

-- ========== HERO_ARTIFACTS ==========
DROP POLICY IF EXISTS inv_own ON hero_artifacts;
DROP POLICY IF EXISTS inv_teacher ON hero_artifacts;
DROP POLICY IF EXISTS inv_admin ON hero_artifacts;

CREATE POLICY inv_own ON hero_artifacts FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY inv_teacher ON hero_artifacts FOR SELECT USING (
  hero_id IN (SELECT h.id FROM heroes h JOIN users u ON h.user_id = u.id
    WHERE u.class_id IN (SELECT id FROM classes WHERE teacher_id = (SELECT auth.uid())))
);
CREATE POLICY inv_admin ON hero_artifacts FOR ALL USING (is_admin());

-- ========== TRANSACTIONS ==========
DROP POLICY IF EXISTS txn_own ON transactions;
DROP POLICY IF EXISTS txn_admin ON transactions;

CREATE POLICY txn_own ON transactions FOR SELECT USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY txn_admin ON transactions FOR ALL USING (is_admin());

-- ========== NEWS ==========
DROP POLICY IF EXISTS news_read ON news;
DROP POLICY IF EXISTS news_write ON news;
DROP POLICY IF EXISTS news_admin ON news;
DROP POLICY IF EXISTS news_reads_own ON news_reads;

CREATE POLICY news_read ON news FOR SELECT USING (
  target_type = 'all'
  OR (target_type = 'school' AND target_school_id = user_school_id())
  OR (target_type = 'class' AND target_class_id = user_class_id())
  OR is_admin()
);
CREATE POLICY news_write ON news FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('teacher', 'admin'))
);
CREATE POLICY news_admin ON news FOR ALL USING (is_admin());
CREATE POLICY news_reads_own ON news_reads FOR ALL USING (user_id = (SELECT auth.uid()));

-- ========== ACTIVITY_LOG ==========
DROP POLICY IF EXISTS activity_own ON activity_log;
DROP POLICY IF EXISTS activity_parent ON activity_log;
DROP POLICY IF EXISTS activity_teacher ON activity_log;
DROP POLICY IF EXISTS activity_admin ON activity_log;

CREATE POLICY activity_own ON activity_log FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY activity_parent ON activity_log FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE parent_id = (SELECT auth.uid()))
);
CREATE POLICY activity_teacher ON activity_log FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE class_id IN (
    SELECT id FROM classes WHERE teacher_id = (SELECT auth.uid())
  ))
);
CREATE POLICY activity_admin ON activity_log FOR ALL USING (is_admin());

-- ========== ACHIEVEMENTS_UNLOCKED ==========
DROP POLICY IF EXISTS ach_own ON achievements_unlocked;
DROP POLICY IF EXISTS ach_admin ON achievements_unlocked;

CREATE POLICY ach_own ON achievements_unlocked FOR SELECT USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY ach_admin ON achievements_unlocked FOR ALL USING (is_admin());

-- ========== STREAK_CLAIMS ==========
DROP POLICY IF EXISTS streak_own ON streak_claims;
DROP POLICY IF EXISTS streak_admin ON streak_claims;

CREATE POLICY streak_own ON streak_claims FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY streak_admin ON streak_claims FOR ALL USING (is_admin());

-- ========== BOSS_PARTICIPANTS ==========
DROP POLICY IF EXISTS boss_part_own ON boss_participants;
DROP POLICY IF EXISTS boss_part_teacher ON boss_participants;
DROP POLICY IF EXISTS boss_part_admin ON boss_participants;

CREATE POLICY boss_part_own ON boss_participants FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY boss_part_teacher ON boss_participants FOR SELECT USING (
  boss_event_id IN (SELECT id FROM boss_events WHERE created_by = (SELECT auth.uid()))
);
CREATE POLICY boss_part_admin ON boss_participants FOR ALL USING (is_admin());

-- ========== QUEST_STAGES ==========
DROP POLICY IF EXISTS stages_student ON quest_stages;
DROP POLICY IF EXISTS stages_teacher ON quest_stages;
DROP POLICY IF EXISTS stages_admin ON quest_stages;

CREATE POLICY stages_student ON quest_stages FOR SELECT USING (
  quest_id IN (SELECT id FROM quests WHERE class_id = user_class_id())
);
CREATE POLICY stages_teacher ON quest_stages FOR ALL USING (
  quest_id IN (SELECT id FROM quests WHERE created_by = (SELECT auth.uid()))
);
CREATE POLICY stages_admin ON quest_stages FOR ALL USING (is_admin());

-- ========== ADDITIONAL TABLES FROM LATER MIGRATIONS ==========
-- class_buffs (ClassAuraBanner), hero_collectibles, hero_season_rewards (BattlePassWidget)

DROP POLICY IF EXISTS "Class buffs are viewable by class members" ON class_buffs;
CREATE POLICY "Class buffs are viewable by class members" ON class_buffs FOR SELECT USING (
  class_id IN (SELECT class_id FROM users WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS hero_collectibles_select ON hero_collectibles;
CREATE POLICY hero_collectibles_select ON hero_collectibles FOR SELECT USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS hero_season_rewards_select ON hero_season_rewards;
CREATE POLICY hero_season_rewards_select ON hero_season_rewards FOR SELECT USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = (SELECT auth.uid()))
);

-- ========== MISSING INDEXES FOR HOT QUERIES ==========
-- useSupabaseSync делает: .eq('hero_id', ?).order('created_at', desc).limit(20)
-- Без композитного индекса Postgres делает filter + sort.
CREATE INDEX IF NOT EXISTS idx_activity_log_hero_created
  ON activity_log(hero_id, created_at DESC);

-- transactions queries часто фильтруются по hero_id с сортировкой
CREATE INDEX IF NOT EXISTS idx_transactions_hero_created
  ON transactions(hero_id, created_at DESC);

-- quests фильтруется по (class_id, status) с сортировкой по created_at
CREATE INDEX IF NOT EXISTS idx_quests_class_status_created
  ON quests(class_id, status, created_at DESC);

-- news_reads JOIN'ится с news по user_id и news_id
CREATE INDEX IF NOT EXISTS idx_news_reads_user_news
  ON news_reads(user_id, news_id);
