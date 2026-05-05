'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

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

/* ──────────── hook ──────────── */
export function useLeaderboard(scope: 'class' | 'school' = 'class') {
  const supabase = createClient();
  const { profile, user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selfRank, setSelfRank] = useState<number | null>(null);
  const [selfTotal, setSelfTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!profile || !user) { setLoading(false); return; }

    const [{ data: list }, { data: meRow }] = await Promise.all([
      supabase.rpc('get_rating_leaderboard', {
        p_user_id: user.id,
        p_scope: scope,
        p_limit: 50,
      }),
      supabase.rpc('get_user_rating_rank', {
        p_user_id: user.id,
        p_scope: scope,
      }),
    ]);

    if (list) {
      const rows = list as RpcLeaderboardRow[];
      setEntries(
        rows.map((h) => ({
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
        })),
      );
    }

    if (meRow && Array.isArray(meRow) && meRow.length > 0) {
      const me = meRow[0] as RpcRankRow;
      setSelfRank(me.rank > 0 ? me.rank : null);
      setSelfTotal(me.total ?? 0);
    } else {
      setSelfRank(null);
      setSelfTotal(0);
    }

    setLoading(false);
  }, [profile, user, scope, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchLeaderboard();
    })();
    return () => { cancelled = true; };
  }, [fetchLeaderboard]);

  return { entries, selfRank, selfTotal, loading, refetch: fetchLeaderboard };
}
