'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

interface RpcRankRow {
  rank: number;
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
  const [rank, setRank] = useState<number | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase.rpc('get_user_rating_rank', {
        p_user_id: user.id,
        p_scope: scope,
      });
      if (cancelled) return;
      if (data && Array.isArray(data) && data.length > 0) {
        const me = data[0] as RpcRankRow;
        setRank(me.rank > 0 ? me.rank : null);
        setTotal(me.total ?? 0);
      } else {
        setRank(null);
        setTotal(0);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, scope, supabase]);

  return { rank, total, loading };
}
