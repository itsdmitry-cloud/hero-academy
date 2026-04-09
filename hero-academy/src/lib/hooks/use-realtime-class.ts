'use client';

/**
 * useRealtimeClass — subscribes to live hero updates for ALL students in a class.
 * Used by teacher's "Live" radar view to see HP/XP changes in real time.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LiveStudentState {
  hero_id: string;
  user_id: string;
  display_name: string;
  hp: number;
  hp_max: number;
  xp: number;
  level: number;
  streak_current: number;
  status: string;
  lastUpdated: number; // timestamp for animation trigger
}

export function useRealtimeClass(classId: string | null) {
  const supabase = createClient();
  const [students, setStudents] = useState<LiveStudentState[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared fetcher — returns the next students state, does NOT mutate it.
  // Keeping state mutations out of this function means react-hooks/set-state-in-effect
  // only ever sees setState inside the effect's async IIFE.
  const loadStudents = useCallback(async (): Promise<LiveStudentState[] | null> => {
    if (!classId) return null;

    // Step 1: Get all students in this class
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('class_id', classId)
      .eq('role', 'student');

    if (usersErr || !usersData || usersData.length === 0) {
      console.warn('[useRealtimeClass] No students found:', usersErr?.message);
      return [];
    }

    // Step 2: Get heroes for these students
    const userIds = usersData.map(u => u.id);
    const { data: heroesData } = await supabase
      .from('heroes')
      .select('id, user_id, hp, hp_max, xp, level, streak_current, status')
      .in('user_id', userIds);

    const heroMap = new Map<string, Record<string, unknown>>();
    if (heroesData) {
      for (const h of heroesData) {
        heroMap.set(h.user_id, h);
      }
    }

    return usersData.map(u => {
      const hero = heroMap.get(u.id);
      return {
        hero_id: (hero?.id as string) ?? '',
        user_id: u.id,
        display_name: u.display_name,
        hp: (hero?.hp as number) ?? 100,
        hp_max: (hero?.hp_max as number) ?? 100,
        xp: (hero?.xp as number) ?? 0,
        level: (hero?.level as number) ?? 1,
        streak_current: (hero?.streak_current as number) ?? 0,
        status: (hero?.status as string) ?? 'active',
        lastUpdated: Date.now(),
      };
    });
  }, [classId, supabase]);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadStudents();
      if (cancelled || next === null) return;
      setStudents(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadStudents]);

  // Imperative refetch for callers (e.g. manual refresh)
  const fetchAll = useCallback(async () => {
    const next = await loadStudents();
    if (next !== null) {
      setStudents(next);
      setLoading(false);
    }
  }, [loadStudents]);

  // Subscribe to hero changes for students in this class.
  // setState inside the channel callback is an external-store update,
  // which react-hooks/set-state-in-effect permits.
  useEffect(() => {
    if (!classId) return;

    const channel = supabase
      .channel(`class:${classId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'heroes',
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setStudents(prev => prev.map(s =>
            s.hero_id === updated.id
              ? {
                  ...s,
                  hp: updated.hp as number,
                  xp: updated.xp as number,
                  level: updated.level as number,
                  streak_current: updated.streak_current as number,
                  status: updated.status as string,
                  lastUpdated: Date.now(),
                }
              : s
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [classId, supabase]);

  /**
   * Optimistically update a specific hero's stats in local state
   * immediately after a DB write — without waiting for the realtime event.
   */
  const optimisticUpdate = useCallback((
    heroId: string,
    patch: Partial<Pick<LiveStudentState, 'hp' | 'xp' | 'level' | 'streak_current' | 'status'>>
  ) => {
    setStudents(prev => prev.map(s =>
      s.hero_id === heroId
        ? { ...s, ...patch, lastUpdated: Date.now() }
        : s
    ));
  }, []);

  return { students, loading, refetch: fetchAll, optimisticUpdate };
}

