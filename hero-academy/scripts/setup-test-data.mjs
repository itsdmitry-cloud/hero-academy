import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function getOrCreate(table, matchField, matchVal, insertData) {
  const { data } = await supabase.from(table).select('*').eq(matchField, matchVal).single();
  if (data) { console.log(`  ℹ️  ${table} exists: ${matchVal}`); return data; }
  const { data: created, error } = await supabase.from(table).insert(insertData).select('*').single();
  if (error) { console.error(`  ❌ ${table}:`, error.message); return null; }
  console.log(`  ✅ ${table} created: ${matchVal}`);
  return created;
}

async function createAuthUser(email, password, name) {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find(u => u.email === email);
  if (existing) { console.log(`  ℹ️  Auth: ${email}`); return existing.id; }
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: name }
  });
  if (error) { console.error(`  ❌ ${email}: ${error.message}`); return null; }
  console.log(`  ✅ Auth: ${email}`);
  return data.user.id;
}

async function main() {
  console.log('\n══════ HERO ACADEMY TEST SETUP ══════\n');

  // 1. School (no city column per schema)
  console.log('🏫 School...');
  const school = await getOrCreate('schools', 'name', 'Тестовая Школа', { name: 'Тестовая Школа' });
  if (!school) return;

  // 2. Class (no grade/guild_name: schema has name, school_id, invite_code, teacher_id)
  console.log('📚 Class...');
  const cls = await getOrCreate('classes', 'invite_code', 'TEST01', {
    school_id: school.id,
    name: '5-А Тестовые',
    invite_code: 'TEST01',
  });
  if (!cls) return;

  // 3. Season (schema: school_id, name, starts_at, ends_at, status)
  console.log('🗓️  Season...');
  const now = new Date();
  const { data: existSeason } = await supabase.from('seasons').select('id').eq('school_id', school.id).limit(1).single();
  let seasonId = existSeason?.id;
  if (!existSeason) {
    const { data: season, error } = await supabase.from('seasons').insert({
      school_id: school.id,
      name: 'Зима 2026',
      starts_at: '2026-01-10T00:00:00Z',
      ends_at: '2026-03-28T23:59:59Z',
      status: 'active',
    }).select('id').single();
    if (error) console.warn('  ⚠️  Season:', error.message);
    else { seasonId = season.id; console.log('  ✅ Season created'); }
  }

  // 4. Auth users
  console.log('\n👥 Auth users...');
  const authIds = {
    admin:    await createAuthUser('admin@hero.academy',    'Admin123!',    'Администратор'),
    teacher:  await createAuthUser('teacher@hero.academy',  'Teacher123!',  'Анна Учитель'),
    student:  await createAuthUser('student@hero.academy',  'Student123!',  'Артём Воин'),
    student2: await createAuthUser('student2@hero.academy', 'Student123!',  'Мила Маг'),
    parent:   await createAuthUser('parent@hero.academy',   'Parent123!',   'Иван Родитель'),
  };

  // 5. User table rows
  console.log('\n📝 User rows...');
  const rows = [
    { id: authIds.admin,    display_name: 'Администратор', role: 'admin',   school_id: school.id, class_id: null      },
    { id: authIds.teacher,  display_name: 'Анна Учитель',  role: 'teacher', school_id: school.id, class_id: cls.id    },
    { id: authIds.student,  display_name: 'Артём Воин',    role: 'student', school_id: school.id, class_id: cls.id    },
    { id: authIds.student2, display_name: 'Мила Маг',      role: 'student', school_id: school.id, class_id: cls.id    },
    { id: authIds.parent,   display_name: 'Иван Родитель', role: 'parent',  school_id: school.id, class_id: null      },
  ].filter(r => r.id);

  for (const row of rows) {
    const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
    if (error) console.error(`  ❌ ${row.display_name}: ${error.message}`);
    else console.log(`  ✅ ${row.display_name} (${row.role})`);
  }

  // 6. Link teacher to class
  if (authIds.teacher) {
    await supabase.from('classes').update({ teacher_id: authIds.teacher }).eq('id', cls.id);
    console.log('  ✅ Teacher assigned to class');
  }

  // 7. Heroes for students (schema: user_id, name, level, xp, xp_to_next, hp, hp_max, gold, streak_current, streak_best, status, artifact_slots)
  console.log('\n⚔️  Heroes...');
  const heroData = [
    { userId: authIds.student,  name: 'Артём Воин',   level: 5,  xp: 1500, xp_to_next: 2000, hp: 85,  gold: 250, streak_current: 3, streak_best: 7 },
    { userId: authIds.student2, name: 'Мила Маг',     level: 8,  xp: 5200, xp_to_next: 6000, hp: 100, gold: 480, streak_current: 7, streak_best: 14 },
  ];
  const heroIds = {};
  for (const h of heroData) {
    if (!h.userId) continue;
    const { data: existing } = await supabase.from('heroes').select('id').eq('user_id', h.userId).single();
    if (existing) { heroIds[h.userId] = existing.id; console.log(`  ℹ️  Hero exists: ${h.name}`); continue; }
    const { data: hero, error } = await supabase.from('heroes').insert({
      user_id: h.userId,
      name: h.name,
      level: h.level,
      xp: h.xp,
      xp_to_next: h.xp_to_next,
      hp: h.hp,
      hp_max: 100,
      gold: h.gold,
      streak_current: h.streak_current,
      streak_best: h.streak_best,
      streak_last_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      status: 'active',
      artifact_slots: 2,
      season_id: seasonId || null,
    }).select('id').single();
    if (error) { console.error(`  ❌ Hero ${h.name}: ${error.message}`); continue; }
    heroIds[h.userId] = hero.id;
    // Hero stats
    await supabase.from('hero_stats').upsert({ hero_id: hero.id, strength: 12, knowledge: 15, endurance: 10, luck: 8, wisdom: 11 }, { onConflict: 'hero_id' });
    console.log(`  ✅ Hero: ${h.name} (Lv${h.level})`);
  }

  // 8. Parent link
  if (authIds.parent && authIds.student) {
    await supabase.from('users').update({ parent_id: authIds.parent }).eq('id', authIds.student);
    console.log('  ✅ Parent linked to student');
  }

  // 9. Guild for class
  console.log('\n⚔️  Guild...');
  const { data: existGuild } = await supabase.from('guilds').select('id').eq('class_id', cls.id).single();
  if (!existGuild) {
    const { error } = await supabase.from('guilds').insert({ class_id: cls.id, name: 'Тестовые Герои', total_xp: 6700, season_id: seasonId || null });
    if (error) console.warn('  ⚠️  Guild:', error.message);
    else console.log('  ✅ Guild created');
  }

  // 10. Quests (schema from 003_quests.sql — check subject via view)
  console.log('\n⚔️  Quests...');
  const { data: existQuests } = await supabase.from('quests').select('id').eq('class_id', cls.id).limit(1);
  if (existQuests && existQuests.length > 0) {
    console.log(`  ℹ️  Quests exist (${existQuests.length})`);
  } else {
    const { error } = await supabase.from('quests').insert([
      { class_id: cls.id, title: 'Алгебра: Уравнения', subject: 'Математика', type: 'quest',   difficulty: 'medium',    xp_reward: 100, gold_reward: 20, hp_damage: 10, status: 'active', deadline: new Date(Date.now()+7*86400000).toISOString() },
      { class_id: cls.id, title: 'Диктант: Причастия',  subject: 'Русский',    type: 'dungeon', difficulty: 'hard',       xp_reward: 200, gold_reward: 40, hp_damage: 25, status: 'active', deadline: new Date(Date.now()+3*86400000).toISOString() },
      { class_id: cls.id, title: 'Тест: Законы Ньютона',subject: 'Физика',     type: 'boss',    difficulty: 'legendary',  xp_reward: 500, gold_reward:100, hp_damage: 50, status: 'active', deadline: new Date(Date.now()+2*86400000).toISOString() },
    ]);
    if (error) console.warn('  ⚠️  Quests:', error.message);
    else console.log('  ✅ 3 quests created');
  }

  // 11. Artifacts in hero inventory
  console.log('\n💎 Artifacts...');
  const { data: artDefs } = await supabase.from('artifact_definitions').select('id, name').limit(4);
  if (artDefs && artDefs.length > 0 && authIds.student && heroIds[authIds.student]) {
    for (const def of artDefs.slice(0, 3)) {
      const { error } = await supabase.from('hero_artifacts').upsert({
        hero_id: heroIds[authIds.student],
        definition_id: def.id,
        quantity: 2,
        charges_left: 2,
        is_equipped: false,
      }, { onConflict: 'hero_id,definition_id' });
      if (error) console.warn(`  ⚠️  artifact ${def.name}: ${error.message}`);
      else console.log(`  ✅ Added artifact: ${def.name}`);
    }
  } else {
    console.log('  ⚠️  No artifact_definitions — skipping');
  }

  console.log('\n══════════════════════════════════════');
  console.log('  🛡️  Admin:    admin@hero.academy     / Admin123!');
  console.log('  👩‍🏫 Teacher:  teacher@hero.academy   / Teacher123!');
  console.log('  🧙 Student:  student@hero.academy   / Student123!  (class TEST01, HP=85)');
  console.log('  🧝 Student2: student2@hero.academy  / Student123!  (class TEST01, HP=100)');
  console.log('  👨‍👩‍👧 Parent:   parent@hero.academy    / Parent123!   (linked to Артём)');
  console.log('══════════════════════════════════════\n');
}

main();
