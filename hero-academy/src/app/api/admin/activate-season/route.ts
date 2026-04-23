import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { weeksBetween } from '@/lib/game/boss-hp';
import { getEconomyConfig } from '@/lib/game/constants';
import {
  buildBossCreationPlan,
  collectSchoolSubjects,
  type ClassInfo,
  type ExistingBoss,
} from '@/lib/game/boss-activation';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { seasonId } = (await request.json()) as { seasonId?: string };
  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 });
  }

  const { data: season, error: seasonError } = await admin
    .from('seasons')
    .select('id, school_id, starts_at, ends_at')
    .eq('id', seasonId)
    .maybeSingle();

  if (seasonError || !season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  }

  // Deactivate other active seasons in this school
  const { error: deactivateError } = await admin
    .from('seasons')
    .update({ status: 'archived' })
    .eq('school_id', season.school_id)
    .eq('status', 'active')
    .neq('id', seasonId);
  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  // Activate requested season
  const { error: activateError } = await admin
    .from('seasons')
    .update({ status: 'active' })
    .eq('id', seasonId);
  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 500 });
  }

  // === Boss creation ===
  const warnings: string[] = [];
  let bossesCreated = 0;
  let classesSkipped: { id: string; name: string; reason: string }[] = [];
  let subjects: string[] = [];

  try {
    // Load teachers with subjects
    const { data: teachers, error: teachersError } = await admin
      .from('users')
      .select('subjects')
      .eq('school_id', season.school_id)
      .eq('role', 'teacher');
    if (teachersError) throw teachersError;

    subjects = collectSchoolSubjects(teachers ?? []);
    if (subjects.length === 0) {
      warnings.push('Нет учителей с subjects — боссов не создано');
    } else {
      // Load classes with student counts
      const { data: classes, error: classesError } = await admin
        .from('classes')
        .select('id, name')
        .eq('school_id', season.school_id);
      if (classesError) throw classesError;

      const classInfos: ClassInfo[] = [];
      for (const cls of classes ?? []) {
        const { count } = await admin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('role', 'student');
        classInfos.push({ id: cls.id, name: cls.name, studentCount: count ?? 0 });
      }

      // Load existing bosses for this season
      const { data: existingBosses, error: bossesError } = await admin
        .from('subject_bosses')
        .select('id, class_id, subject_id, max_hp, current_hp, is_defeated')
        .eq('season_id', seasonId);
      if (bossesError) throw bossesError;

      // Resolve multipliers per class (in parallel)
      const multiplierEntries = await Promise.all(
        classInfos.map(async (cls) => {
          const eco = await getEconomyConfig({ classId: cls.id });
          return [cls.id, eco.boss_hp_multiplier ?? 100] as const;
        }),
      );
      const multiplierMap = new Map(multiplierEntries);

      const seasonWeeks = weeksBetween(season.starts_at as string, season.ends_at as string);

      const plan = buildBossCreationPlan({
        classes: classInfos,
        subjects,
        existing: (existingBosses ?? []) as ExistingBoss[],
        seasonWeeks,
        multiplierResolver: (classId) => multiplierMap.get(classId) ?? 100,
      });

      classesSkipped = plan.skipped;

      // Insert bosses
      for (const boss of plan.toCreate) {
        const { error: insertError } = await admin.from('subject_bosses').insert({
          season_id: seasonId,
          class_id: boss.classId,
          subject_id: boss.subjectId,
          name: `Босс: ${boss.subjectId}`,
          avatar: '🐉',
          max_hp: boss.maxHp,
          current_hp: boss.maxHp,
          is_defeated: false,
        });
        if (insertError) {
          // 23505 = unique violation (idempotent), ignore
          if (!insertError.message.includes('duplicate') && insertError.code !== '23505') {
            warnings.push(
              `Не удалось создать босса ${boss.className} · ${boss.subjectId}: ${insertError.message}`,
            );
          }
        } else {
          bossesCreated++;
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Boss creation error: ${msg}`);
  }

  return NextResponse.json({
    success: true,
    bossesCreated,
    classesSkipped,
    subjects,
    warnings,
  });
}
