'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useHeroStore } from '@/lib/store/heroStore';

/* ──────────── types ──────────── */
export interface ArtifactCatalog {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  effect: string;
  effect_type?: string; // deprecated — use effect
  effect_value: number;
  duration_hours: number;
  drop_rate: number;
  stackable: boolean;
  max_charges: number;
  is_shopable: boolean;
  min_level?: number;
  artifact_type?: string;
}

export interface HeroArtifact {
  id: string;
  artifact_id: string;
  hero_id: string;
  slot_index: number | null;
  is_equipped: boolean;
  quantity: number;
  charges_remaining: number;
  acquired_at: string;
  expires_at: string | null;
  source: string;
  artifact?: ArtifactCatalog;
}

/* ──────────── hook ──────────── */
export function useArtifacts() {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<ArtifactCatalog[]>([]);
  const [inventory, setInventory] = useState<HeroArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  // Cache the hero id so we don't refetch it every time
  const heroIdRef = useRef<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      // Get session directly from Supabase — no dependency on auth context timing
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      const userId = session.user.id;

      // Fetch global catalog in parallel with hero lookup
      const globalHeroId = useHeroStore.getState().hero?.heroId;
      const validGlobalHeroId = globalHeroId && globalHeroId !== 'h1' ? globalHeroId : null;

      const [catalogResult, heroResult] = await Promise.all([
        supabase.from('artifacts').select('*').order('rarity'),
        heroIdRef.current
          ? Promise.resolve({ data: { id: heroIdRef.current } })
          : validGlobalHeroId
            ? Promise.resolve({ data: { id: validGlobalHeroId } })
            : supabase.from('heroes').select('id').eq('user_id', userId).single()
      ]);

      if (catalogResult.data) setCatalog(catalogResult.data as ArtifactCatalog[]);

      const heroId = (heroResult.data as any)?.id;
      if (!heroId) { setLoading(false); return; }
      heroIdRef.current = heroId;

      // Load inventory with joined artifact data
      const { data: inv } = await supabase
        .from('hero_artifacts')
        .select('*, artifact:artifact_id(*)')
        .eq('hero_id', heroId);

      if (inv) {
        const heroArtifacts = inv as HeroArtifact[];
        setInventory(heroArtifacts);

        // Sync equipped items to global Zustand store for game action calculations
        const equipped = heroArtifacts.filter(i => i.is_equipped).map(i => ({
          id: i.id,
          defId: i.artifact_id,
          is_equipped: true,
          charges_left: i.charges_remaining,
          expires_at: i.expires_at ? new Date(i.expires_at) : undefined,
        }));
        useHeroStore.setState({ inventory: equipped as any });
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Fetch on mount — only once
  useEffect(() => {
    fetchArtifacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Slot limits by hero level ── */
  const getMaxSlots = (heroLevel: number): number => {
    if (heroLevel >= 25) return 3;
    if (heroLevel >= 10) return 2;
    return 1;
  };

  /* ── Equip / unequip artifact ── */
  const equipArtifact = useCallback(async (heroArtifactId: string, equip: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Не авторизован' };

    if (!equip) {
      // Block unequip if artifact is time-locked (expires_at in future)
      const entry = inventory.find(i => i.id === heroArtifactId);
      if (entry?.expires_at) {
        const remainMs = new Date(entry.expires_at).getTime() - Date.now();
        if (remainMs > 0) {
          const h = Math.floor(remainMs / 3_600_000);
          const label = h < 24 ? `${h}ч` : `${Math.floor(h / 24)}д ${h % 24}ч`;
          return { error: `Нельзя снять — артефакт активен ещё ${label}. Дождитесь окончания действия.` };
        }
      }
      // Optimistic unequip
      setInventory(prev => prev.map(i => i.id === heroArtifactId ? { ...i, is_equipped: false } : i));
      const { error } = await supabase.from('hero_artifacts').update({ is_equipped: false }).eq('id', heroArtifactId);
      if (error) { await fetchArtifacts(); return { error: error.message }; }
      await fetchArtifacts();
      return { error: null };
    }

    // Get hero level and check constraints
    const { data: hero } = await supabase.from('heroes').select('id, level').eq('user_id', session.user.id).single();
    if (!hero) return { error: 'Герой не найден' };

    const entry = inventory.find(i => i.id === heroArtifactId);
    const art = entry?.artifact;
    if (!art) return { error: 'Артефакт не найден. Обновите страницу.' };

    const effect = art.effect || (art as any).effect_type || '';
    const isInstant = effect.startsWith('hp_restore') || effect.startsWith('xp_instant') || effect === 'level_up' || effect.startsWith('consumable_') || effect === 'gold_bonus' || effect === 'extra_gold';

    if (art.artifact_type === 'consumable' && isInstant) {
      return { error: 'Мгновенные зелья нельзя экипировать. Используйте «Применить».' };
    }

    const minLevel = art.min_level ?? 1;
    if (hero.level < minLevel) {
      return { error: `Требуется уровень ${minLevel}. Ваш: ${hero.level}` };
    }

    const currentEquipped = inventory.filter(i => i.is_equipped && i.id !== heroArtifactId).length;
    const maxSlots = getMaxSlots(hero.level);
    if (currentEquipped >= maxSlots) {
      return { error: `Все слоты заняты (${maxSlots}). Снимите другой артефакт.` };
    }

    // Optimistic equip
    setInventory(prev => prev.map(i => i.id === heroArtifactId ? { ...i, is_equipped: true } : i));

    const updateData: Record<string, unknown> = { is_equipped: true };
    if ((art.duration_hours ?? 0) > 0) {
      updateData.expires_at = new Date(Date.now() + art.duration_hours * 3600000).toISOString();
    }

    const { error } = await supabase.from('hero_artifacts').update(updateData).eq('id', heroArtifactId);
    if (error) {
      setInventory(prev => prev.map(i => i.id === heroArtifactId ? { ...i, is_equipped: false } : i));
      return { error: error.message };
    }
    await fetchArtifacts();
    return { error: null };
  }, [supabase, inventory, fetchArtifacts]);

  /* ── Use consumable artifact ── */
  const useConsumable = useCallback(async (heroArtifactId: string): Promise<{ error: string | null; effect?: string; value?: number; message?: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Не авторизован' };

    const entry = inventory.find(i => i.id === heroArtifactId);
    const art = entry?.artifact;
    if (!art) return { error: 'Артефакт не найден' };

    const { data: hero } = await supabase.from('heroes').select('id, xp, hp, hp_max, gold, level, xp_to_next').eq('user_id', session.user.id).single();
    if (!hero) return { error: 'Герой не найден' };

    // Use the `effect` TEXT field as primary source (covers all effect codes);
    // Use effect column (primary), fall back to effect_type for legacy rows
    const effect = art.effect || (art as any).effect_type || '';
    const val = art.effect_value;

    if (effect === 'hp_restore' || effect === 'hp_shield' || effect?.startsWith('hp_restore_')) {
      const newHp = Math.min((hero.hp_max as number) || 100, (hero.hp as number) + val);
      await supabase.from('heroes').update({ hp: newHp, status: 'active' }).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', hp_change: val, metadata: { artifact: art.name } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      setInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'hp_restore', value: val };
    }

    if (effect === 'xp_instant' || effect === 'xp_boost_instant' || effect?.startsWith('xp_instant_')) {
      // Cumulative XP: add val, then check level-up
      const newXp = (hero.xp as number) + val;
      let newLevel = hero.level as number;
      while (newXp >= newLevel * (1000 + 250 * (newLevel + 1))) { newLevel++; }
      const newXpNext = newLevel * (1000 + 250 * (newLevel + 1));
      const heroUpd: Record<string, unknown> = { xp: newXp };
      if (newLevel > (hero.level as number)) { heroUpd.level = newLevel; heroUpd.xp_to_next = newXpNext; }
      await supabase.from('heroes').update(heroUpd).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', xp_change: val, metadata: { artifact: art.name } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      setInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'xp_instant', value: val };
    }

    if (effect === 'extra_gold' || effect === 'gold_instant') {
      await supabase.from('heroes').update({ gold: (hero.gold as number) + val }).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', gold_change: val, metadata: { artifact: art.name } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      setInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'extra_gold', value: val };
    }

    if (effect === 'level_up') {
      const newLevel = (hero.level as number) + 1;
      const newXpNext = newLevel * (1000 + 250 * (newLevel + 1)); // cumulativeXpForLevel(newLevel+1)
      // Set XP to the threshold for the new level (so progress bar starts at 0%)
      const newXp = (newLevel - 1) * (1000 + 250 * newLevel); // cumulativeXpForLevel(newLevel)
      await supabase.from('heroes').update({ level: newLevel, xp: newXp, xp_to_next: newXpNext }).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', xp_change: 0, metadata: { artifact: art.name, new_level: newLevel } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      setInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'level_up', value: newLevel };
    }

    // All complex consumable types → server API (needs admin access for class-wide effects)
    if (effect.startsWith('consumable_') || effect === 'gold_bonus') {
      const res = await fetch('/api/game/use-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroArtifactId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: data.error ?? 'Ошибка сервера' };
      }
      setInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: data.effect, value: data.value, message: data.message };
    }

    return { error: 'Этот предмет нельзя использовать напрямую. Экипируйте его.' };
  }, [supabase, inventory, fetchArtifacts]);

  /* ── Sell artifact ── */
  const sellArtifact = useCallback(async (heroArtifactId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Не авторизован' };

    const entry = inventory.find(i => i.id === heroArtifactId);
    const refund = Math.floor((entry?.artifact?.drop_rate ?? 10) * 5);

    // Optimistic remove
    setInventory(prev => prev.filter(i => i.id !== heroArtifactId));
    const { error } = await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
    if (error) { await fetchArtifacts(); return { error: error.message }; }

    const { data: hero } = await supabase.from('heroes').select('id, gold').eq('user_id', session.user.id).single();
    if (hero) await supabase.from('heroes').update({ gold: (hero.gold as number) + refund }).eq('id', hero.id);

    return { error: null, refund };
  }, [supabase, inventory, fetchArtifacts]);

  return { catalog, inventory, loading, refetch: fetchArtifacts, equipArtifact, useConsumable, sellArtifact, getMaxSlots };
}
