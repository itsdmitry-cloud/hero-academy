import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function createAuthUser(
  email: string, displayName: string, role: string,
  schoolId: string, classId?: string
) {
  let userId: string;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: 'Hero2026!', email_confirm: true,
  });
  if (error) {
    const { data: ex } = await supabaseAdmin.from('users').select('id').eq('email', email).single();
    if (!ex) throw new Error(`Auth ${email}: ${error.message}`);
    userId = ex.id;
  } else {
    userId = data.user!.id;
    const { error: pe } = await supabaseAdmin.from('users').insert({
      id: userId, email, display_name: displayName,
      role, school_id: schoolId, ...(classId ? { class_id: classId } : {}),
    });
    if (pe && !pe.message.includes('duplicate')) throw new Error(`Profile ${email}: ${pe.message}`);
  }
  return userId;
}

export async function POST() {
  const ts = Date.now().toString(36); // fresh unique suffix each call
  const log: string[] = [];

  try {
    // 1. School
    const { data: school, error: e1 } = await supabaseAdmin
      .from('schools').insert({ name: 'Школа №42' }).select().single();
    if (e1 || !school) throw new Error(`School: ${e1?.message}`);
    log.push(`✅ School ${school.id.slice(0,8)}`);

    // 2. Classes
    const { data: classA, error: e2a } = await supabaseAdmin
      .from('classes').insert({ school_id: school.id, name: '5А', invite_code: `5A${ts}` }).select().single();
    if (e2a || !classA) throw new Error(`Class 5А: ${e2a?.message}`);
    const { data: classB, error: e2b } = await supabaseAdmin
      .from('classes').insert({ school_id: school.id, name: '5Б', invite_code: `5B${ts}` }).select().single();
    if (e2b || !classB) throw new Error(`Class 5Б: ${e2b?.message}`);
    log.push(`✅ Classes 5А 5Б`);

    // 3. Admin + Teacher
    await createAuthUser(`admin${ts}@hero.academy`, 'Администратор', 'admin', school.id);
    const teacherId = await createAuthUser(`teacher${ts}@hero.academy`, 'Елена Петровна', 'teacher', school.id, classA.id);
    log.push(`✅ Admin & Teacher`);

    // 4. Students
    const studentsA = [
      { name: 'Артём Иванов',  email: `artem${ts}@hero.academy`,  xp: 8400,  hp: 85,  gold: 320, streak: 21, level: 20 },
      { name: 'Мила Смирнова', email: `mila${ts}@hero.academy`,   xp: 12100, hp: 100, gold: 540, streak: 14, level: 28 },
      { name: 'Кирилл Коваль', email: `kirill${ts}@hero.academy`, xp: 3200,  hp: 0,   gold: 80,  streak: 0,  level: 9  },
      { name: 'Аня Федорова',  email: `anya${ts}@hero.academy`,   xp: 9800,  hp: 72,  gold: 410, streak: 7,  level: 23 },
      { name: 'Данил Морозов', email: `danil${ts}@hero.academy`,  xp: 6750,  hp: 45,  gold: 190, streak: 3,  level: 16 },
    ];
    const studentsB = [
      { name: 'Соня Белова',  email: `sonya${ts}@hero.academy`, xp: 11200, hp: 95, gold: 480, streak: 18, level: 26 },
      { name: 'Макс Зайцев', email: `max${ts}@hero.academy`,   xp: 4500,  hp: 60, gold: 150, streak: 5,  level: 12 },
      { name: 'Лера Попова', email: `lera${ts}@hero.academy`,  xp: 7300,  hp: 88, gold: 280, streak: 11, level: 18 },
      { name: 'Саша Волков', email: `sasha${ts}@hero.academy`, xp: 2100,  hp: 30, gold: 60,  streak: 0,  level: 6  },
    ];

    const studentIdMap: Record<string, string> = {};

    const seedStudents = async (list: typeof studentsA, classId: string, label: string) => {
      for (const s of list) {
        const userId = await createAuthUser(s.email, s.name, 'student', school.id, classId);
        studentIdMap[s.email] = userId;

        // Hero — upsert to handle re-runs
        const { data: hero, error: he } = await supabaseAdmin.from('heroes')
          .upsert({
            user_id: userId, name: s.name.split(' ')[0],
            level: s.level, xp: s.xp, xp_to_next: s.level * (1000 + 250 * (s.level + 1)),
            hp: s.hp, hp_max: 150, gold: s.gold,
            streak_current: s.streak, streak_best: s.streak,
            status: s.hp > 0 ? 'active' : 'inactive',
          }, { onConflict: 'user_id' })
          .select().single();
        if (he || !hero) throw new Error(`Hero ${s.email}: ${he?.message}`);

        // Hero stats — upsert
        await supabaseAdmin.from('hero_stats').upsert({
          hero_id: hero.id,
          strength:  10 + Math.floor(s.xp / 1000),
          knowledge: 20 + Math.floor(s.level * 1.5),
          endurance: 15 + Math.floor(s.streak * 0.5),
          luck:      5  + Math.floor(Math.random() * 20),
          wisdom:    15 + Math.floor(s.level * 1.2),
        }, { onConflict: 'hero_id' });

        // Activity log (3 entries each)
        for (const act of [
          { action: 'quest_complete', metadata: { description: `${s.name} выполнил квест «Уравнения»` }, xp_change: 150, gold_change: 30 },
          { action: 'level_up',       metadata: { description: `Уровень ${s.level} достигнут!` },        xp_change: 0,   gold_change: 0  },
          { action: 'streak_reward',  metadata: { description: `Стрик ${s.streak} дней — награда!` },    xp_change: 50,  gold_change: 10 },
        ]) {
          await supabaseAdmin.from('activity_log').insert({
            user_id: userId, hero_id: hero.id,
            action: act.action, metadata: act.metadata,
            xp_change: act.xp_change, gold_change: act.gold_change,
          });
        }
        log.push(`  👤 ${s.name} [${label}] Lv${s.level} HP${s.hp}`);
      }
    };

    await seedStudents(studentsA, classA.id, '5А');
    await seedStudents(studentsB, classB.id, '5Б');

    // 5. Parents
    const parents = [
      { name: 'Ирина Иванова',   email: `p.artem${ts}@hero.academy`, child: `artem${ts}@hero.academy`  },
      { name: 'Ольга Смирнова',  email: `p.mila${ts}@hero.academy`,  child: `mila${ts}@hero.academy`   },
      { name: 'Светлана Белова', email: `p.sonya${ts}@hero.academy`, child: `sonya${ts}@hero.academy`  },
    ];
    for (const p of parents) {
      const parentId = await createAuthUser(p.email, p.name, 'parent', school.id);
      const childId = studentIdMap[p.child];
      if (childId) await supabaseAdmin.from('users').update({ parent_id: parentId }).eq('id', childId);
      log.push(`  👨‍👩‍👦 ${p.name} → ${p.child}`);
    }

    // 6. Quests
    const now = Date.now();
    for (const q of [
      { title: 'Квадратные уравнения', subject: 'Математика', type: 'quest',  difficulty: 'medium', xp_reward: 150, gold_reward: 30,  hp_damage: 10, deadline: new Date(now+3*86400000).toISOString(), class_id: classA.id },
      { title: 'Past Perfect Dungeon', subject: 'Английский', type: 'dungeon', difficulty: 'hard',   xp_reward: 300, gold_reward: 60,  hp_damage: 15, deadline: new Date(now+5*86400000).toISOString(), class_id: classA.id },
      { title: 'Законы Ньютона',       subject: 'Физика',     type: 'quest',  difficulty: 'medium', xp_reward: 180, gold_reward: 35,  hp_damage: 12, deadline: new Date(now+4*86400000).toISOString(), class_id: classB.id },
      { title: 'Дракон Истории',       subject: 'История',    type: 'boss',   difficulty: 'hard',   xp_reward: 500, gold_reward: 120, hp_damage: 20, deadline: new Date(now+7*86400000).toISOString(), class_id: classB.id },
    ]) {
      await supabaseAdmin.from('quests').insert({ ...q, status: 'active', created_by: teacherId });
    }
    log.push(`✅ 4 quests`);

    // 7. Season
    await supabaseAdmin.from('seasons').insert({
      school_id: school.id,
      name: 'Четверть 3 — Зима/Весна 2026',
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-03-28T00:00:00Z',
      status: 'active',
    });
    log.push(`✅ Season`);

    return NextResponse.json({
      success: true,
      message: '🎉 Данные созданы!',
      accounts: {
        admin:       `admin${ts}@hero.academy`,
        teacher:     `teacher${ts}@hero.academy`,
        students_5A: studentsA.map(s => s.email),
        students_5B: studentsB.map(s => s.email),
        parents:     parents.map(p => p.email),
        password:    'Hero2026!',
      },
      inviteCodes: { '5А': `5A${ts}`, '5Б': `5B${ts}` },
      log,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), log }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ info: 'POST /api/seed to create test data' });
}
