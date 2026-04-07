import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOX_RARITY_WEIGHTS: Record<string, { tier: string; weight: number }[]> = {
  common:    [{ tier: 'common', weight: 80 }, { tier: 'rare', weight: 20 }],
  rare:      [{ tier: 'common', weight: 40 }, { tier: 'rare', weight: 50 }, { tier: 'epic', weight: 10 }],
  epic:      [{ tier: 'rare', weight: 50 }, { tier: 'epic', weight: 40 }, { tier: 'legendary', weight: 10 }],
  legendary: [{ tier: 'rare', weight: 20 }, { tier: 'epic', weight: 50 }, { tier: 'legendary', weight: 30 }],
};

// Seasonal pool tags (boxRarity value -> season_pool column in DB)
const SEASONAL_POOLS: Record<string, string> = {
  seasonal_fire:  'fire',
  seasonal_ice:   'ice',
  seasonal_earth: 'earth',
  seasonal_water: 'water',
};

export async function POST(req: NextRequest) {
  const { heroArtifactId, boxRarity, userId } = await req.json();
  if (!heroArtifactId || !boxRarity || !userId) {
    return NextResponse.json({ error: 'heroArtifactId, boxRarity, userId are required' }, { status: 400 });
  }

  // Verify this lootbox belongs to someone and check if it's a seasonal chest
  const { data: boxRow } = await admin
    .from('hero_artifacts')
    .select('id, hero_id, artifacts(season_pool)')
    .eq('id', heroArtifactId)
    .single();
    
  if (!boxRow) return NextResponse.json({ error: 'Lootbox not found in inventory' }, { status: 404 });

  let seasonPool = SEASONAL_POOLS[boxRarity];
  if (!seasonPool && boxRow.artifacts) {
    const artData = Array.isArray(boxRow.artifacts) ? boxRow.artifacts[0] : boxRow.artifacts;
    seasonPool = (artData as any)?.season_pool;
  }
  if (seasonPool) {
    // Build seasonal pool: all artifacts tagged with this season_pool
    const { data: seasonArts } = await admin
      .from('artifacts')
      .select('id, name, description, icon, rarity, drop_rate, max_charges, duration_hours')
      .eq('season_pool', seasonPool)
      .neq('effect_type', 'lootbox');

    // Consume the seasonal lootbox
    await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);

    if (!seasonArts || seasonArts.length === 0) {
      return NextResponse.json({ success: false, error: `Сезонный пул пуст (pool=${seasonPool})` });
    }

    // Weighted pick by drop_rate
    const totalDrop = seasonArts.reduce((s, a) => s + (a.drop_rate || 1), 0);
    let dropRoll = Math.random() * totalDrop;
    let won = seasonArts[0];
    for (const a of seasonArts) {
      if (dropRoll < (a.drop_rate || 1)) { won = a; break; }
      dropRoll -= (a.drop_rate || 1);
    }

    const maxCharges = won.max_charges ?? 0;
    const durationHours = Number(won.duration_hours) || 0;

    await admin.from('hero_artifacts').insert({
      hero_id: boxRow.hero_id,
      artifact_id: won.id,
      source: 'lootbox',
      quantity: 1,
      charges_remaining: maxCharges > 0 ? maxCharges : 1,
      expires_at: durationHours > 0
        ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
        : null,
    });

    await admin.from('activity_log').insert({
      hero_id: boxRow.hero_id,
      user_id: userId,
      action: 'seasonal_lootbox_opened',
      metadata: { artifact: won.name, rarity: won.rarity, season: seasonPool, box_rarity: boxRarity },
    });

    return NextResponse.json({
      success: true,
      seasonal: true,
      artifact: { id: won.id, name: won.name, icon: won.icon, rarity: won.rarity, description: (won as any).description ?? '' },
    });
  }

  // ============================================================
  // STANDARD LOOTBOX PATH (unchanged)
  // ============================================================

  // Pick rarity tier using weighted random
  const tierWeights = BOX_RARITY_WEIGHTS[boxRarity] ?? BOX_RARITY_WEIGHTS.common;
  const totalWeight = tierWeights.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosenTier = tierWeights[0].tier;
  for (const t of tierWeights) {
    if (roll < t.weight) { chosenTier = t.tier; break; }
    roll -= t.weight;
  }

  // Fetch hero level for the cap
  const { data: hero } = await admin.from('heroes').select('id, level').eq('id', boxRow.hero_id).single();
  const heroLevel = hero?.level ?? 1;

  // Build pool: correct rarity, not a lootbox, NOT seasonal.
  // We REMOVED the level cap (.lte(min_level)), because getting high level items at low levels creates motivation. 
  // The user won't be able to equip them until they reach the level anyway!
  const { data: pool } = await admin
    .from('artifacts')
    .select('id, name, icon, rarity, drop_rate, min_level')
    .eq('rarity', chosenTier)
    .neq('effect', 'lootbox')
    .is('season_pool', null);

  // Consume the lootbox
  await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);

  if (!pool || pool.length === 0) {
    return NextResponse.json({ success: false, error: `Пул пуст (tier=${chosenTier}, maxLvl=${heroLevel + 5})` });
  }

  // Weighted pick within tier by drop_rate (fall back to equal weight if 0)
  const arts = pool as { id: string; name: string; icon: string; rarity: string; drop_rate: number }[];
  const totalDrop = arts.reduce((s, a) => s + (a.drop_rate || 1), 0);
  let dropRoll = Math.random() * totalDrop;
  let won = arts[0];
  for (const a of arts) {
    if (dropRoll < (a.drop_rate || 1)) { won = a; break; }
    dropRoll -= (a.drop_rate || 1);
  }

  // Grant winning artifact
  const { data: fullArtRow } = await admin.from('artifacts').select('max_charges, duration_hours').eq('id', won.id).single();
  const maxCharges = (fullArtRow as any)?.max_charges ?? 0;
  const durationHours = Number((fullArtRow as any)?.duration_hours) || 0;

  await admin.from('hero_artifacts').insert({
    hero_id: boxRow.hero_id,
    artifact_id: won.id,
    source: 'lootbox',
    quantity: 1,
    charges_remaining: maxCharges > 0 ? maxCharges : 1,
    expires_at: durationHours > 0
      ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
      : null,
  });

  await admin.from('activity_log').insert({
    hero_id: boxRow.hero_id,
    user_id: userId,
    action: 'lootbox_opened',
    metadata: { artifact: won.name, rarity: won.rarity, box_rarity: boxRarity },
  });

  return NextResponse.json({
    success: true,
    artifact: { id: won.id, name: won.name, icon: won.icon, rarity: won.rarity },
  });
}
