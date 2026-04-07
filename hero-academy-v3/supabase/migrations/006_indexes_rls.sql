-- =============================================
-- Hero Academy — Performance Indexes + RLS Policies
-- =============================================

-- ========== INDEXES ==========

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_class ON users(class_id);
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_parent ON users(parent_id);

CREATE INDEX idx_heroes_user ON heroes(user_id);
CREATE INDEX idx_heroes_level ON heroes(level);
CREATE INDEX idx_heroes_status ON heroes(status);

CREATE INDEX idx_quests_class ON quests(class_id);
CREATE INDEX idx_quests_status ON quests(status);
CREATE INDEX idx_quests_subject ON quests(subject);

CREATE INDEX idx_quest_attempts_hero ON quest_attempts(hero_id);
CREATE INDEX idx_quest_attempts_quest ON quest_attempts(quest_id);
CREATE INDEX idx_quest_attempts_status ON quest_attempts(status);

CREATE INDEX idx_hero_artifacts_hero ON hero_artifacts(hero_id);
CREATE INDEX idx_hero_artifacts_artifact ON hero_artifacts(artifact_id);

CREATE INDEX idx_boss_events_class ON boss_events(class_id);
CREATE INDEX idx_boss_events_status ON boss_events(status);
CREATE INDEX idx_boss_participants_boss ON boss_participants(boss_event_id);
CREATE INDEX idx_boss_participants_hero ON boss_participants(hero_id);

CREATE INDEX idx_transactions_hero ON transactions(hero_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created ON transactions(created_at);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

CREATE INDEX idx_news_target_school ON news(target_school_id);
CREATE INDEX idx_news_target_class ON news(target_class_id);
CREATE INDEX idx_news_created ON news(created_at DESC);

CREATE INDEX idx_season_rankings_season ON season_rankings(season_id);

-- ========== ENABLE RLS ON ALL TABLES ==========

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements_unlocked ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES ==========

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: get user's class_id
CREATE OR REPLACE FUNCTION user_class_id()
RETURNS UUID AS $$
  SELECT class_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: get user's school_id
CREATE OR REPLACE FUNCTION user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- === USERS ===
CREATE POLICY users_own ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_teacher ON users FOR SELECT USING (class_id IN (
  SELECT id FROM classes WHERE teacher_id = auth.uid()
));
CREATE POLICY users_parent ON users FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY users_admin ON users FOR ALL USING (is_admin());

-- === SCHOOLS ===
CREATE POLICY schools_read ON schools FOR SELECT USING (true); -- all authenticated can read
CREATE POLICY schools_admin ON schools FOR ALL USING (is_admin());

-- === CLASSES ===
CREATE POLICY classes_read ON classes FOR SELECT USING (
  school_id = user_school_id() OR is_admin()
);
CREATE POLICY classes_admin ON classes FOR ALL USING (is_admin());

-- === HEROES ===
CREATE POLICY hero_own ON heroes FOR ALL USING (user_id = auth.uid());
CREATE POLICY hero_teacher ON heroes FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE class_id IN (
    SELECT id FROM classes WHERE teacher_id = auth.uid()
  ))
);
CREATE POLICY hero_parent ON heroes FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE parent_id = auth.uid())
);
CREATE POLICY hero_admin ON heroes FOR ALL USING (is_admin());

-- === HERO_STATS ===
CREATE POLICY hero_stats_own ON hero_stats FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY hero_stats_teacher ON hero_stats FOR SELECT USING (
  hero_id IN (SELECT h.id FROM heroes h JOIN users u ON h.user_id = u.id
    WHERE u.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
);
CREATE POLICY hero_stats_admin ON hero_stats FOR ALL USING (is_admin());

-- === QUESTS ===
CREATE POLICY quest_student ON quests FOR SELECT USING (class_id = user_class_id());
CREATE POLICY quest_teacher ON quests FOR ALL USING (created_by = auth.uid());
CREATE POLICY quest_admin ON quests FOR ALL USING (is_admin());

-- === QUEST_ATTEMPTS ===
CREATE POLICY attempt_own ON quest_attempts FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY attempt_teacher ON quest_attempts FOR SELECT USING (
  quest_id IN (SELECT id FROM quests WHERE created_by = auth.uid())
);
CREATE POLICY attempt_teacher_grade ON quest_attempts FOR UPDATE USING (
  quest_id IN (SELECT id FROM quests WHERE created_by = auth.uid())
);
CREATE POLICY attempt_admin ON quest_attempts FOR ALL USING (is_admin());

-- === BOSS_EVENTS ===
CREATE POLICY boss_student ON boss_events FOR SELECT USING (class_id = user_class_id());
CREATE POLICY boss_teacher ON boss_events FOR ALL USING (created_by = auth.uid());
CREATE POLICY boss_admin ON boss_events FOR ALL USING (is_admin());

-- === ARTIFACTS, SHOP, ACHIEVEMENTS, STREAK_REWARDS (read-only for all, admin CRUD) ===
CREATE POLICY artifacts_read ON artifacts FOR SELECT USING (true);
CREATE POLICY artifacts_admin ON artifacts FOR ALL USING (is_admin());

CREATE POLICY shop_read ON shop_items FOR SELECT USING (true);
CREATE POLICY shop_admin ON shop_items FOR ALL USING (is_admin());

CREATE POLICY achievements_read ON achievements FOR SELECT USING (true);
CREATE POLICY achievements_admin ON achievements FOR ALL USING (is_admin());

CREATE POLICY streak_rewards_read ON streak_rewards FOR SELECT USING (true);
CREATE POLICY streak_rewards_admin ON streak_rewards FOR ALL USING (is_admin());

-- === HERO_ARTIFACTS ===
CREATE POLICY inv_own ON hero_artifacts FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY inv_teacher ON hero_artifacts FOR SELECT USING (
  hero_id IN (SELECT h.id FROM heroes h JOIN users u ON h.user_id = u.id
    WHERE u.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
);
CREATE POLICY inv_admin ON hero_artifacts FOR ALL USING (is_admin());

-- === TRANSACTIONS ===
CREATE POLICY txn_own ON transactions FOR SELECT USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY txn_admin ON transactions FOR ALL USING (is_admin());

-- === NEWS ===
CREATE POLICY news_read ON news FOR SELECT USING (
  target_type = 'all'
  OR (target_type = 'school' AND target_school_id = user_school_id())
  OR (target_type = 'class' AND target_class_id = user_class_id())
  OR is_admin()
);
CREATE POLICY news_write ON news FOR INSERT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY news_admin ON news FOR ALL USING (is_admin());

CREATE POLICY news_reads_own ON news_reads FOR ALL USING (user_id = auth.uid());

-- === ACTIVITY_LOG ===
CREATE POLICY activity_own ON activity_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY activity_parent ON activity_log FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE parent_id = auth.uid())
);
CREATE POLICY activity_teacher ON activity_log FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE class_id IN (
    SELECT id FROM classes WHERE teacher_id = auth.uid()
  ))
);
CREATE POLICY activity_admin ON activity_log FOR ALL USING (is_admin());

-- === ECONOMY_CONFIG, CLASS_BALANCE ===
CREATE POLICY economy_read ON economy_config FOR SELECT USING (true);
CREATE POLICY economy_admin ON economy_config FOR ALL USING (is_admin());

CREATE POLICY balance_read ON class_balance FOR SELECT USING (true);
CREATE POLICY balance_admin ON class_balance FOR ALL USING (is_admin());

-- === GUILDS ===
CREATE POLICY guilds_read ON guilds FOR SELECT USING (true);
CREATE POLICY guilds_admin ON guilds FOR ALL USING (is_admin());

-- === SEASONS, RANKINGS ===
CREATE POLICY seasons_read ON seasons FOR SELECT USING (true);
CREATE POLICY seasons_admin ON seasons FOR ALL USING (is_admin());

CREATE POLICY rankings_read ON season_rankings FOR SELECT USING (true);
CREATE POLICY rankings_admin ON season_rankings FOR ALL USING (is_admin());

-- === SUBSCRIPTIONS ===
CREATE POLICY subs_admin ON subscriptions FOR ALL USING (is_admin());

-- === ACHIEVEMENTS_UNLOCKED ===
CREATE POLICY ach_own ON achievements_unlocked FOR SELECT USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY ach_admin ON achievements_unlocked FOR ALL USING (is_admin());

-- === STREAK_CLAIMS ===
CREATE POLICY streak_own ON streak_claims FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY streak_admin ON streak_claims FOR ALL USING (is_admin());

-- === BOSS_PARTICIPANTS ===
CREATE POLICY boss_part_own ON boss_participants FOR ALL USING (
  hero_id IN (SELECT id FROM heroes WHERE user_id = auth.uid())
);
CREATE POLICY boss_part_teacher ON boss_participants FOR SELECT USING (
  boss_event_id IN (SELECT id FROM boss_events WHERE created_by = auth.uid())
);
CREATE POLICY boss_part_admin ON boss_participants FOR ALL USING (is_admin());

-- === QUEST_STAGES ===
CREATE POLICY stages_student ON quest_stages FOR SELECT USING (
  quest_id IN (SELECT id FROM quests WHERE class_id = user_class_id())
);
CREATE POLICY stages_teacher ON quest_stages FOR ALL USING (
  quest_id IN (SELECT id FROM quests WHERE created_by = auth.uid())
);
CREATE POLICY stages_admin ON quest_stages FOR ALL USING (is_admin());
