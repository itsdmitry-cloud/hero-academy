/**
 * Server-side helper: cascade-delete a school and all its users.
 *
 * Why this exists: `users.school_id → schools ON DELETE SET NULL` (see
 * `supabase/migrations/002_core.sql`), so a bare `DELETE FROM schools`
 * orphans every student/teacher. Auth users in `auth.users` also live
 * outside the public schema and must be removed explicitly via
 * `auth.admin.deleteUser`.
 *
 * This helper performs, in order:
 *   1. Fetch every `users` row with the target `school_id`
 *   2. For each user, the same teardown as `/api/admin/delete-user`:
 *      hero_stats → hero_artifacts → activity_log → heroes →
 *      quest_attempts → boss_participants → unlink parent_id refs →
 *      users row → auth user
 *   3. `DELETE FROM schools WHERE id = X`, which cascades to classes,
 *      seasons, season_bosses and news.target_school_id.
 *
 * Requires a service-role Supabase client — do NOT call from the browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CascadeDeleteSchoolResult {
  deleted_users: number;
}

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

  // 2. Tear down each user (mirrors /api/admin/delete-user).
  for (const uid of userIds) {
    const { data: hero } = await admin
      .from('heroes')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();

    if (hero) {
      await admin.from('hero_stats').delete().eq('hero_id', hero.id);
      await admin.from('hero_artifacts').delete().eq('hero_id', hero.id);
      await admin.from('activity_log').delete().eq('hero_id', hero.id);
      await admin.from('quest_attempts').delete().eq('hero_id', hero.id);
      await admin.from('boss_participants').delete().eq('hero_id', hero.id);
    }

    await admin.from('heroes').delete().eq('user_id', uid);
    await admin.from('users').update({ parent_id: null }).eq('parent_id', uid);
    await admin.from('users').delete().eq('id', uid);

    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(`auth delete ${uid}: ${authErr.message}`);
  }

  // 3. Delete the school. Cascade handles classes, seasons, season_bosses, news.
  const { error: schoolErr } = await admin.from('schools').delete().eq('id', schoolId);
  if (schoolErr) throw new Error(`delete school: ${schoolErr.message}`);

  return { deleted_users: userIds.length };
}
