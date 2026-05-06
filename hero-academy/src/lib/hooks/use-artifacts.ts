'use client';

import { useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHeroStore } from '@/lib/store/heroStore';
import { cumulativeXpForLevel } from '@/lib/game/math';
import { useCachedFetch } from './use-cached-fetch';
import type { PlayerArtifact } from '@/lib/utils/artifacts';

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

interface ArtifactsCached {
  catalog: ArtifactCatalog[];
  inventory: HeroArtifact[];
}

// Чистит истёкшие артефакты на сервере, синхронизирует Zustand с экипированными,
// возвращает живой инвентарь.
async function processInventory(
  raw: HeroArtifact[] | null,
  supabase: ReturnType<typeof createClient>,
): Promise<HeroArtifact[]> {
  if (!raw) return [];
  const now = Date.now();
  const expired = raw.filter(i => i.expires_at && new Date(i.expires_at).getTime() < now);
  if (expired.length > 0) {
    await supabase.from('hero_artifacts').delete().in('id', expired.map(i => i.id));
  }
  const alive = expired.length > 0
    ? raw.filter(i => !i.expires_at || new Date(i.expires_at).getTime() >= now)
    : raw;
  const equipped = alive.filter(i => i.is_equipped).map(i => ({
    id: i.id, defId: i.artifact_id, is_equipped: true,
    charges_left: i.charges_remaining,
    expires_at: i.expires_at ? new Date(i.expires_at) : undefined,
  }));
  useHeroStore.setState({ inventory: equipped as unknown as PlayerArtifact[] });
  return alive;
}

/* ──────────── hook ──────────── */
export function useArtifacts() {
  const supabase = createClient();
  const { user } = useAuth();
  // Cache the hero id so we don't refetch it every time
  const heroIdRef = useRef<string | null>(null);

  // Cache key: per-user — выход одного и вход другого юзера должны разделять кэш
  const cacheKey = user ? `artifacts:${user.id}` : null;

  const fetcher = useCallback(async () => {
    // Resolve heroId from cache or Zustand store first
    const globalHeroId = useHeroStore.getState().hero?.heroId;
    const cachedHeroId = heroIdRef.current
      || (globalHeroId && globalHeroId !== 'h1' ? globalHeroId : null);

    let heroId = cachedHeroId;
    const catalogPromise = supabase.from('artifacts').select('*').order('rarity');

    if (!heroId) {
      const [sessionResult, catalogResult] = await Promise.all([
        supabase.auth.getSession(),
        catalogPromise,
      ]);
      const userId = sessionResult.data.session?.user?.id;
      const catalog = (catalogResult.data as ArtifactCatalog[] | null) ?? [];
      if (!userId) return { catalog, inventory: [] };

      const { data: heroData } = await supabase.from('heroes').select('id').eq('user_id', userId).single();
      heroId = heroData?.id ?? null;
      if (!heroId) return { catalog, inventory: [] };
      heroIdRef.current = heroId;

      const { data: inv } = await supabase
        .from('hero_artifacts').select('*, artifact:artifact_id(*)').eq('hero_id', heroId);
      return { catalog, inventory: await processInventory(inv as HeroArtifact[] | null, supabase) };
    }

    heroIdRef.current = heroId;
    const [catalogResult, invResult] = await Promise.all([
      catalogPromise,
      supabase.from('hero_artifacts').select('*, artifact:artifact_id(*)').eq('hero_id', heroId),
    ]);
    return {
      catalog: (catalogResult.data as ArtifactCatalog[] | null) ?? [],
      inventory: await processInventory(invResult.data as HeroArtifact[] | null, supabase),
    };
  }, [supabase]);

  const { data, loading, refetch: fetchArtifacts, mutate } = useCachedFetch<ArtifactsCached>(cacheKey, fetcher);

  const catalog = useMemo(() => data?.catalog ?? [], [data]);
  const inventory = useMemo(() => data?.inventory ?? [], [data]);

  // Локальный helper для оптимистичных обновлений инвентаря через mutate
  const updateInventory = useCallback((updater: (prev: HeroArtifact[]) => HeroArtifact[]) => {
    mutate(prev => ({
      catalog: prev?.catalog ?? [],
      inventory: updater(prev?.inventory ?? []),
    }));
  }, [mutate]);

  /* ── Slot limits by hero level (alpha-test май 2026 — каждые 3 уровня, cap 6) ── */
  const getMaxSlots = (heroLevel: number): number => {
    if (heroLevel >= 15) return 6;
    if (heroLevel >= 12) return 5;
    if (heroLevel >= 9)  return 4;
    if (heroLevel >= 6)  return 3;
    if (heroLevel >= 3)  return 2;
    return 1;
  };

  /* ── Equip / unequip artifact ── */
  const equipArtifact = useCallback(async (heroArtifactId: string, equip: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Не авторизован' };

    if (!equip) {
      const entry = inventory.find(i => i.id === heroArtifactId);
      if (entry?.expires_at) {
        const remainMs = new Date(entry.expires_at).getTime() - Date.now();
        if (remainMs > 0) {
          // Block unequip if artifact is time-locked (expires_at in future)
          const h = Math.floor(remainMs / 3_600_000);
          const label = h < 24 ? `${h}ч` : `${Math.floor(h / 24)}д ${h % 24}ч`;
          return { error: `Нельзя снять — артефакт активен ещё ${label}. Дождитесь окончания действия.` };
        }
        // Expired — delete instead of unequip
        updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
        await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
        await fetchArtifacts();
        return { error: null };
      }
      // No expiry — normal unequip
      updateInventory(prev => prev.map(i => i.id === heroArtifactId ? { ...i, is_equipped: false } : i));
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

    // Block equipping expired artifacts
    if (entry.expires_at && new Date(entry.expires_at).getTime() < Date.now()) {
      updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      return { error: 'Срок действия артефакта истёк — он исчез.' };
    }

    const effect = art.effect || art.effect_type || '';
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
    updateInventory(prev => prev.map(i => i.id === heroArtifactId ? { ...i, is_equipped: true } : i));

    const updateData: Record<string, unknown> = { is_equipped: true };
    if ((art.duration_hours ?? 0) > 0) {
      updateData.expires_at = new Date(Date.now() + art.duration_hours * 3600000).toISOString();
    }

    const { error } = await supabase.from('hero_artifacts').update(updateData).eq('id', heroArtifactId);
    if (error) {
      updateInventory(prev => prev.map(i => i.id === heroArtifactId ? { ...i, is_equipped: false } : i));
      return { error: error.message };
    }
    await fetchArtifacts();

    // Notify class if this is a team artifact
    const isTeamArtifact = effect.split(',').some(e => e.trim().startsWith('team_'));
    if (isTeamArtifact) {
      fetch('/api/game/team-artifact-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroArtifactId }),
      }).catch(() => {}); // fire-and-forget, don't block equip
    }

    return { error: null };
  }, [supabase, inventory, fetchArtifacts, updateInventory]);

  /* ── Use consumable artifact ──
   * Named `consumeArtifact`, not `useConsumable`, because the `use*` prefix
   * is reserved for React Hooks and triggers react-hooks/rules-of-hooks
   * at call sites (this is just a memoized async helper). */
  const consumeArtifact = useCallback(async (heroArtifactId: string): Promise<{ error: string | null; effect?: string; value?: number; message?: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Не авторизован' };

    const entry = inventory.find(i => i.id === heroArtifactId);
    const art = entry?.artifact;
    if (!art) return { error: 'Артефакт не найден' };

    const { data: hero } = await supabase.from('heroes').select('id, xp, hp, hp_max, gold, level, xp_to_next').eq('user_id', session.user.id).single();
    if (!hero) return { error: 'Герой не найден' };

    // Use the `effect` TEXT field as primary source (covers all effect codes);
    // Use effect column (primary), fall back to effect_type for legacy rows
    const effect = art.effect || art.effect_type || '';
    const val = art.effect_value;

    if (effect === 'hp_restore' || effect === 'hp_shield' || effect?.startsWith('hp_restore_')) {
      const newHp = Math.min((hero.hp_max as number) || 100, (hero.hp as number) + val);
      await supabase.from('heroes').update({ hp: newHp, status: 'active' }).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', hp_change: val, metadata: { artifact: art.name } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'hp_restore', value: val };
    }

    if (effect === 'xp_instant' || effect === 'xp_boost_instant' || effect?.startsWith('xp_instant_')) {
      // Cumulative XP: add val, then check level-up
      const newXp = (hero.xp as number) + val;
      let newLevel = hero.level as number;
      while (newXp >= cumulativeXpForLevel(newLevel + 1)) { newLevel++; }
      const newXpNext = cumulativeXpForLevel(newLevel + 1);
      const heroUpd: Record<string, unknown> = { xp: newXp, level: newLevel, xp_to_next: newXpNext };
      await supabase.from('heroes').update(heroUpd).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', xp_change: val, metadata: { artifact: art.name } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'xp_instant', value: val };
    }

    if (effect === 'extra_gold' || effect === 'gold_instant') {
      await supabase.from('heroes').update({ gold: (hero.gold as number) + val }).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', gold_change: val, metadata: { artifact: art.name } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: 'extra_gold', value: val };
    }

    if (effect === 'level_up') {
      const newLevel = (hero.level as number) + 1;
      const newXpNext = cumulativeXpForLevel(newLevel + 1);
      // Set XP to the threshold for the new level (so progress bar starts at 0%)
      const newXp = cumulativeXpForLevel(newLevel);
      await supabase.from('heroes').update({ level: newLevel, xp: newXp, xp_to_next: newXpNext }).eq('id', hero.id);
      await supabase.from('activity_log').insert({ hero_id: hero.id, user_id: session.user.id, action: 'potion_used', xp_change: 0, metadata: { artifact: art.name, new_level: newLevel } });
      await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
      updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
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
      updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
      await fetchArtifacts();
      return { error: null, effect: data.effect, value: data.value, message: data.message };
    }

    return { error: 'Этот предмет нельзя использовать напрямую. Экипируйте его.' };
  }, [supabase, inventory, fetchArtifacts, updateInventory]);

  /* ── Sell artifact ── */
  const sellArtifact = useCallback(async (heroArtifactId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Не авторизован' };

    const entry = inventory.find(i => i.id === heroArtifactId);
    const refund = Math.floor((entry?.artifact?.drop_rate ?? 10) * 5);

    // Optimistic remove
    updateInventory(prev => prev.filter(i => i.id !== heroArtifactId));
    const { error } = await supabase.from('hero_artifacts').delete().eq('id', heroArtifactId);
    if (error) { await fetchArtifacts(); return { error: error.message }; }

    const { data: hero } = await supabase.from('heroes').select('id, gold').eq('user_id', session.user.id).single();
    if (hero) await supabase.from('heroes').update({ gold: (hero.gold as number) + refund }).eq('id', hero.id);

    return { error: null, refund };
  }, [supabase, inventory, fetchArtifacts, updateInventory]);

  return { catalog, inventory, loading, refetch: fetchArtifacts, equipArtifact, consumeArtifact, sellArtifact, getMaxSlots };
}
