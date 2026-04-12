import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { seasonId } = await req.json();
  if (!seasonId) return NextResponse.json({ error: 'seasonId required' }, { status: 400 });

  // 0. Get season's school_id to scope all operations
  const { data: season, error: sErr } = await admin.from('seasons').select('school_id').eq('id', seasonId).single();
  if (sErr || !season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const schoolId = season.school_id;

  // 1. Mark season as ended
  const { error: e1 } = await admin.from('seasons').update({ status: 'ended' }).eq('id', seasonId);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // 2. Get ALL hero IDs for this school (via users table)
  const { data: schoolUsers } = await admin
    .from('users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'student');

  const schoolUserIds = (schoolUsers || []).map(u => u.id);
  if (schoolUserIds.length === 0) {
    return NextResponse.json({ success: true, message: 'No students in school' });
  }

  // 3. Archive leaderboard snapshot — only this school's heroes, sorted by cumulative XP
  const { data: heroes } = await admin
    .from('heroes')
    .select('id, user_id, name, level, xp, gold, streak_best')
    .in('user_id', schoolUserIds)
    .order('xp', { ascending: false });

  if (heroes && heroes.length > 0) {
    const snapshot = (heroes as Record<string, unknown>[]).map((h, idx) => ({
      season_id:   seasonId,
      hero_id:     h.id,
      user_id:     h.user_id,
      hero_name:   h.name,
      rank:        idx + 1,
      xp:          h.xp,
      level:       h.level,
      gold:        h.gold,
    }));
    await admin.from('season_leaderboards').insert(snapshot);
  }

  // 4. Reset HP and streak for this school's heroes only — single UPDATE
  const heroIds = (heroes || []).map(h => h.id);
  if (heroIds.length > 0) {
    // Batch update: reset HP to hp_max, activate heroes, clear streak
    // More efficient: set hp = hp_max using raw SQL via RPC, or batch by hp_max values
    // Fallback: update all at once with a reasonable default, then fix individually
    await admin.from('heroes')
      .update({ status: 'active', streak_current: 0 })
      .in('id', heroIds);

    // Reset HP to hp_max per hero (can't do hp = hp_max in one Supabase update)
    const { data: heroesHp } = await admin.from('heroes').select('id, hp_max').in('id', heroIds);
    if (heroesHp) {
      for (const h of heroesHp as { id: string; hp_max: number }[]) {
        await admin.from('heroes').update({ hp: h.hp_max }).eq('id', h.id);
      }
    }
  }

  // 5. Clear streak reward history ONLY for this school's heroes
  if (heroIds.length > 0) {
    await admin.from('streak_claims').delete().in('hero_id', heroIds);
  }

  return NextResponse.json({ success: true, heroes_reset: heroIds.length });
}
