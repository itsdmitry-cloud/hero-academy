import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSubjects, escapeLikePattern } from '@/lib/utils/subjects';
import { calculateBossHp, weeksBetween } from '@/lib/game/boss-hp';
import { getEconomyConfig } from '@/lib/game/constants';

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

  // Нормализуем subjects один раз — дальше везде используется уже чистый массив.
  const normalizedSubjects = role === 'teacher' ? normalizeSubjects(body.subjects) : [];

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
      subjects: role === 'teacher' ? normalizedSubjects : undefined,
    });

    if (profileErr) {
      // Cleanup: delete auth user
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Profile error: ${profileErr.message}` }, { status: 500 });
    }

    // 3. Create hero for students
    let heroId: string | null = null;
    if (role === 'student') {
      const { data: heroData, error: heroErr } = await admin.from('heroes').upsert({
        user_id: userId,
        name: display_name,
        gender: body.gender || 'male',
        level: 1,
        xp: 0,
        xp_to_next: 100,
        hp: 100,
        hp_max: 100,
        gold: 0,
        streak_current: 0,
        streak_best: 0,
        status: 'active',
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
          total_xp_earned: 0,
          total_gold_earned: 0,
        }, { onConflict: 'hero_id' });
      }
    }

    // 4. Create Subject Bosses if teacher has subjects
    if (role === 'teacher' && normalizedSubjects.length > 0) {
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
          for (const subjectName of normalizedSubjects) {
            // Check if boss already exists (case-insensitive, чтобы не плодить дубликаты)
            const { data: existingBoss } = await admin.from('subject_bosses')
              .select('id')
              .eq('season_id', activeSeason.id)
              .eq('class_id', cls.id)
              .ilike('subject_id', escapeLikePattern(subjectName))
              .maybeSingle();

            if (!existingBoss) {
              // Calculate Boss HP
              const { count: studentCount } = await admin.from('users')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', cls.id)
                .eq('role', 'student');

              // Cascade class → school → global. Cache TTL = 30s — цикл по
              // классам одной школы обращается к одним и тем же ключам.
              const eco = await getEconomyConfig({ classId: cls.id });

              // Single source of truth — та же формула, что и в /api/bosses/ensure.
              const calculatedHp = calculateBossHp({
                studentCount: studentCount ?? null,
                seasonWeeks: weeksBetween(activeSeason.starts_at, activeSeason.ends_at),
                multiplierPct: eco.boss_hp_multiplier,
              });

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
