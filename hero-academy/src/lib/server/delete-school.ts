/**
 * Server-side helper: cascade-delete a school and all its users.
 *
 * Relies on the FK cascades defined in `supabase/migrations/`:
 *   - `public.users.id → auth.users.id ON DELETE CASCADE`
 *   - `heroes.user_id → users.id ON DELETE CASCADE`
 *   - every `*.hero_id → heroes.id ON DELETE CASCADE` (hero_stats,
 *     hero_artifacts, activity_log, quest_attempts, boss_participants,
 *     transactions, hero_season_rewards, achievements_unlocked,
 *     boss_damage_logs, streak_rewards_unlocked, ...)
 *   - `classes.school_id / seasons.school_id / subject_bosses.school_id
 *     / subscriptions.school_id / news.target_school_id → schools.id
 *     ON DELETE CASCADE`
 *
 * What *doesn't* cascade: `users.school_id → schools ON DELETE SET NULL`
 * (so a bare `DELETE FROM schools` orphans users) and `auth.users` lives
 * outside the public schema. So we must:
 *   1. Delete each auth user first (cascades public.users → heroes → *)
 *   2. Delete the school (cascades everything attached at school level)
 *
 * Auth deletes run in small parallel batches to stay fast even on schools
 * with many students (e.g. a seeded demo class) without hitting Supabase
 * admin API limits.
 *
 * Requires a service-role Supabase client — do NOT call from the browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CascadeDeleteSchoolResult {
  deleted_users: number;
}

const AUTH_DELETE_BATCH_SIZE = 5;

export async function cascadeDeleteSchool(
  admin: SupabaseClient,
  schoolId: string,
): Promise<CascadeDeleteSchoolResult> {
  if (!schoolId) throw new Error('schoolId required');

  // 1. Collect every user attached to the school.
  const { data: schoolUsers, error: usersErr } = await admin
    .from('users')
    .select('id')
    .eq('school_id', schoolId);
  if (usersErr) throw new Error(`fetch users: ${usersErr.message}`);

  const userIds = (schoolUsers ?? []).map((u: { id: string }) => u.id);

  // 2. Unlink parent references before deleting (parent_id → users ON DELETE SET NULL
  // is safe, but doing it explicitly in a single update beats N cascaded updates).
  if (userIds.length > 0) {
    const { error: unlinkErr } = await admin
      .from('users')
      .update({ parent_id: null })
      .in('parent_id', userIds);
    if (unlinkErr) throw new Error(`unlink parents: ${unlinkErr.message}`);
  }

  // 3. Delete auth users in parallel batches. Each auth delete cascades
  // public.users → heroes → (hero_stats, hero_artifacts, activity_log,
  // quest_attempts, boss_participants, transactions, hero_season_rewards,
  // achievements_unlocked, boss_damage_logs) automatically.
  for (let i = 0; i < userIds.length; i += AUTH_DELETE_BATCH_SIZE) {
    const batch = userIds.slice(i, i + AUTH_DELETE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(uid => admin.auth.admin.deleteUser(uid)),
    );
    for (let j = 0; j < results.length; j++) {
      const err = results[j].error;
      if (!err) continue;
      // Ignore "User not found" — means auth.users was already cleaned up
      // by a previous attempt; public.users row will be removed below.
      if (err.message?.toLowerCase().includes('not found')) continue;
      throw new Error(`auth delete ${batch[j]}: ${err.message}`);
    }
  }

  // 4. Remove any public.users rows that survived (shouldn't happen in
  // a healthy DB, but previous failed runs can leave orphaned profiles
  // whose auth counterpart is already gone).
  if (userIds.length > 0) {
    const { error: orphanErr } = await admin
      .from('users')
      .delete()
      .in('id', userIds);
    if (orphanErr) throw new Error(`delete orphan users: ${orphanErr.message}`);
  }

  // 5. Delete the school. Cascades: classes → quests/quest_attempts,
  // seasons → subject_bosses → boss_damage_logs, news, subscriptions.
  const { error: schoolErr } = await admin
    .from('schools')
    .delete()
    .eq('id', schoolId);
  if (schoolErr) throw new Error(`delete school: ${schoolErr.message}`);

  return { deleted_users: userIds.length };
}
