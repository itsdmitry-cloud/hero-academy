'use client';

/**
 * useRealtimeHero — subscribes to live hero HP/XP/Gold changes.
 * Call from hero page to get instant updates without polling.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHeroStore } from '@/lib/store/heroStore';

export interface RealtimeHeroUpdate {
  hp: number;
  hp_max: number;
  xp: number;
  xp_to_next: number;
  gold: number;
  level: number;
  streak_current: number;
  status: string;
}

export function useRealtimeHero() {
  const supabase = createClient();
  const { user } = useAuth();
  // Read heroId from Zustand store (populated by useSupabaseSync) — avoids extra DB query
  const storeHeroId = useHeroStore(s => s.hero?.heroId);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<RealtimeHeroUpdate | null>(null);

  // Use store heroId when available; fall back to DB query only if store is empty
  useEffect(() => {
    if (storeHeroId && storeHeroId !== 'h1') {
      setHeroId(storeHeroId);
      return;
    }
    if (!user) return;
    supabase
      .from('heroes')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { if (data) setHeroId(data.id); });
  }, [user, storeHeroId, supabase]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!heroId) return;

    const channel = supabase
      .channel(`hero:${heroId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'heroes',
          filter: `id=eq.${heroId}`,
        },
        (payload) => {
          const updated = payload.new as RealtimeHeroUpdate;
          setLastUpdate(updated);

          // Immediately update Zustand store so UI reacts
          useHeroStore.setState(state => ({
            hero: {
              ...state.hero,
              hp: updated.hp,
              hp_max: updated.hp_max,
              xp: updated.xp,
              xp_to_next: updated.xp_to_next,
              gold: updated.gold,
              level: updated.level,
              streak: updated.streak_current ?? state.hero.streak,
              season_xp: (updated as any).season_xp ?? state.hero.season_xp,
            },
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [heroId, supabase]);

  return { lastUpdate, heroId };
}
