import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOSS_AVATARS: Record<string, string> = {
  'Математика': '🐉', 'Алгебра': '🐉', 'Геометрия': '🦂',
  'Физика': '⚡', 'Химия': '🧪', 'Биология': '🌿',
  'История': '👹', 'Литература': '📖', 'Английский': '🦁',
  'Английский язык': '🦁', 'Русский язык': '🖊️', 'Информатика': '🤖',
  'География': '🌍',
};

export async function POST(req: NextRequest) {
  const { classId, subjects } = await req.json();

  if (!classId || !subjects?.length) {
    return NextResponse.json({ error: 'classId and subjects required' }, { status: 400 });
  }

  // Get school_id from class
  const { data: classRow } = await admin.from('classes').select('school_id').eq('id', classId).single();
  if (!classRow?.school_id) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  // Active season (need dates for duration-based HP scaling)
  const { data: season } = await admin.from('seasons').select('id, starts_at, ends_at')
    .eq('school_id', classRow.school_id).eq('status', 'active').limit(1).maybeSingle();
  if (!season) return NextResponse.json({ bosses: [], note: 'No active season' });

  // Class size for HP  
  const { count: classSize } = await admin.from('users')
    .select('*', { count: 'exact', head: true }).eq('class_id', classId).eq('role', 'student');
  const baseHp = Math.min(30000, Math.max(3000, (classSize ?? 10) * 500));

  // Season duration multiplier: 30 days → ×1.0, 60 days → ×1.5, 90+ days → ×2.0, <15 days → ×0.75
  const durationDays = season.starts_at && season.ends_at
    ? (new Date(season.ends_at).getTime() - new Date(season.starts_at).getTime()) / 86400000
    : 30; // default 30 days if dates missing
  const durationMult = Math.min(2.0, Math.max(0.5, 0.5 + durationDays / 60));

  // Apply boss_hp_multiplier from economy config (class → school → global)
  const ecoKeys = [`scope_class_${classId}`, `scope_school_${classRow.school_id}`, 'scope_global'];
  let bossHpMult = 100;
  for (const key of ecoKeys) {
    const { data: eCfg } = await admin.from('economy_config').select('value').eq('key', key).maybeSingle();
    if (eCfg?.value) { bossHpMult = (eCfg.value as Record<string, number>).boss_hp_multiplier ?? 100; break; }
  }
  const hp = Math.round(baseHp * durationMult * (bossHpMult / 100));

  // Existing bosses
  const { data: existing } = await admin.from('subject_bosses').select('subject_id')
    .eq('season_id', season.id).eq('class_id', classId);
  const existingSubjects = new Set((existing ?? []).map((b: { subject_id: string }) => b.subject_id.toLowerCase()));

  // Create missing
  const toCreate = (subjects as string[]).filter((s: string) => !existingSubjects.has(s.toLowerCase()));
  if (toCreate.length > 0) {
    await admin.from('subject_bosses').insert(
      toCreate.map((subj: string) => ({
        season_id: season.id,
        class_id: classId,
        subject_id: subj,
        name: `Босс: ${subj}`,
        avatar: BOSS_AVATARS[subj] ?? '🐉',
        max_hp: hp,
        current_hp: hp,
        is_defeated: false,
      }))
    );
  }

  // Return all bosses for this class+subjects
  const { data: bosses } = await admin.from('subject_bosses').select('*')
    .eq('season_id', season.id).eq('class_id', classId)
    .in('subject_id', subjects)
    .order('subject_id');

  return NextResponse.json({ bosses: bosses ?? [] });
}
