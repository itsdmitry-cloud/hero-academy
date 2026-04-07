import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/admin/seed-shop
 * Populates shop with: consumables (potions, boosts) + loot boxes.
 * Artifacts are NOT sold directly — only via loot boxes or quest drops.
 */
export async function POST() {
  try {
    // Clear old shop items
    await admin.from('shop_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // ═══ Get consumable artifacts (potions, xp instant, etc.) ═══
    const { data: consumables } = await admin
      .from('artifacts')
      .select('*')
      .eq('is_shopable', true)
      .in('effect_type', ['damage_reduce', 'xp_boost']);  // mapped enum types

    // Filter to only actual consumables by checking the effect field
    const shopConsumables = (consumables ?? []).filter((a: Record<string, unknown>) => {
      const eff = String(a.effect ?? '');
      return eff.includes('hp_restore') || eff.includes('xp_instant');
    });

    const records = [];

    // ── Consumable artifacts (potions) ──
    const RARITY_PRICE: Record<string, number> = {
      common: 25, rare: 60, epic: 150, legendary: 400,
    };

    for (const a of shopConsumables) {
      const art = a as Record<string, unknown>;
      const eff = String(art.effect ?? '');
      records.push({
        name: art.name,
        description: art.description,
        category: eff.includes('hp_restore') ? 'hp_potion' : 'xp_boost',
        artifact_id: art.id,
        price_gold: RARITY_PRICE[String(art.rarity)] ?? 50,
        icon: art.icon ?? '🧪',
        effect_value: art.effect_value ?? 0,
        is_available: true,
        req_level: art.min_level ?? 1,
        stock_limit: null,
      });
    }

    // ── Streak protection (Свеча Полуночника) ──
    const { data: streakArts } = await admin
      .from('artifacts')
      .select('*')
      .eq('is_shopable', true);

    for (const a of (streakArts ?? [])) {
      const art = a as Record<string, unknown>;
      const eff = String(art.effect ?? '');
      if (eff.includes('streak_protect')) {
        records.push({
          name: art.name,
          description: art.description,
          category: 'artifact',
          artifact_id: art.id,
          price_gold: 100,
          icon: art.icon ?? '🕯️',
          effect_value: art.effect_value ?? 0,
          is_available: true,
          req_level: art.min_level ?? 1,
          stock_limit: null,
        });
      }
    }

    // ── Loot boxes (4 tiers) ──
    const lootBoxes = [
      { name: '📦 Обычный Сундук',    description: 'Шанс получить обычный или редкий артефакт.',    category: 'lootbox', price_gold: 50,  rarity: 'common',    icon: '📦' },
      { name: '📦 Редкий Сундук',     description: 'Шанс получить редкий или эпический артефакт.',   category: 'lootbox', price_gold: 150, rarity: 'rare',      icon: '🎁' },
      { name: '📦 Эпический Сундук',  description: 'Шанс получить эпический или легендарный артефакт.', category: 'lootbox', price_gold: 400, rarity: 'epic',  icon: '💎' },
      { name: '📦 Легендарный Сундук', description: 'Лучший шанс на легендарный артефакт!',          category: 'lootbox', price_gold: 1000, rarity: 'legendary', icon: '👑' },
    ];

    // Check if lootbox artifacts exist, create them if not
    for (const box of lootBoxes) {
      let { data: lbArt } = await admin
        .from('artifacts')
        .select('id')
        .eq('effect_type', 'xp_boost') // mapped enum
        .eq('name', box.name)
        .single();

      if (!lbArt) {
        // Create lootbox artifact in catalog
        const { data: newArt } = await admin.from('artifacts').insert({
          name: box.name,
          description: box.description,
          rarity: box.rarity,
          icon: box.icon,
          effect_type: 'xp_boost', // mapped enum
          effect: 'lootbox',
          effect_value: 0,
          duration_hours: 0,
          max_charges: 1,
          drop_rate: 0,
          stackable: true,
          is_shopable: true,
          min_level: 1,
          artifact_type: 'consumable',
        }).select('id').single();
        lbArt = newArt;
      }

      if (lbArt) {
        records.push({
          name: box.name,
          description: box.description,
          category: 'lootbox',
          artifact_id: lbArt.id,
          price_gold: box.price_gold,
          icon: box.icon,
          effect_value: 0,
          is_available: true,
          req_level: 1,
          stock_limit: null,
        });
      }
    }

    // Insert all shop items
    const { error: insertErr } = await admin.from('shop_items').insert(records);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      count: records.length,
      breakdown: {
        potions: shopConsumables.length,
        streak_protect: records.filter(r => r.category === 'artifact').length,
        lootboxes: lootBoxes.length,
      },
      note: `Магазин обновлён: зелья + свеча + ${lootBoxes.length} сундука. Артефакты НЕ продаются напрямую.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
