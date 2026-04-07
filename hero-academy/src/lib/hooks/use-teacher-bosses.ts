'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SeasonBossData } from './use-season-bosses';

/**
 * Same data as useSeasonBosses but scoped to a teacher's chosen class.
 * Returns identical boss names/HP so teacher and student views always match.
 */
export function useTeacherBosses(classId: string | null) {
  const supabase = createClient();
  const [bosses, setBosses] = useState<SeasonBossData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBosses = useCallback(async () => {
    if (!classId) { setBosses([]); setLoading(false); return; }

    // Get the user's school_id from the users table
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const { data: userRow } = await supabase
      .from('users').select('school_id').eq('id', session.user.id).single();
    if (!userRow?.school_id) { setLoading(false); return; }

    // Active season for this school
    const { data: season } = await supabase
      .from('seasons').select('id')
      .eq('school_id', userRow.school_id).eq('status', 'active')
      .limit(1).maybeSingle();
    if (!season) { setBosses([]); setLoading(false); return; }

    // Bosses for this class in this season
    const { data: bossesData } = await supabase
      .from('subject_bosses').select('*')
      .eq('season_id', season.id).eq('class_id', classId)
      .order('created_at', { ascending: true });

    if (!bossesData || bossesData.length === 0) { setBosses([]); setLoading(false); return; }

    // Damage logs
    const bossIds = bossesData.map(b => b.id);
    const { data: logsData } = await supabase
      .from('boss_damage_logs')
      .select('id, boss_id, hero_id, damage_dealt, action_type, created_at, heroes:hero_id(name)')
      .in('boss_id', bossIds)
      .order('created_at', { ascending: false });

    const mapped = bossesData.map(boss => {
      const bossLogs = (logsData || [])
        .filter(log => log.boss_id === boss.id)
        .map(log => ({
          id: log.id,
          boss_id: log.boss_id,
          hero_id: log.hero_id,
          damage_dealt: log.damage_dealt,
          action_type: log.action_type,
          created_at: log.created_at,
          hero: log.heroes ? { name: (log.heroes as unknown as { name: string }).name } : undefined,
        }));
      return { ...boss, damageLogs: bossLogs };
    });

    setBosses(mapped as SeasonBossData[]);
    setLoading(false);
  }, [classId, supabase]);

  useEffect(() => {
    fetchBosses();

    const channel = supabase.channel('teacher_boss_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_bosses' }, fetchBosses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boss_damage_logs' }, fetchBosses)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [classId, fetchBosses]); // eslint-disable-line react-hooks/exhaustive-deps

  return { bosses, loading, refetch: fetchBosses };
}
