import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSubjects, escapeLikePattern } from '@/lib/utils/subjects';
import { calculateBossHp, weeksBetween } from '@/lib/game/boss-hp';
import { getEconomyConfig } from '@/lib/game/constants';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/bosses/ensure
 * Ensures that for the active season, this class has a `subject_bosses` record
 * for each given subject in `subjects`.
 *
 * Subjects приходят в произвольном регистре/с лишними пробелами — перед запросом
 * их нормализуем и дедупим (trim + collapse whitespace, case-insensitive dedupe).
 * Сопоставление с существующими боссами — case-insensitive, чтобы не плодить
 * дубликатов при смене регистра (см. миграцию subject_bosses_dedupe).
 *
 * Body: { classId: string, subjects: string[] }
 * Returns: { bosses: SubjectBoss[] }
 */
export async function POST(req: NextRequest) {
  const { classId, subjects: rawSubjects } = await req.json();

  if (!classId || !rawSubjects || !Array.isArray(rawSubjects)) {
    return NextResponse.json({ error: 'classId and subjects[] required' }, { status: 400 });
  }

  const subjects = normalizeSubjects(rawSubjects);
  if (subjects.length === 0) {
    return NextResponse.json({ bosses: [] });
  }

  // Get school_id from class
  const { data: classRow } = await admin.from('classes').select('school_id').eq('id', classId).single();
  if (!classRow?.school_id) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  // Active season
  const { data: season } = await admin.from('seasons').select('id, name, starts_at, ends_at')
    .eq('school_id', classRow.school_id).eq('status', 'active').limit(1).maybeSingle();

  if (!season) return NextResponse.json({ bosses: [], note: 'No active season' });

  // Для расчёта HP нового босса нам нужен размер класса и длительность сезона —
  // грузим один раз здесь, чтобы не дёргать БД в цикле по предметам.
  const { count: studentCount } = await admin.from('users')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('role', 'student');
  const seasonWeeks = season.starts_at && season.ends_at
    ? weeksBetween(season.starts_at as string, season.ends_at as string)
    : null;
  // Загружаем `boss_hp_multiplier` из economy_config (cascade class → school → global).
  // Cache TTL = 30s, поэтому один вызов здесь дешёвый; применяется к ВСЕМ боссам
  // в цикле ниже (они все — этого же класса).
  const eco = await getEconomyConfig({ classId });
  const bossHp = calculateBossHp({
    studentCount: studentCount ?? null,
    seasonWeeks,
    multiplierPct: eco.boss_hp_multiplier,
  });

  // Загружаем ВСЕХ боссов класса в этом сезоне (их немного — по одному на предмет),
  // чтобы сделать case-insensitive матчинг локально и не городить ilike-OR.
  const { data: existingBosses } = await admin.from('subject_bosses')
    .select('*')
    .eq('season_id', season.id)
    .eq('class_id', classId);

  const existingByLowerSubject = new Map<string, Record<string, unknown>>();
  (existingBosses ?? []).forEach((b: Record<string, unknown>) => {
    const subjectId = (b.subject_id as string | null) ?? '';
    existingByLowerSubject.set(subjectId.trim().toLowerCase(), b);
  });

  const resultBosses: Record<string, unknown>[] = [];
  const seenLower = new Set<string>();

  for (const subj of subjects) {
    const lower = subj.toLowerCase();
    if (seenLower.has(lower)) continue;
    seenLower.add(lower);

    const existing = existingByLowerSubject.get(lower);
    if (existing) {
      resultBosses.push(existing);
      continue;
    }

    const { data: newBoss, error } = await admin.from('subject_bosses').insert({
      season_id: season.id,
      class_id: classId,
      subject_id: subj,
      name: `Босс: ${subj}`,
      avatar: '🐉',
      max_hp: bossHp,
      current_hp: bossHp,
      is_defeated: false,
    }).select('*').single();

    if (error) {
      // 23505 = unique_violation: другой запрос уже создал босса между нашим
      // select и insert. Это единственная «ожидаемая» гонка после миграции,
      // которая поставила UNIQUE (season_id, class_id, LOWER(subject_id)).
      // Любая другая ошибка — настоящая проблема, не прячем её за тихим фолбэком.
      if ((error as { code?: string }).code !== '23505') {
        console.error('[bosses/ensure] insert failed:', { subject: subj, error });
        return NextResponse.json(
          { error: `Failed to create boss for "${subj}": ${error.message}` },
          { status: 500 },
        );
      }
      const { data: afterRace } = await admin.from('subject_bosses')
        .select('*')
        .eq('season_id', season.id)
        .eq('class_id', classId)
        .ilike('subject_id', escapeLikePattern(subj))
        .maybeSingle();
      if (afterRace) resultBosses.push(afterRace);
      continue;
    }

    if (newBoss) resultBosses.push(newBoss);
  }

  return NextResponse.json({ bosses: resultBosses });
}
