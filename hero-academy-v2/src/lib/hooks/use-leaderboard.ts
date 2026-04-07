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

/* ──────────── hook ──────────── */
export function useLeaderboard(scope: 'class' | 'school' = 'class') {
  const supabase = createClient();
  const { profile, user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!profile) { setLoading(false); return; }

    // Get heroes with user info, filtered by class or school
    let query = supabase
      .from('heroes')
      .select('id, user_id, name, level, xp, gold, streak_current, users!inner(display_name, avatar_url, class_id, school_id)')
      .order('xp', { ascending: false })
      .limit(50);

    if (scope === 'class' && profile.class_id) {
      query = query.eq('users.class_id', profile.class_id);
    } else if (scope === 'school' && profile.school_id) {
      query = query.eq('users.school_id', profile.school_id);
    }

    const { data } = await query;

    if (data) {
      setEntries(
        data.map((h: Record<string, unknown>, i: number) => {
          const u = h.users as Record<string, unknown> | null;
          return {
            rank: i + 1,
            hero_id: h.id as string,
            user_id: h.user_id as string,
            display_name: (u?.display_name as string) ?? (h.name as string),
            avatar_url: (u?.avatar_url as string | null) ?? null,
            level: h.level as number,
            xp: h.xp as number,
            gold: h.gold as number,
            streak: (h.streak_current as number) ?? 0,
            is_self: h.user_id === user?.id,
          };
        })
      );
    }

    setLoading(false);
  }, [profile, user, scope, supabase]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  return { entries, loading, refetch: fetchLeaderboard };
}
