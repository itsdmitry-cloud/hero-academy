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

    // Items that give inventory must have artifact_id linked
    if (!item.artifact_id && item.category !== 'hp_potion') {
      return { error: 'Товар повреждён (нет привязки к артефакту). Сообщите учителю.' };
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

    // Add artifact to hero's inventory (if linked)
    if (item.artifact_id) {
      // Get artifact catalog data for charges and duration
      const { data: artCatalog } = await supabase
        .from('artifacts')
        .select('max_charges, duration_hours')
        .eq('id', item.artifact_id)
        .single();

      if (!artCatalog) {
        // Artifact missing from catalog — refund gold
        await supabase.from('heroes').update({ gold: hero.gold }).eq('id', hero.id);
        return { error: 'Артефакт не найден в каталоге. Золото возвращено.' };
      }

      const durationHours = Number(artCatalog.duration_hours) || 0;

      const { error: insertError } = await supabase.from('hero_artifacts').insert({
        hero_id: hero.id,
        artifact_id: item.artifact_id,
        source: 'shop',
        quantity: 1,
        charges_remaining: artCatalog.max_charges ?? 1,
        expires_at: durationHours > 0
          ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
          : null,
      });

      if (insertError) {
        // Insert failed — refund gold
        await supabase.from('heroes').update({ gold: hero.gold }).eq('id', hero.id);
        return { error: `Не удалось добавить предмет: ${insertError.message}` };
      }
    } else if (item.category === 'hp_potion') {
      // Legacy shop items without artifact_id (direct HP restore)
      const { data: currentHero } = await supabase
        .from('heroes')
        .select('hp, hp_max')
        .eq('id', hero.id)
        .single();
      if (currentHero) {
        const newHp = Math.min(currentHero.hp + item.effect_value, currentHero.hp_max);
        await supabase.from('heroes').update({ hp: newHp }).eq('id', hero.id);
      }
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
