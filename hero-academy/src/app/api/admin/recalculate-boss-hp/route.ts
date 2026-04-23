import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { weeksBetween } from '@/lib/game/boss-hp';
import { getEconomyConfig } from '@/lib/game/constants';
import {
  buildRecalcPlan,
  collectSchoolSubjects,
  type ClassInfo,
  type ExistingBoss,
} from '@/lib/game/boss-activation';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { seasonId, dryRun = true } = (await request.json()) as {
    seasonId?: string;
    dryRun?: boolean;
  };
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

  // Load teachers + subjects
  const { data: teachers, error: teachersError } = await admin
    .from('users')
    .select('subjects')
    .eq('school_id', season.school_id)
    .eq('role', 'teacher');
  if (teachersError) {
    return NextResponse.json({ error: teachersError.message }, { status: 500 });
  }
  const subjects = collectSchoolSubjects(teachers ?? []);

  // Load classes + student counts
  const { data: classes, error: classesError } = await admin
    .from('classes')
    .select('id, name')
    .eq('school_id', season.school_id);
  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }
  const classInfos: ClassInfo[] = [];
  for (const cls of classes ?? []) {
    const { count } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .eq('role', 'student');
    classInfos.push({ id: cls.id, name: cls.name, studentCount: count ?? 0 });
  }

  // Load existing bosses
  const { data: existingBosses, error: bossesError } = await admin
    .from('subject_bosses')
    .select('id, class_id, subject_id, max_hp, current_hp, is_defeated')
    .eq('season_id', seasonId);
  if (bossesError) {
    return NextResponse.json({ error: bossesError.message }, { status: 500 });
  }

  // Resolve multipliers per class
  const multiplierEntries = await Promise.all(
    classInfos.map(async (cls) => {
      const eco = await getEconomyConfig({ classId: cls.id });
      return [cls.id, eco.boss_hp_multiplier ?? 100] as const;
    }),
  );
  const multiplierMap = new Map(multiplierEntries);

  const seasonWeeks = weeksBetween(season.starts_at as string, season.ends_at as string);

  const plan = buildRecalcPlan({
    classes: classInfos,
    subjects,
    existing: (existingBosses ?? []) as ExistingBoss[],
    seasonWeeks,
    multiplierResolver: (classId) => multiplierMap.get(classId) ?? 100,
  });

  if (dryRun) {
    return NextResponse.json({ ...plan, applied: false });
  }

  // Apply changes
  const warnings: string[] = [];
  let applied = 0;

  for (const change of plan.changes) {
    const { error } = await admin
      .from('subject_bosses')
      .update({ max_hp: change.newMaxHp, current_hp: change.newCurrentHp })
      .eq('id', change.bossId);
    if (error) {
      warnings.push(
        `Не удалось обновить босса ${change.className} · ${change.subjectId}: ${error.message}`,
      );
    } else {
      applied++;
    }
  }

  for (const newBoss of plan.newBosses) {
    const { error } = await admin.from('subject_bosses').insert({
      season_id: seasonId,
      class_id: newBoss.classId,
      subject_id: newBoss.subjectId,
      name: `Босс: ${newBoss.subjectId}`,
      avatar: '🐉',
      max_hp: newBoss.maxHp,
      current_hp: newBoss.maxHp,
      is_defeated: false,
    });
    if (error && error.code !== '23505') {
      warnings.push(
        `Не удалось создать босса ${newBoss.className} · ${newBoss.subjectId}: ${error.message}`,
      );
    } else if (!error) {
      applied++;
    }
  }

  return NextResponse.json({ ...plan, applied: true, appliedCount: applied, warnings });
}
