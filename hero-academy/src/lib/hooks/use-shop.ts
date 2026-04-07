'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

/* ──────────── types ──────────── */
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: 'hp_potion' | 'xp_boost' | 'artifact' | 'cosmetic' | 'lootbox';
  artifact_id: string | null;
  price_gold: number;
  icon: string;
  effect_value: number;
  is_available: boolean;
  req_level: number;
  stock_limit: number | null;
}

/* ──────────── hook ──────────── */
export function useShop() {
  const supabase = createClient();
  const { user } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_available', true)
      .order('price_gold');

    if (data) setItems(data as ShopItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* ── buy item ── */
  const buyItem = useCallback(async (itemId: string) => {
    if (!user) return { error: 'Не авторизован' };

    const item = items.find(i => i.id === itemId);
    if (!item) return { error: 'Товар не найден' };

    // Resolve artifact_id: use FK if present, otherwise look up by item name
    let artifactId = item.artifact_id;
    if (!artifactId) {
      // FK broken (ON DELETE SET NULL) — try to find artifact by name
      // Try exact name first, then strip leading emoji (shop uses "📦 Сундук", registry uses "Сундук")
      const namesToTry = [item.name, item.name.replace(/^[^\p{L}\p{N}]+/u, '')];
      let matchedArt: { id: string } | null = null;

      for (const name of namesToTry) {
        const { data } = await supabase
          .from('artifacts')
          .select('id')
          .eq('name', name)
          .single();
        if (data) { matchedArt = data; break; }
      }

      if (matchedArt) {
        artifactId = matchedArt.id;
        // Self-heal: restore the FK for future purchases
        await supabase.from('shop_items').update({ artifact_id: matchedArt.id }).eq('id', item.id);
      } else {
        return { error: 'Товар повреждён (артефакт не найден). Сообщите учителю.' };
      }
    }

    // Get hero
    const { data: hero } = await supabase
      .from('heroes')
      .select('id, gold')
      .eq('user_id', user.id)
      .single();

    if (!hero) return { error: 'Герой не найден' };
    if (hero.gold < item.price_gold) return { error: 'Недостаточно золота' };

    // Deduct gold
    const { error: goldError } = await supabase
      .from('heroes')
      .update({ gold: hero.gold - item.price_gold })
      .eq('id', hero.id);

    if (goldError) return { error: goldError.message };

    // Add artifact to hero's inventory
    const { data: artCatalog } = await supabase
      .from('artifacts')
      .select('max_charges, duration_hours')
      .eq('id', artifactId)
      .single();

    if (!artCatalog) {
      await supabase.from('heroes').update({ gold: hero.gold }).eq('id', hero.id);
      return { error: 'Артефакт не найден в каталоге. Золото возвращено.' };
    }

    const durationHours = Number(artCatalog.duration_hours) || 0;

    const { error: insertError } = await supabase.from('hero_artifacts').insert({
      hero_id: hero.id,
      artifact_id: artifactId,
      source: 'shop',
      quantity: 1,
      charges_remaining: artCatalog.max_charges ?? 1,
      expires_at: durationHours > 0
        ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
        : null,
    });

    if (insertError) {
      await supabase.from('heroes').update({ gold: hero.gold }).eq('id', hero.id);
      return { error: `Не удалось добавить предмет: ${insertError.message}` };
    }

    // Create transaction
    await supabase.from('transactions').insert({
      hero_id: hero.id,
      type: 'purchase',
      item_type: item.category,
      amount: -item.price_gold,
      shop_item_id: item.id,
      description: `Покупка: ${item.name}`,
    });

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: user.id,
      hero_id: hero.id,
      action: 'shop_purchase',
      metadata: { item_name: item.name, price: item.price_gold },
      gold_change: -item.price_gold,
    });

    return { error: null };
  }, [user, items, supabase]);

  return { items, loading, buyItem, refetch: fetchItems };
}
