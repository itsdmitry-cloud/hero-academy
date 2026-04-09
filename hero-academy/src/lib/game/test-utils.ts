import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS for test setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ test-utils.ts: Missing SUPABASE_SERVICE_ROLE_KEY in environment!');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Creates a complete sandbox for integration testing:
 * 1 School, 1 Class, 1 Teacher, N Students (with Heroes).
 */
export async function setupTestSandbox(testPrefix = 'TEST_SANDBOX') {
  const ts = Date.now();
  
  // 1. Create Teacher user
  const teacherId = `test-teacher-${ts}`;
  await supabaseAdmin.from('users').insert({
    id: teacherId,
    email: `teacher_${ts}@test.com`,
    role: 'teacher',
    display_name: `${testPrefix} Teacher`
  });

  // 2. Create School
  const { data: school } = await supabaseAdmin.from('schools').insert({
    name: `${testPrefix}_School_${ts}`,
    created_by: teacherId
  }).select('id').single();
  
  if (!school) throw new Error('Failed to create test school');

  // 3. Create Class
  const { data: cls } = await supabaseAdmin.from('classes').insert({
    school_id: school.id,
    teacher_id: teacherId,
    name: `${testPrefix} Class ${ts}`,
    invite_code: `CODE_${ts}`
  }).select('id').single();

  // Update teacher's class
  await supabaseAdmin.from('users').update({ school_id: school!.id, class_id: cls!.id }).eq('id', teacherId);

  // 4. Create Students and Heroes
  const studentIds: string[] = [];
  const heroIds: string[] = [];
  
  for (let i = 1; i <= 3; i++) {
    const sId = `test-student-${i}-${ts}`;
    studentIds.push(sId);
    
    await supabaseAdmin.from('users').insert({
      id: sId,
      email: `student_${i}_${ts}@test.com`,
      role: 'student',
      display_name: `Student ${i}`,
      class_id: cls!.id,
      school_id: school!.id
    });

    const { data: hero } = await supabaseAdmin.from('heroes').insert({
      user_id: sId,
      level: 5,
      xp: 1000,
      hp: 150,
      hp_max: 150,
      gold: 500
    }).select('id').single();
    
    heroIds.push(hero!.id);
  }

  return {
    schoolId: school!.id,
    classId: cls!.id,
    teacherId,
    studentIds,
    heroIds
  };
}

export interface TestSandbox {
  schoolId: string;
  classId: string;
  teacherId: string;
  studentIds: string[];
  heroIds: string[];
}

/**
 * Clears the sandbox. Since School has cascade deletes attached to classes and users,
 * we delete the school and manual users.
 */
export async function teardownTestSandbox(sandbox: TestSandbox | null | undefined) {
  if (!sandbox) return;
  // Delete heroes
  await supabaseAdmin.from('heroes').delete().in('id', sandbox.heroIds);
  // Delete users
  await supabaseAdmin.from('users').delete().in('id', [...sandbox.studentIds, sandbox.teacherId]);
  // Delete classes and school
  await supabaseAdmin.from('classes').delete().eq('id', sandbox.classId);
  await supabaseAdmin.from('schools').delete().eq('id', sandbox.schoolId);
}

/**
 * Creates a mock artifact in the DB and equips it to a hero.
 */
export async function equipTestArtifact(heroId: string, effect: string, value: number, max_charges: number | null = null, duration_days: number | null = null) {
  const ts = Date.now() + Math.floor(Math.random() * 10000);
  
  // 1. Create artifact template
  const { data: art } = await supabaseAdmin.from('artifacts').insert({
    name: `Test Artifact ${ts}`,
    effect_type: effect,
    effect: effect,
    effect_value: value,
    max_charges,
    duration_days,
    artifact_type: max_charges && !duration_days ? 'passive' : 'passive',
    can_equip: true,
    rarity: 'epic'
  }).select('id').single();

  // 2. Give to hero and equip
  const { data: ha } = await supabaseAdmin.from('hero_artifacts').insert({
    hero_id: heroId,
    artifact_id: art!.id,
    quantity: 1,
    is_equipped: true,
    charges_left: max_charges,
    expires_at: duration_days ? new Date(Date.now() + duration_days * 86400000).toISOString() : null
  }).select('id').single();

  return { artifactId: art!.id, heroArtifactId: ha!.id };
}
