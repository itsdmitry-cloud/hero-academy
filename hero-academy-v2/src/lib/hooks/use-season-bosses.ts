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

      // Find active season for the school
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

      // Fetch bosses for the current class in this season
      const { data: bossesData, error: bossesError } = await supabase
        .from('subject_bosses')
        .select('*')
        .eq('season_id', activeSeason.id)
        .eq('class_id', profile.class_id)
        .order('created_at', { ascending: true });

      if (bossesError || !bossesData) {
        setBosses([]);
        setLoading(false);
        return;
      }

      // Fetch damage logs for these bosses
      if (bossesData.length > 0) {
        const bossIds = bossesData.map(b => b.id);
        const { data: logsData } = await supabase
          .from('boss_damage_logs')
          .select('id, boss_id, hero_id, damage_dealt, action_type, created_at, heroes:hero_id(name)')
          .in('boss_id', bossIds)
          .order('created_at', { ascending: false });

        const mappedBosses = bossesData.map(boss => {
          const bossLogs = (logsData || []).filter(log => log.boss_id === boss.id).map(log => ({
            id: log.id,
            boss_id: log.boss_id,
            hero_id: log.hero_id,
            damage_dealt: log.damage_dealt,
            action_type: log.action_type,
            created_at: log.created_at,
            hero: log.heroes ? { name: (log.heroes as any).name } : undefined
          }));
          return { ...boss, damageLogs: bossLogs };
        });

        setBosses(mappedBosses);
      } else {
        setBosses([]);
      }
      
      setLoading(false);
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
