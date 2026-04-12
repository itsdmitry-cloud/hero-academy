import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildSeasonPassTiers, type SeasonElement, SEASON_ELEMENTS } from '@/lib/game/seasonPassConfig';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/game/claim-pass-reward
 * Body: { userId, tier, element }
 *
 * Claims a Battle Pass tier reward if:
 *  1. Hero's season_xp >= tier threshold
 *  2. Reward hasn't been claimed yet (hero_season_rewards)
 */
export async function POST(req: NextRequest) {
  const { userId, tier, element } = await req.json() as {
    userId: string;
    tier: number;
    element: SeasonElement;
  };

  if (!userId || !tier || !element) {
    return NextResponse.json({ error: 'userId, tier, element required' }, { status: 400 });
  }

  if (!SEASON_ELEMENTS[element]) {
    return NextResponse.json({ error: 'Invalid season element' }, { status: 400 });
  }

  // 1. Get hero
  const { data: hero } = await admin
    .from('heroes')
    .select('id, season_xp, season_id, gold, level')
    .eq('user_id', userId)
    .single();

  if (!hero) return NextResponse.json({ error: 'Hero not found' }, { status: 404 });

  // 2. Validate tier
  const tiers = buildSeasonPassTiers(element);
  const tierConfig = tiers.find(t => t.tier === tier);
  if (!tierConfig) return NextResponse.json({ error: `Tier ${tier} not found` }, { status: 400 });

  // 3. Check XP threshold
  if (hero.season_xp < tierConfig.xpRequired) {
    return NextResponse.json({
      error: `Недостаточно сезонного опыта. Нужно ${tierConfig.xpRequired}, у вас ${hero.season_xp}`,
    }, { status: 403 });
  }

  // 4. Check not already claimed
  let seasonId = hero.season_id;
  if (!seasonId) {
    const { data: activeSeason } = await admin.from('seasons').select('id').eq('is_active', true).limit(1).single();
    if (activeSeason) {
      seasonId = activeSeason.id;
      // Auto-heal hero
      await admin.from('heroes').update({ season_id: seasonId }).eq('id', hero.id);
    } else {
      return NextResponse.json({ error: 'Сервер не может найти активный сезон Боевого Пропуска' }, { status: 400 });
    }
  }

  const { data: existing } = await admin
    .from('hero_season_rewards')
    .select('id')
    .eq('hero_id', hero.id)
    .eq('season_id', seasonId)
    .eq('tier', tier)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Награда уже получена' }, { status: 409 });
  }

  // 5. Grant rewards
  const granted: string[] = [];

  for (const reward of tierConfig.rewards) {
    switch (reward.type) {
      case 'gold': {
        const amount = reward.amount ?? 0;
        await admin.from('heroes')
          .update({ gold: (hero.gold ?? 0) + amount })
          .eq('id', hero.id);
        hero.gold = (hero.gold ?? 0) + amount; // local mutation for chained rewards
        granted.push(`+${amount} 💰`);
        break;
      }

      case 'lootbox': {
        // Seasonal chests — find by base name (DB names include emoji + rarity suffix)
        const chestName = SEASON_ELEMENTS[element].chestName;

        const { data: artifact } = await admin
          .from('artifacts')
          .select('id, name, max_charges')
          .ilike('name', `%${chestName}%`)
          .limit(1)
          .maybeSingle();

        if (artifact) {
          await admin.from('hero_artifacts').insert({
            hero_id: hero.id,
            artifact_id: artifact.id,
            source: 'reward',
            quantity: 1,
            charges_remaining: artifact.max_charges ?? 1,
          });
          granted.push(`📦 ${artifact.name}`);
        }
        break;
      }

      case 'artifact': {
        const { data: art } = await admin
          .from('artifacts')
          .select('id, name, max_charges, duration_hours')
          .eq('name', reward.artifactName ?? '')
          .maybeSingle();

        if (art) {
          await admin.from('hero_artifacts').insert({
            hero_id: hero.id,
            artifact_id: art.id,
            source: 'reward',
            quantity: 1,
            charges_remaining: art.max_charges ?? 1,
          });
          granted.push(`💎 ${art.name}`);
        }
        break;
      }

      case 'collectible': {
        await admin.from('hero_collectibles').upsert({
          hero_id: hero.id,
          code: reward.collectibleCode ?? `bp_tier_${tier}`,
          name: reward.collectibleName ?? `Достижение (Уровень ${tier})`,
          icon: reward.collectibleIcon ?? '🏆',
          description: `Награда за ${tier}-й уровень Боевого Пропуска`,
          season_id: seasonId,
        }, { onConflict: 'hero_id, code', ignoreDuplicates: true });
        granted.push(`${reward.collectibleIcon ?? '🏆'} ${reward.collectibleName ?? 'Коллекционка'}`);
        break;
      }
    }
  }

  // 6. Record the claim
  const { error: insertError } = await admin.from('hero_season_rewards').insert({
    hero_id: hero.id,
    season_id: seasonId,
    tier,
    reward_type: tierConfig.rewards.map(r => r.type).join('+'),
    reward_data: { rewards: tierConfig.rewards, granted },
  });

  if (insertError) {
    console.error('Failed to insert hero_season_rewards:', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 7. Activity log
  await admin.from('activity_log').insert({
    hero_id: hero.id,
    user_id: userId,
    action: 'bp_reward_claimed',
    metadata: { tier, element, granted },
  });

  return NextResponse.json({ success: true, tier, granted });
}
