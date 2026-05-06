'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useCachedFetch } from './use-cached-fetch';

/* ──────────── types ──────────── */
export interface LeaderboardEntry {
  rank: number;
  hero_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  gold: number;
  streak: number;
  is_self: boolean;
}

interface RpcLeaderboardRow {
  rank: number;
  hero_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  gold: number;
  streak_current: number | null;
  is_self: boolean;
}

interface RpcRankRow {
  rank: number;
  total: number;
}

interface LeaderboardCached {
  entries: LeaderboardEntry[];
  selfRank: number | null;
  selfTotal: number;
}

/* ──────────── hook ──────────── */
export function useLeaderboard(scope: 'class' | 'school' = 'class') {
  const supabase = createClient();
  const { profile, user } = useAuth();
  const cacheKey = profile && user ? `leaderboard:${scope}:${user.id}` : null;

  const fetcher = useCallback(async () => {
    const [{ data: list }, { data: meRow }] = await Promise.all([
      supabase.rpc('get_rating_leaderboard', {
        p_user_id: user!.id,
        p_scope: scope,
        p_limit: 50,
      }),
      supabase.rpc('get_user_rating_rank', {
        p_user_id: user!.id,
        p_scope: scope,
      }),
    ]);

    const entries: LeaderboardEntry[] = list
      ? (list as RpcLeaderboardRow[]).map((h) => ({
          rank: h.rank,
          hero_id: h.hero_id,
          user_id: h.user_id,
          display_name: h.display_name ?? '',
          avatar_url: h.avatar_url,
          level: h.level,
          xp: h.xp,
          gold: h.gold,
          streak: h.streak_current ?? 0,
          is_self: h.is_self,
        }))
      : [];

    let selfRank: number | null = null;
    let selfTotal = 0;
    if (meRow && Array.isArray(meRow) && meRow.length > 0) {
      const me = meRow[0] as RpcRankRow;
      selfRank = me.rank > 0 ? me.rank : null;
      selfTotal = me.total ?? 0;
    }

    return { entries, selfRank, selfTotal };
  }, [supabase, user, scope]);

  const { data, loading, refetch } = useCachedFetch<LeaderboardCached>(cacheKey, fetcher);

  return {
    entries: data?.entries ?? [],
    selfRank: data?.selfRank ?? null,
    selfTotal: data?.selfTotal ?? 0,
    loading,
    refetch,
  };
}
