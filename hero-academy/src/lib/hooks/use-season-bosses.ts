'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import type { SubjectBoss, BossDamageLog } from '@/types/boss';

export interface SeasonBossData extends SubjectBoss {
  damageLogs: BossDamageLog[];
}

export function useSeasonBosses() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [bosses, setBosses] = useState<SeasonBossData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBosses() {
      if (!profile?.class_id || !profile?.school_id) {
        setLoading(false);
        return;
      }

      // Step 1: find active season
      const { data: activeSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('school_id', profile.school_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (seasonError || !activeSeason) {
        setBosses([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch bosses
      let query = supabase
        .from('subject_bosses')
        .select('*')
        .eq('season_id', activeSeason.id)
        .eq('class_id', profile.class_id);

      if (profile.role === 'student' && profile.subjects && profile.subjects.length > 0) {
        query = query.in('subject_id', profile.subjects);
      }

      const { data: bossesData, error: bossesError } = await query.order('created_at', { ascending: true });

      if (bossesError || !bossesData || bossesData.length === 0) {
        setBosses(bossesData?.map(b => ({ ...b, damageLogs: [] })) ?? []);
        setLoading(false);
        return;
      }

      // Step 3: fetch logs — render bosses immediately, logs arrive async
      setBosses(bossesData.map(b => ({ ...b, damageLogs: [] })));
      setLoading(false);

      const bossIds = bossesData.map(b => b.id);
      const { data: logsData } = await supabase
        .from('boss_damage_logs')
        .select('id, boss_id, hero_id, damage_dealt, action_type, created_at, heroes:hero_id(name)')
        .in('boss_id', bossIds)
        .order('created_at', { ascending: false });

      if (logsData) {
        setBosses(bossesData.map(boss => {
          const bossLogs = logsData.filter(log => log.boss_id === boss.id).map(log => ({
            id: log.id,
            boss_id: log.boss_id,
            hero_id: log.hero_id,
            damage_dealt: log.damage_dealt,
            action_type: log.action_type,
            created_at: log.created_at,
            hero: log.heroes ? { name: (log.heroes as any).name } : undefined
          }));
          return { ...boss, damageLogs: bossLogs };
        }));
      }
    }

    fetchBosses();
    
    // Set up realtime subscription for boss HP and logs updates
    const channel = supabase.channel('boss_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subject_bosses' },
        () => fetchBosses()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boss_damage_logs' },
        () => fetchBosses()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.class_id, profile?.school_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { bosses, loading };
}
