'use client';

/**
 * Sync hook that bridges Supabase data into the existing Zustand heroStore.
 * Always overwrites the store with real DB data when authenticated.
 */

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHeroStore } from '@/lib/store/heroStore';
import { mapActivity } from '@/lib/hero/mappers';

export function useSupabaseSync() {
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    // Skip if SSR already populated the store. Realtime keeps it fresh.
    // On logout/account switch, synced flag resets via the hero clear path.
    if (useHeroStore.getState().synced) return;

    async function syncHeroData() {
      if (!user) return;

      // Fetch hero+stats (JOIN) and activity_log in parallel — saves 1 network RTT vs sequential
      const [heroRes, logsRes] = await Promise.all([
        supabase
          .from('heroes')
          .select('*, hero_stats(strength, knowledge, endurance, luck, wisdom)')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('activity_log')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      const hero = heroRes.data;
      if (!hero) return;

      const statsArr = hero.hero_stats as { strength: number; knowledge: number; endurance: number; luck: number; wisdom: number }[] | null;
      const stats = Array.isArray(statsArr) ? statsArr[0] ?? null : null;
      const logs = logsRes.data;

      const store = useHeroStore.getState();

      const parsedActivity = mapActivity(logs ?? []);

      useHeroStore.setState({
        hero: {
          ...store.hero,
          // Always overwrite with DB values — never fall back to stale localStorage "Артём Воин"
          heroId: hero.id,
          name: hero.name,
          gender: hero.gender,
          level: hero.level,
          xp: hero.xp,
          xp_to_next: hero.xp_to_next,
          hp: hero.hp,
          hp_max: hero.hp_max,
          gold: hero.gold,
          streak: hero.streak_current ?? 0,
          streak_best: hero.streak_best ?? 0,
          season_xp: hero.season_xp ?? 0,
        },
        stats: stats ? {
          strength: stats.strength,
          knowledge: stats.knowledge,
          endurance: stats.endurance,
          luck: stats.luck,
          wisdom: stats.wisdom,
        } : store.stats,
        activity: parsedActivity
      });
      // Signal that real data has arrived — page can hide skeleton
      useHeroStore.getState().markSynced();
    }

    syncHeroData();
  // Re-run whenever the user changes (covers login/logout/switch account)
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isLive: !!user };
}
