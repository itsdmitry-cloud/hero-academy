import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const limit = parseInt(searchParams.get('limit') ?? '30');

  const subject = searchParams.get('subject'); // optional — filter by active subject

  if (!classId) return NextResponse.json({ events: [] });

  // 1. Get all student hero_ids in this class
  const { data: students } = await admin
    .from('users')
    .select('id, display_name, heroes!left(id)')
    .eq('class_id', classId)
    .eq('role', 'student');

  if (!students?.length) return NextResponse.json({ events: [] });

  // Build maps
  const userMap: Record<string, string> = {};
  const heroIds: string[] = [];
  students.forEach((s: Record<string, unknown>) => {
    const heroArr = Array.isArray(s.heroes) ? s.heroes : (s.heroes ? [s.heroes] : []);
    const hero = heroArr[0] as Record<string, unknown> | null;
    if (hero?.id) {
      heroIds.push(hero.id as string);
      userMap[hero.id as string] = s.display_name as string;
    }
  });

  // 2. Fetch activity_log for these heroes  
  const { data: logs } = await admin
    .from('activity_log')
    .select('id, action, xp_change, metadata, created_at, hero_id')
    .in('hero_id', heroIds)
    .in('action', ['teacher_xp_grant', 'teacher_hp_damage', 'hp_damage', 'artifact_drop', 'quest_graded'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!logs) return NextResponse.json({ events: [] });

  // 3. Optionally filter by subject (client-side after fetch, since metadata is JSONB)
  const filtered = subject
    ? logs.filter((log: Record<string, unknown>) => {
        const meta = (log.metadata as Record<string, unknown>) ?? {};
        const logSubject = (meta.subject as string ?? '').toLowerCase();
        // Events without subject (artifact_drop) pass through when no subject filter
        if (!logSubject) return false;
        return logSubject === subject.toLowerCase();
      })
    : logs;

  const events = filtered.map((log: Record<string, unknown>) => {
    const meta = (log.metadata as Record<string, unknown>) ?? {};
    const heroName = userMap[log.hero_id as string] ?? 'Ученик';
    const reason = (meta.reason as string) ?? '';
    const subject = (meta.subject as string) ?? '';

    // Determine icon and short label from reason string / action
    let icon = '⚡';
    let label = reason;

    if (log.action === 'teacher_xp_grant') {
      // Quest grade: "📝 Задание: title (оценка N)" → "Задание · оценка N"  
      const gradeMatch = reason.match(/оценка (\d)/);
      const typeMatch = reason.match(/^([^\s:]+\s[^\s:]+):/);
      const grade = gradeMatch ? gradeMatch[1] : '';
      if (grade) {
        const gradeIcons: Record<string, string> = { '5': '🏆', '4': '✅', '3': '🟡', '2': '🟠', '1': '❌' };
        icon = gradeIcons[grade] ?? '📝';
        label = typeMatch ? `${typeMatch[1]}${grade ? ' · оценка ' + grade : ''}` : `Оценка ${grade}`;
      } else {
        // Radar reward
        icon = '⚡';
        label = reason || 'Бафф';
      }
    } else if (log.action === 'quest_graded') {
      const score = Number(meta.score ?? 0);
      const gradeIcons: Record<number, string> = { 5: '🏆', 4: '✅', 3: '🟡', 2: '🟠', 1: '❌' };
      const subjectLabel = (meta.subject as string) ?? 'Задание';
      const xp = (log as Record<string, unknown>).xp_change as number ?? 0;
      icon = gradeIcons[score] ?? '📝';
      label = `${subjectLabel} · оценка ${score}${xp > 0 ? ' · +' + xp + ' XP' : ''}`;
    } else if (log.action === 'teacher_hp_damage' || log.action === 'hp_damage') {
      icon = '💀';
      label = reason || 'Штраф HP';
    } else if (log.action === 'artifact_drop') {
      icon = '💎';
      label = `Артефакт: ${meta.artifact_name ?? '...'}`;
    }

    return {
      id: log.id as string,
      hero_name: heroName,
      icon,
      label,
      subject,
      created_at: log.created_at as string,
    };
  });

  return NextResponse.json({ events });
}
