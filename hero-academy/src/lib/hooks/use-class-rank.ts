'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useCachedFetch } from './use-cached-fetch';

interface RpcRankRow {
  rank: number;
  total: number;
}

interface RankCached {
  rank: number | null;
  total: number;
}

/**
 * Lightweight hook for the home page tile "Ранг в классе".
 * Returns the current student's rank (1-based) and total student count
 * within the requested scope. `rank` is null when the student has no peers
 * (no class assigned, or class has zero heroes).
 */
export function useClassRank(scope: 'class' | 'school' = 'class') {
  const supabase = createClient();
  const { user } = useAuth();
  const cacheKey = user ? `class-rank:${scope}:${user.id}` : null;

  const fetcher = useCallback(async () => {
    const { data } = await supabase.rpc('get_user_rating_rank', {
      p_user_id: user!.id,
      p_scope: scope,
    });
    if (data && Array.isArray(data) && data.length > 0) {
      const me = data[0] as RpcRankRow;
      return { rank: me.rank > 0 ? me.rank : null, total: me.total ?? 0 };
    }
    return { rank: null, total: 0 };
  }, [supabase, user, scope]);

  const { data, loading } = useCachedFetch<RankCached>(cacheKey, fetcher);

  return { rank: data?.rank ?? null, total: data?.total ?? 0, loading };
}
