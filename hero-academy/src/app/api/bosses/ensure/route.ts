import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/bosses/ensure
 * Ensures that for the active season, this class has a `subject_bosses` record
 * for each given subject in `subjects`.
 *
 * Body: { classId: string, subjects: string[] }
 * Returns: { bosses: SubjectBoss[] }
 */
export async function POST(req: NextRequest) {
  const { classId, subjects } = await req.json();

  if (!classId || !subjects || !Array.isArray(subjects)) {
    return NextResponse.json({ error: 'classId and subjects[] required' }, { status: 400 });
  }

  // Get school_id from class
  const { data: classRow } = await admin.from('classes').select('school_id').eq('id', classId).single();
  if (!classRow?.school_id) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  // Active season
  const { data: season } = await admin.from('seasons').select('id, name')
    .eq('school_id', classRow.school_id).eq('status', 'active').limit(1).maybeSingle();
  
  if (!season) return NextResponse.json({ bosses: [], note: 'No active season' });

  // Load existing subject bosses for this class + season
  const { data: existingBosses } = await admin.from('subject_bosses')
    .select('*')
    .eq('season_id', season.id)
    .eq('class_id', classId)
    .in('subject_id', subjects);

  const existingMap = new Map();
  if (existingBosses) {
    existingBosses.forEach((b: any) => existingMap.set(b.subject_id, b));
  }

  const resultBosses = [...(existingBosses ?? [])];

  for (const subj of subjects) {
    if (!existingMap.has(subj)) {
      // Create boss for this subject
      const { data: newBoss, error } = await admin.from('subject_bosses').insert({
        season_id: season.id,
        class_id: classId,
        subject_id: subj,
        name: `Босс: ${subj}`,
        avatar: '🐉',
        max_hp: 50000,
        current_hp: 50000,
        is_defeated: false
      }).select('*').single();

      if (!error && newBoss) {
        resultBosses.push(newBoss);
      }
    }
  }

  return NextResponse.json({ bosses: resultBosses });
}
