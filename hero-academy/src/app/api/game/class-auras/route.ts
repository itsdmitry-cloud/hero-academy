import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getClassAuras } from '@/lib/game/artifact-engine';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/game/class-auras
 * Returns active class auras with detail objects for the banner component.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    // Resolve heroId from user
    const { data: hero } = await admin.from('heroes').select('id').eq('user_id', user.id).single();
    if (!hero) return NextResponse.json({ error: 'Герой не найден' }, { status: 404 });

    const auras = await getClassAuras(hero.id);

    return NextResponse.json({
      xpBoost: auras.xpBoost,
      goldBoost: auras.goldBoost,
      dmgReduce: auras.dmgReduce,
      details: auras.details,
    });
  } catch (err) {
    console.error('[class-auras]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
