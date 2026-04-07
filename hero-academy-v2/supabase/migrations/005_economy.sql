-- =============================================
-- Hero Academy — Shop, Transactions, News, Activity, Economy
-- =============================================

-- Shop Items
CREATE TABLE shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category shop_category NOT NULL,
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  price_gold INT NOT NULL DEFAULT 100,
  icon TEXT,
  effect_value INT NOT NULL DEFAULT 0, -- e.g. +25 HP
  is_available BOOLEAN DEFAULT true,
  req_level INT NOT NULL DEFAULT 1,
  stock_limit INT, -- null = infinite
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (all gold/xp/hp movements)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  item_type TEXT NOT NULL, -- "xp", "gold", "hp", "artifact"
  amount INT NOT NULL, -- positive or negative
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- News
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type news_type NOT NULL DEFAULT 'info',
  target_type news_target NOT NULL DEFAULT 'all',
  target_school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  target_class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  pinned BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- News Read Status
CREATE TABLE news_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (news_id, user_id)
);

-- Activity Log (all events for analytics)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- "quest_complete", "boss_hit", "purchase", "login", etc.
  metadata JSONB DEFAULT '{}',
  xp_change INT DEFAULT 0,
  hp_change INT DEFAULT 0,
  gold_change INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Economy Config (admin-controlled balance settings)
CREATE TABLE economy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, -- e.g. "xp_per_quest_easy"
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Class Balance Config (per-class economy overrides from admin)
CREATE TABLE class_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID UNIQUE NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  xp_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  damage_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  gold_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  drop_rate_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions (for revenue tracking)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'basic',
  price_monthly INT NOT NULL DEFAULT 500, -- in rubles
  months INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
