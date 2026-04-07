# Hero Academy — Database Schema

> Generated: 2026-03-28T04:31:10.131Z
> Project ref: `gjezmurskhjngbostltn`

---

## Tables (31)

- [`achievements`](#achievements)
- [`achievements_unlocked`](#achievements_unlocked)
- [`activity_log`](#activity_log)
- [`artifacts`](#artifacts)
- [`boss_damage_logs`](#boss_damage_logs)
- [`boss_events`](#boss_events)
- [`boss_participants`](#boss_participants)
- [`classes`](#classes)
- [`economy_audit_log`](#economy_audit_log)
- [`economy_config`](#economy_config)
- [`guilds`](#guilds)
- [`hero_artifacts`](#hero_artifacts)
- [`hero_stats`](#hero_stats)
- [`heroes`](#heroes)
- [`news`](#news)
- [`news_reads`](#news_reads)
- [`quest_attempts`](#quest_attempts)
- [`quest_stages`](#quest_stages)
- [`quests`](#quests)
- [`schools`](#schools)
- [`season_leaderboards`](#season_leaderboards)
- [`season_rankings`](#season_rankings)
- [`seasons`](#seasons)
- [`shop_items`](#shop_items)
- [`streak_claims`](#streak_claims)
- [`streak_rewards`](#streak_rewards)
- [`subject_bosses`](#subject_bosses)
- [`subjects`](#subjects)
- [`subscriptions`](#subscriptions)
- [`transactions`](#transactions)
- [`users`](#users)

---

## `achievements`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | — |
| `description` | `text` | YES | — |
| `icon` | `text` | NO | — |
| `condition_type` | `text` | NO | — |
| `condition_value` | `integer` | NO | — |
| `xp_reward` | `integer` | NO | 0 |
| `gold_reward` | `integer` | NO | 0 |

## `achievements_unlocked`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `hero_id` | `uuid` | NO | — |
| `achievement_id` | `uuid` | NO | — |
| `unlocked_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `achievement_id` → `achievements.id`
- `hero_id` → `heroes.id`

## `activity_log`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `user_id` | `uuid` | NO | — |
| `hero_id` | `uuid` | YES | — |
| `action` | `text` | NO | — |
| `metadata` | `jsonb` | YES | '{}'::jsonb |
| `xp_change` | `integer` | YES | 0 |
| `hp_change` | `integer` | YES | 0 |
| `gold_change` | `integer` | YES | 0 |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `hero_id` → `heroes.id`
- `user_id` → `users.id`

## `artifacts`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | — |
| `description` | `text` | YES | — |
| `rarity` | `USER-DEFINED` | NO | 'common'::rarity |
| `icon` | `text` | YES | — |
| `effect_type` | `USER-DEFINED` | NO | — |
| `effect_value` | `integer` | NO | 0 |
| `duration_hours` | `integer` | YES | 0 |
| `drop_rate` | `numeric` | NO | 0.1 |
| `season_id` | `uuid` | YES | — |
| `stackable` | `boolean` | YES | false |
| `max_charges` | `integer` | YES | 1 |
| `is_shopable` | `boolean` | YES | false |
| `created_at` | `timestamp with time zone` | YES | now() |
| `effect` | `text` | YES | ''::text |
| `min_level` | `integer` | YES | 1 |
| `artifact_type` | `text` | YES | 'passive'::text |

**Foreign Keys:**
- `season_id` → `seasons.id`

## `boss_damage_logs`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `boss_id` | `uuid` | NO | — |
| `hero_id` | `uuid` | NO | — |
| `damage_dealt` | `integer` | NO | — |
| `action_type` | `text` | NO | — |
| `created_at` | `timestamp with time zone` | NO | timezone('utc'::text, now()) |

**Foreign Keys:**
- `boss_id` → `subject_bosses.id`
- `hero_id` → `heroes.id`

## `boss_events`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `class_id` | `uuid` | NO | — |
| `created_by` | `uuid` | NO | — |
| `quest_id` | `uuid` | YES | — |
| `boss_name` | `text` | NO | — |
| `boss_avatar` | `text` | YES | — |
| `boss_hp` | `integer` | NO | 1000 |
| `boss_hp_current` | `integer` | NO | 1000 |
| `timer_minutes` | `integer` | NO | 60 |
| `status` | `USER-DEFINED` | NO | 'pending'::boss_status |
| `rewards` | `jsonb` | YES | '{}'::jsonb |
| `started_at` | `timestamp with time zone` | YES | — |
| `ended_at` | `timestamp with time zone` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `class_id` → `classes.id`
- `created_by` → `users.id`
- `quest_id` → `quests.id`

## `boss_participants`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `boss_event_id` | `uuid` | NO | — |
| `hero_id` | `uuid` | NO | — |
| `damage_dealt` | `integer` | NO | 0 |
| `hp_lost` | `integer` | NO | 0 |
| `answers_correct` | `integer` | NO | 0 |
| `answers_wrong` | `integer` | NO | 0 |
| `joined_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `boss_event_id` → `boss_events.id`
- `hero_id` → `heroes.id`

## `classes`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `school_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `teacher_id` | `uuid` | YES | — |
| `invite_code` | `text` | NO | substr(md5((random())::text), 1, 6) |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `school_id` → `schools.id`
- `teacher_id` → `users.id`

## `economy_audit_log`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `scope_key` | `text` | NO | — |
| `scope_label` | `text` | NO | — |
| `old_value` | `jsonb` | YES | — |
| `new_value` | `jsonb` | NO | — |
| `changed_by` | `text` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |

## `economy_config`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `key` | `text` | NO | — |
| `value` | `jsonb` | NO | '{}'::jsonb |
| `updated_by` | `uuid` | YES | — |
| `updated_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `updated_by` → `users.id`

## `guilds`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `class_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `banner_url` | `text` | YES | — |
| `total_xp` | `bigint` | NO | 0 |
| `total_quests` | `integer` | NO | 0 |
| `total_bosses` | `integer` | NO | 0 |
| `streak_current` | `integer` | NO | 0 |
| `streak_best` | `integer` | NO | 0 |
| `season_id` | `uuid` | YES | — |
| `updated_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `class_id` → `classes.id`
- `season_id` → `seasons.id`

## `hero_artifacts`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `hero_id` | `uuid` | NO | — |
| `artifact_id` | `uuid` | NO | — |
| `slot_index` | `integer` | YES | — |
| `is_equipped` | `boolean` | YES | false |
| `quantity` | `integer` | NO | 1 |
| `charges_remaining` | `integer` | YES | 1 |
| `acquired_at` | `timestamp with time zone` | YES | now() |
| `expires_at` | `timestamp with time zone` | YES | — |
| `source` | `USER-DEFINED` | NO | 'drop'::artifact_source |

**Foreign Keys:**
- `artifact_id` → `artifacts.id`
- `hero_id` → `heroes.id`

## `hero_stats`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `hero_id` | `uuid` | NO | — |
| `strength` | `integer` | NO | 10 |
| `knowledge` | `integer` | NO | 10 |
| `endurance` | `integer` | NO | 10 |
| `luck` | `integer` | NO | 10 |
| `wisdom` | `integer` | NO | 10 |

**Foreign Keys:**
- `hero_id` → `heroes.id`

## `heroes`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `user_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `level` | `integer` | NO | 1 |
| `xp` | `integer` | NO | 0 |
| `xp_to_next` | `integer` | NO | 100 |
| `hp` | `integer` | NO | 100 |
| `hp_max` | `integer` | NO | 100 |
| `gold` | `integer` | NO | 0 |
| `streak_current` | `integer` | NO | 0 |
| `streak_best` | `integer` | NO | 0 |
| `streak_last_date` | `date` | YES | — |
| `streak_protected` | `boolean` | YES | false |
| `status` | `USER-DEFINED` | YES | 'active'::hero_status |
| `artifact_slots` | `integer` | NO | 1 |
| `avatar_config` | `jsonb` | YES | '{}'::jsonb |
| `season_id` | `uuid` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `gender` | `text` | YES | 'male'::text |

**Foreign Keys:**
- `season_id` → `seasons.id`
- `user_id` → `users.id`

## `news`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `title` | `text` | NO | — |
| `body` | `text` | NO | — |
| `type` | `USER-DEFINED` | NO | 'info'::news_type |
| `target_type` | `USER-DEFINED` | NO | 'all'::news_target |
| `target_school_id` | `uuid` | YES | — |
| `target_class_id` | `uuid` | YES | — |
| `pinned` | `boolean` | YES | false |
| `created_by` | `uuid` | NO | — |
| `created_at` | `timestamp with time zone` | YES | now() |
| `image_url` | `text` | YES | — |

**Foreign Keys:**
- `created_by` → `users.id`
- `target_class_id` → `classes.id`
- `target_school_id` → `schools.id`

## `news_reads`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `news_id` | `uuid` | NO | — |
| `user_id` | `uuid` | NO | — |
| `read_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `news_id` → `news.id`
- `user_id` → `users.id`

## `quest_attempts`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `quest_id` | `uuid` | NO | — |
| `hero_id` | `uuid` | NO | — |
| `status` | `USER-DEFINED` | NO | 'in_progress'::attempt_status |
| `current_stage` | `integer` | YES | 0 |
| `answers` | `jsonb` | YES | '[]'::jsonb |
| `correct_count` | `integer` | NO | 0 |
| `mistake_count` | `integer` | NO | 0 |
| `xp_earned` | `integer` | NO | 0 |
| `gold_earned` | `integer` | NO | 0 |
| `hp_lost` | `integer` | NO | 0 |
| `grade` | `integer` | YES | — |
| `teacher_comment` | `text` | YES | — |
| `started_at` | `timestamp with time zone` | YES | now() |
| `completed_at` | `timestamp with time zone` | YES | — |
| `graded_at` | `timestamp with time zone` | YES | — |

**Foreign Keys:**
- `hero_id` → `heroes.id`
- `quest_id` → `quests.id`

## `quest_stages`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `quest_id` | `uuid` | NO | — |
| `order_index` | `integer` | NO | — |
| `title` | `text` | NO | — |
| `question_type` | `USER-DEFINED` | NO | 'multiple_choice'::question_type |
| `question_data` | `jsonb` | NO | '{}'::jsonb |
| `xp_partial` | `integer` | NO | 25 |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `quest_id` → `quests.id`

## `quests`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `class_id` | `uuid` | NO | — |
| `created_by` | `uuid` | NO | — |
| `type` | `USER-DEFINED` | NO | 'quest'::quest_type |
| `title` | `text` | NO | — |
| `description` | `text` | YES | — |
| `subject` | `text` | NO | — |
| `difficulty` | `USER-DEFINED` | NO | 'medium'::difficulty |
| `xp_reward` | `integer` | NO | 100 |
| `gold_reward` | `integer` | NO | 10 |
| `hp_damage` | `integer` | NO | 10 |
| `deadline` | `timestamp with time zone` | YES | — |
| `status` | `USER-DEFINED` | NO | 'draft'::quest_status |
| `max_attempts` | `integer` | NO | 1 |
| `grade_enabled` | `boolean` | YES | true |
| `created_at` | `timestamp with time zone` | YES | now() |
| `context` | `text` | NO | 'homework'::text |

**Foreign Keys:**
- `class_id` → `classes.id`
- `created_by` → `users.id`

## `schools`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | — |
| `created_by` | `uuid` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `created_by` → `users.id`

## `season_leaderboards`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `season_id` | `uuid` | NO | — |
| `hero_id` | `uuid` | NO | — |
| `user_id` | `uuid` | YES | — |
| `hero_name` | `text` | YES | — |
| `level` | `integer` | YES | 1 |
| `xp` | `integer` | YES | 0 |
| `gold` | `integer` | YES | 0 |
| `rank` | `integer` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `hero_id` → `heroes.id`
- `season_id` → `seasons.id`
- `user_id` → `users.id`

## `season_rankings`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `season_id` | `uuid` | NO | — |
| `entity_type` | `text` | NO | — |
| `entity_id` | `uuid` | NO | — |
| `rank` | `integer` | NO | — |
| `xp_total` | `bigint` | NO | 0 |
| `score` | `integer` | NO | 0 |
| `rewards_given` | `jsonb` | YES | '{}'::jsonb |

**Foreign Keys:**
- `season_id` → `seasons.id`

## `seasons`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `school_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `starts_at` | `timestamp with time zone` | NO | — |
| `ends_at` | `timestamp with time zone` | NO | — |
| `status` | `USER-DEFINED` | YES | 'upcoming'::season_status |
| `created_by` | `uuid` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |
| `is_active` | `boolean` | NO | false |

**Foreign Keys:**
- `created_by` → `users.id`
- `school_id` → `schools.id`

## `shop_items`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | — |
| `description` | `text` | YES | — |
| `category` | `USER-DEFINED` | NO | — |
| `artifact_id` | `uuid` | YES | — |
| `price_gold` | `integer` | NO | 100 |
| `icon` | `text` | YES | — |
| `effect_value` | `integer` | NO | 0 |
| `is_available` | `boolean` | YES | true |
| `req_level` | `integer` | NO | 1 |
| `stock_limit` | `integer` | YES | — |
| `season_id` | `uuid` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `artifact_id` → `artifacts.id`
- `season_id` → `seasons.id`

## `streak_claims`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `hero_id` | `uuid` | NO | — |
| `streak_reward_id` | `uuid` | NO | — |
| `claimed_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `hero_id` → `heroes.id`
- `streak_reward_id` → `streak_rewards.id`

## `streak_rewards`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `day_threshold` | `integer` | NO | — |
| `xp_bonus` | `integer` | NO | 0 |
| `gold_bonus` | `integer` | NO | 0 |
| `artifact_id` | `uuid` | YES | — |
| `description` | `text` | YES | — |

**Foreign Keys:**
- `artifact_id` → `artifacts.id`

## `subject_bosses`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `season_id` | `uuid` | NO | — |
| `class_id` | `uuid` | NO | — |
| `subject_id` | `text` | NO | — |
| `name` | `text` | NO | — |
| `avatar` | `text` | YES | '🐉'::text |
| `max_hp` | `integer` | NO | 15000 |
| `current_hp` | `integer` | NO | 15000 |
| `is_defeated` | `boolean` | NO | false |
| `created_at` | `timestamp with time zone` | NO | timezone('utc'::text, now()) |

**Foreign Keys:**
- `class_id` → `classes.id`
- `season_id` → `seasons.id`

## `subjects`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `name` | `text` | NO | — |
| `created_at` | `timestamp with time zone` | YES | now() |

## `subscriptions`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `school_id` | `uuid` | NO | — |
| `plan_name` | `text` | NO | 'basic'::text |
| `price_monthly` | `integer` | NO | 500 |
| `months` | `integer` | NO | 1 |
| `status` | `text` | NO | 'active'::text |
| `starts_at` | `timestamp with time zone` | NO | now() |
| `ends_at` | `timestamp with time zone` | NO | — |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `school_id` → `schools.id`

## `transactions`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | gen_random_uuid() |
| `hero_id` | `uuid` | NO | — |
| `type` | `USER-DEFINED` | NO | — |
| `item_type` | `text` | NO | — |
| `amount` | `integer` | NO | — |
| `shop_item_id` | `uuid` | YES | — |
| `description` | `text` | YES | — |
| `created_by` | `uuid` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |

**Foreign Keys:**
- `created_by` → `users.id`
- `hero_id` → `heroes.id`
- `shop_item_id` → `shop_items.id`

## `users`

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | NO | — |
| `email` | `text` | YES | — |
| `display_name` | `text` | NO | — |
| `role` | `USER-DEFINED` | NO | 'student'::user_role |
| `avatar_url` | `text` | YES | — |
| `school_id` | `uuid` | YES | — |
| `class_id` | `uuid` | YES | — |
| `parent_id` | `uuid` | YES | — |
| `created_at` | `timestamp with time zone` | YES | now() |
| `updated_at` | `timestamp with time zone` | YES | now() |
| `subjects` | `ARRAY` | YES | '{}'::text[] |

**Foreign Keys:**
- `class_id` → `classes.id`
- `parent_id` → `users.id`
- `school_id` → `schools.id`

---

## Indexes

**`achievements_unlocked`**: `achievements_unlocked_hero_id_achievement_id_key`

**`activity_log`**: `idx_activity_log_action`, `idx_activity_log_created`, `idx_activity_log_hero_created`, `idx_activity_log_user`

**`boss_damage_logs`**: `idx_boss_damage_boss_hero`, `idx_boss_dmg_logs_boss`

**`boss_events`**: `idx_boss_events_class`, `idx_boss_events_status`

**`boss_participants`**: `boss_participants_boss_event_id_hero_id_key`, `idx_boss_participants_boss`, `idx_boss_participants_hero`

**`classes`**: `classes_invite_code_key`

**`economy_audit_log`**: `idx_economy_audit_created`

**`economy_config`**: `economy_config_key_key`

**`guilds`**: `guilds_class_id_key`

**`hero_artifacts`**: `idx_hero_artifacts_artifact`, `idx_hero_artifacts_hero`, `idx_hero_artifacts_hero_id`

**`heroes`**: `heroes_user_id_key`, `idx_heroes_level`, `idx_heroes_status`, `idx_heroes_user`, `idx_heroes_user_id`, `idx_heroes_xp_desc`

**`news`**: `idx_news_created`, `idx_news_target_class`, `idx_news_target_school`

**`news_reads`**: `news_reads_news_id_user_id_key`

**`quest_attempts`**: `idx_quest_attempts_hero`, `idx_quest_attempts_quest`, `idx_quest_attempts_status`

**`quest_stages`**: `quest_stages_quest_id_order_index_key`

**`quests`**: `idx_quests_class`, `idx_quests_class_status`, `idx_quests_status`, `idx_quests_subject`

**`season_leaderboards`**: `idx_season_leaderboards_hero`, `idx_season_leaderboards_season`

**`season_rankings`**: `idx_season_rankings_season`

**`seasons`**: `idx_seasons_active`, `idx_seasons_school_id`

**`streak_claims`**: `streak_claims_hero_id_streak_reward_id_key`

**`streak_rewards`**: `streak_rewards_day_threshold_key`

**`subject_bosses`**: `idx_subj_bosses_class_season`, `idx_subject_bosses_class_season`

**`subjects`**: `subjects_name_key`

**`transactions`**: `idx_transactions_created`, `idx_transactions_hero`, `idx_transactions_type`

**`users`**: `idx_users_class`, `idx_users_class_id_role`, `idx_users_parent`, `idx_users_role`, `idx_users_school`, `idx_users_school_id_role`, `idx_users_subjects`, `users_email_key`

