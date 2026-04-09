/**
 * Integration test: cascade delete of a school and all its users.
 *
 * Creates throwaway school + class + 2 students (with heroes) + 1 teacher,
 * all tagged with a unique timestamp prefix. Then calls `cascadeDeleteSchool`
 * and asserts that every level of the hierarchy is gone:
 *   - schools row
 *   - classes rows (cascade)
 *   - public.users rows
 *   - auth.users rows
 *   - heroes rows
 *
 * Usage: npx tsx scripts/test-delete-school.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { cascadeDeleteSchool } from '../src/lib/server/delete-school';

config({ path: resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STAMP = Date.now().toString();
const TAG = `tdel${STAMP}`;

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function main() {
  console.log(`\n🧪 cascade delete school — tag: ${TAG}\n`);

  // 1. School
  const { data: school, error: schErr } = await admin
    .from('schools')
    .insert({ name: `${TAG}_school` })
    .select()
    .single();
  if (schErr || !school) return fail(`school create: ${schErr?.message}`);
  const schoolId = school.id as string;
  console.log(`  ✓ school ${schoolId}`);

  // 2. Class
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .insert({
      school_id: schoolId,
      name: `${TAG}_class`,
      invite_code: STAMP.slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase(),
    })
    .select()
    .single();
  if (clsErr || !cls) return fail(`class create: ${clsErr?.message}`);
  console.log(`  ✓ class ${cls.id}`);

  // 3. 2 students (auth + users + heroes) and 1 teacher
  const createdUsers: string[] = [];
  const makeUser = async (i: number, role: 'student' | 'teacher', classId: string | null) => {
    const email = `${TAG}${i}@hero.academy`;
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: 'Test1234!',
      email_confirm: true,
    });
    if (authErr || !authData.user) return fail(`auth create ${role}${i}: ${authErr?.message}`);
    const uid = authData.user.id;
    createdUsers.push(uid);

    const { error: uErr } = await admin.from('users').insert({
      id: uid,
      email,
      display_name: `${TAG}_${role}_${i}`,
      role,
      school_id: schoolId,
      class_id: classId,
    });
    if (uErr) return fail(`users insert ${role}${i}: ${uErr.message}`);
    // Heroes are auto-created by the `create_hero_for_student` trigger
    // (see supabase/migrations/007_triggers.sql).
  };

  await makeUser(1, 'student', cls.id as string);
  await makeUser(2, 'student', cls.id as string);
  await makeUser(3, 'teacher', null);
  console.log(`  ✓ ${createdUsers.length} users (2 students + 1 teacher) created`);

  // --- ACT ---
  const result = await cascadeDeleteSchool(admin, schoolId);
  console.log(`  → result: ${JSON.stringify(result)}`);

  // --- ASSERTIONS ---
  const { data: schoolCheck } = await admin.from('schools').select('id').eq('id', schoolId).maybeSingle();
  if (schoolCheck) return fail(`school still exists`);
  console.log(`  ✓ school deleted`);

  const { data: classCheck } = await admin.from('classes').select('id').eq('school_id', schoolId);
  if (classCheck && classCheck.length > 0) return fail(`${classCheck.length} classes remain`);
  console.log(`  ✓ classes cascaded`);

  const { data: userCheck } = await admin.from('users').select('id').in('id', createdUsers);
  if (userCheck && userCheck.length > 0) return fail(`${userCheck.length} public.users remain`);
  console.log(`  ✓ public.users deleted`);

  for (const uid of createdUsers) {
    const { data } = await admin.auth.admin.getUserById(uid);
    if (data?.user) return fail(`auth.user ${uid} still exists`);
  }
  console.log(`  ✓ auth.users deleted`);

  const { data: heroCheck } = await admin.from('heroes').select('id').in('user_id', createdUsers);
  if (heroCheck && heroCheck.length > 0) return fail(`${heroCheck.length} heroes remain`);
  console.log(`  ✓ heroes deleted`);

  if (result.deleted_users !== 3) {
    return fail(`expected deleted_users=3, got ${result.deleted_users}`);
  }
  console.log(`  ✓ deleted_users count = 3`);

  console.log(`\n✅ ALL ASSERTIONS PASSED\n`);
}

main().catch(e => {
  console.error('\n❌ Unhandled:', e);
  process.exit(1);
});
