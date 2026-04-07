import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const { user_id } = await req.json() as { user_id: string };

  if (!user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  try {
    // 1. Delete hero_stats
    const { data: hero } = await admin.from('heroes').select('id').eq('user_id', user_id).single();
    if (hero) {
      await admin.from('hero_stats').delete().eq('hero_id', hero.id);
      await admin.from('hero_artifacts').delete().eq('hero_id', hero.id);
      await admin.from('activity_log').delete().eq('hero_id', hero.id);
    }

    // 2. Delete hero
    await admin.from('heroes').delete().eq('user_id', user_id);

    // 3. Delete quest attempts (hero_id is the FK, not student_id)
    if (hero) {
      await admin.from('quest_attempts').delete().eq('hero_id', hero.id);
    }

    // 4. Delete boss participants (hero_id is the FK)
    if (hero) {
      await admin.from('boss_participants').delete().eq('hero_id', hero.id);
    }

    // 5. Unlink parent relationship (parent_id lives on users row, no separate table)
    await admin.from('users').update({ parent_id: null }).eq('parent_id', user_id);

    // 6. Delete user profile
    await admin.from('users').delete().eq('id', user_id);

    // 7. Delete auth user
    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) {
      return NextResponse.json({ error: `Auth delete failed: ${authErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
