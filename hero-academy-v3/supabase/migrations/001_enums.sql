-- =============================================
-- Hero Academy — All Enum Types
-- =============================================

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'parent', 'admin');
CREATE TYPE quest_type AS ENUM ('quest', 'dungeon', 'boss');
CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE quest_status AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE attempt_status AS ENUM ('in_progress', 'completed', 'failed');
CREATE TYPE boss_status AS ENUM ('pending', 'active', 'defeated', 'expired');
CREATE TYPE hero_status AS ENUM ('active', 'inactive');
CREATE TYPE rarity AS ENUM ('common', 'rare', 'epic', 'legendary');
CREATE TYPE effect_type AS ENUM ('xp_boost', 'hp_shield', 'skip_day', 'gold_bonus', 'damage_reduce', 'streak_protect');
CREATE TYPE shop_category AS ENUM ('hp_potion', 'xp_boost', 'artifact', 'cosmetic');
CREATE TYPE transaction_type AS ENUM ('purchase', 'reward', 'penalty', 'teacher_grant', 'admin_adjust');
CREATE TYPE season_status AS ENUM ('upcoming', 'active', 'ended');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'text_input', 'number_input');
CREATE TYPE artifact_source AS ENUM ('drop', 'shop', 'reward', 'teacher_gift');
CREATE TYPE news_type AS ENUM ('info', 'event', 'alert', 'reward');
CREATE TYPE news_target AS ENUM ('all', 'school', 'class');
