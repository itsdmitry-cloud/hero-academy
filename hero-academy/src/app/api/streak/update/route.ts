import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/streak/update
 * Call after any quest completion or daily activity.
 * Returns streak result including milestone bonuses.
 * Now includes streak_protect artifact check.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get hero for the current user
  const { data: hero, error: heroErr } = await supabase
    .from('heroes')
    .select('id, streak_current')
    .eq('user_id', session.user.id)
    .single();

  if (heroErr || !hero) {
    return NextResponse.json({ error: 'Hero not found' }, { status: 404 });
  }

  const oldStreak = hero.streak_current ?? 0;

  // Call the PostgreSQL streak update function
  const { data, error } = await supabase.rpc('update_hero_streak', {
    p_hero_id: hero.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as Record<string, unknown>;
  const newStreak = (result?.streak_current as number) ?? 0;

  // Check if streak was RESET (went from >0 to 0)
  if (oldStreak > 0 && newStreak === 0) {
    // Check for streak_protect artifact
    const { data: protectArts } = await admin
      .from('hero_artifacts')
      .select('id, charges_remaining, artifacts(effect, name)')
      .eq('hero_id', hero.id)
      .eq('is_equipped', true);

    if (protectArts) {
      for (const pa of protectArts) {
        const rec = pa as Record<string, unknown>;
        const artData = rec.artifacts as Record<string, unknown> | Record<string, unknown>[] | null;
        const art = Array.isArray(artData) ? artData[0] : artData;
        if (!art) continue;
        const eff = String(art.effect ?? '');
        if (!eff.includes('streak_protect')) continue;

        // Streak protected! Restore the old streak
        await admin.from('heroes').update({
          streak_current: oldStreak,
        }).eq('id', hero.id);

        // Consume the artifact
        await admin.from('hero_artifacts').delete().eq('id', String(rec.id));

        // Log the protection
        await admin.from('activity_log').insert({
          hero_id: hero.id,
          user_id: session.user.id,
          action: 'streak_update',
          metadata: { artifact: String(art.name), streak_saved: oldStreak },
        });

        return NextResponse.json({
          ...result,
          streak_current: oldStreak,
          streak_protected: true,
          protect_artifact: String(art.name),
        });
      }
    }
  }

  // ─── Passive HP Regen from equipped artifacts ───
  const { data: regenArts } = await admin
    .from('hero_artifacts')
    .select('artifacts!inner(effect, effect_value, name)')
    .eq('hero_id', hero.id)
    .eq('is_equipped', true);

  if (regenArts) {
    let regenTotal = 0;
    const regenNames: string[] = [];
    for (const ra of regenArts) {
      const rec = ra as Record<string, unknown>;
      const artData = rec.artifacts as Record<string, unknown> | Record<string, unknown>[] | null;
      const art = Array.isArray(artData) ? artData[0] : artData;
      if (!art) continue;
      const eff = String(art.effect ?? '');
      if (eff !== 'passive_hp_regen') continue;
      regenTotal += Number(art.effect_value ?? 0);
      regenNames.push(String(art.name));
    }

    if (regenTotal > 0) {
      const { data: heroFull } = await admin.from('heroes').select('hp, hp_max').eq('id', hero.id).single();
      if (heroFull && heroFull.hp < heroFull.hp_max) {
        const newHp = Math.min(heroFull.hp_max, heroFull.hp + regenTotal);
        await admin.from('heroes').update({ hp: newHp }).eq('id', hero.id);
        await admin.from('activity_log').insert({
          hero_id: hero.id,
          user_id: session.user.id,
          action: 'passive_regen',
          hp_change: newHp - heroFull.hp,
          metadata: { artifacts: regenNames, regen: regenTotal },
        });
      }
    }
  }

  return NextResponse.json(data);
}
