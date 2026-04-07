import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const body = await req.json();
  const { display_name, role, school_id, class_id, password, email: rawEmail } = body as {
    display_name: string;
    role: 'student' | 'teacher' | 'parent' | 'admin';
    school_id: string;
    class_id: string | null;
    password: string;
    email?: string;
    subjects?: string[];
    gender?: 'male' | 'female';
  };

  if (!display_name || !role || !school_id) {
    return NextResponse.json({ error: 'display_name, role, school_id required' }, { status: 400 });
  }

  // Use provided email or generate from display_name
  let email: string;
  if (rawEmail && rawEmail.trim()) {
    email = rawEmail.trim();
  } else {
    const slug = display_name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]/gi, '')
      .slice(0, 12) || 'user';
    const ts = Date.now().toString(36).slice(-4);
    email = `${slug}${ts}@hero.academy`;
  }
  const pwd = password || 'Hero2026!';

  try {
    // 1. Create auth user
    let authData;
    let authErr;
    
    const createResult = await admin.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true,
    });
    authData = createResult.data;
    authErr = createResult.error;

    // If email already registered, check if it's an orphan (no profile in users table)
    if (authErr?.message?.includes('already been registered')) {
      // Find existing auth user by email
      const { data: listData } = await admin.auth.admin.listUsers();
      const existingAuth = listData?.users?.find(u => u.email === email);
      
      if (existingAuth) {
        // Check if profile exists
        const { data: profile } = await admin.from('users').select('id, display_name').eq('id', existingAuth.id).single();
        
        if (!profile) {
          // Orphan auth account — delete and retry
          await admin.auth.admin.deleteUser(existingAuth.id);
          const retry = await admin.auth.admin.createUser({
            email,
            password: pwd,
            email_confirm: true,
          });
          authData = retry.data;
          authErr = retry.error;
        } else {
          return NextResponse.json({ 
            error: `Email ${email} уже используется пользователем "${profile.display_name}". Укажите другой email.` 
          }, { status: 400 });
        }
      }
    }

    if (authErr || !authData?.user) {
      return NextResponse.json({ error: authErr?.message ?? 'Auth creation failed' }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Create profile in users table
    const { error: profileErr } = await admin.from('users').upsert({
      id: userId,
      display_name,
      role,
      school_id,
      class_id: class_id || null,
      avatar_url: null,
      subjects: role === 'teacher' ? (body.subjects || []) : undefined,
    });

    if (profileErr) {
      // Cleanup: delete auth user
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Profile error: ${profileErr.message}` }, { status: 500 });
    }

    // 3. Create hero for students
    let heroId: string | null = null;
    if (role === 'student') {
      const level = Math.floor(Math.random() * 10) + 1;
      const xp = level * 400 + Math.floor(Math.random() * 400);
      const hp = Math.floor(Math.random() * 40) + 60;

      const { data: heroData, error: heroErr } = await admin.from('heroes').upsert({
        user_id: userId,
        name: display_name,
        gender: body.gender || 'male',
        level,
        xp,
        xp_to_next: level * (1000 + 250 * (level + 1)),  // cumulativeXpForLevel(level+1)
        hp,
        hp_max: 150,
        gold: Math.floor(Math.random() * 200),
        streak_current: Math.floor(Math.random() * 10),
        streak_best: Math.floor(Math.random() * 15),
        status: hp > 0 ? 'active' : 'inactive',
      }, { onConflict: 'user_id' }).select('id').single();

      if (heroErr) {
        return NextResponse.json({ error: `Hero error: ${heroErr.message}` }, { status: 500 });
      }
      heroId = heroData?.id ?? null;

      // Create hero_stats
      if (heroId) {
        await admin.from('hero_stats').upsert({
          hero_id: heroId,
          quests_completed: 0,
          bosses_defeated: 0,
          total_damage_dealt: 0,
          total_xp_earned: xp,
          total_gold_earned: 0,
        }, { onConflict: 'hero_id' });
      }
    }

    // 4. Create Subject Bosses if teacher has subjects
    if (role === 'teacher' && body.subjects && body.subjects.length > 0) {
      // Find all classes in this school
      const { data: classes } = await admin.from('classes').select('id').eq('school_id', school_id);
      
      // Find active season for this school
      const { data: activeSeason } = await admin.from('seasons')
        .select('id, starts_at, ends_at')
        .eq('school_id', school_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (classes && activeSeason) {
        for (const cls of classes) {
          for (const subjectName of body.subjects) {
            // Check if boss already exists
            const { data: existingBoss } = await admin.from('subject_bosses')
              .select('id')
              .eq('season_id', activeSeason.id)
              .eq('class_id', cls.id)
              .eq('subject_id', subjectName)
              .maybeSingle();

            if (!existingBoss) {
              // Calculate Boss HP
              const { count: studentCount } = await admin.from('users')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', cls.id)
                .eq('role', 'student');

              const students = studentCount || 10; // default 10 if empty
              const starts = new Date(activeSeason.starts_at);
              const ends = new Date(activeSeason.ends_at);
              const weeks = Math.max(1, Math.round((ends.getTime() - starts.getTime()) / (1000 * 60 * 60 * 24 * 7)));
              
              // Formula: students * lessons_per_week (3) * weeks * avg_dmg_per_lesson (20)
              const calculatedHp = Math.round(students * 3 * weeks * 20);

              await admin.from('subject_bosses').insert({
                season_id: activeSeason.id,
                class_id: cls.id,
                subject_id: subjectName,
                name: `Босс: ${subjectName}`,
                avatar: '🐉',
                max_hp: calculatedHp,
                current_hp: calculatedHp,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        display_name,
        role,
        hero_id: heroId,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
