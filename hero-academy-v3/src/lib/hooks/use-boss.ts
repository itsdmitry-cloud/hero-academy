'use client';
/**
 * @deprecated — This hook manages `boss_events` table which is NO LONGER USED.
 * The active boss system is `subject_bosses`, managed by:
 *   - grade-batch/route.ts (damage via grading)
 *   - action/route.ts (damage via teacher XP grants)
 *   - distributeBossKillRewards() in constants.ts (kill rewards)
 * 
 * This file and the boss_events/boss_participants tables can be removed
 * once the student boss battle UI (/boss/[id]/page.tsx) is migrated
 * to use subject_bosses or deleted.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

const supabase = createClient();

export interface BossEvent {
  id: string;
  class_id: string;
  boss_name: string;
  boss_avatar: string | null;
  boss_hp: number;
  boss_hp_current: number;
  timer_minutes: number;
  status: 'pending' | 'active' | 'defeated' | 'expired';
  rewards: { xp?: number; gold?: number };
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface BossParticipant {
  hero_id: string;
  damage_dealt: number;
  hp_lost: number;
  answers_correct: number;
  answers_wrong: number;
  display_name: string;
}

export function useBoss(classId: string | null) {
  const { user, profile } = useAuth();
  const [activeBosses, setActiveBosses] = useState<BossEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeSub = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchBosses = useCallback(async () => {
    if (!classId) { setLoading(false); return; }
    const { data } = await supabase
      .from('boss_events')
      .select('*')
      .eq('class_id', classId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false });
    if (data) setActiveBosses(data as BossEvent[]);
    setLoading(false);
  }, [classId]);

  // Real-time subscription on boss_events for this class
  useEffect(() => {
    if (!classId) return;
    fetchBosses();

    const channel = supabase
      .channel(`boss_class_${classId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'boss_events',
        filter: `class_id=eq.${classId}`,
      }, (payload) => {
        const updated = payload.new as BossEvent;
        setActiveBosses(prev => {
          const idx = prev.findIndex(b => b.id === updated.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [updated, ...prev];
        });
      })
      .subscribe();

    realtimeSub.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [classId, fetchBosses]);

  /* ── Teacher: create boss event ── */
  const createBoss = useCallback(async (params: {
    bossName: string;
    bossHp: number;
    timerMinutes: number;
    rewards: { xp: number; gold: number };
    bossAvatar?: string;
  }) => {
    if (!user || !classId) return { error: 'Not authenticated' };
    const { data, error } = await supabase.from('boss_events').insert({
      class_id: classId,
      created_by: user.id,
      boss_name: params.bossName,
      boss_hp: params.bossHp,
      boss_hp_current: params.bossHp,
      boss_avatar: params.bossAvatar ?? null,
      timer_minutes: params.timerMinutes,
      status: 'pending',
      rewards: params.rewards,
    }).select('id').single();
    if (error) return { error: error.message, id: null };
    return { error: null, id: data.id };
  }, [user, classId]);

  /* ── Teacher: start boss event ── */
  const startBoss = useCallback(async (bossId: string) => {
    const { error } = await supabase.from('boss_events').update({
      status: 'active',
      started_at: new Date().toISOString(),
    }).eq('id', bossId);
    return { error: error?.message ?? null };
  }, []);

  /* ── Student: deal damage to boss ── */
  const dealDamage = useCallback(async (bossId: string, damage: number, isCorrect: boolean) => {
    if (!user || !profile) return { error: 'Not authenticated' };

    const { data: hero } = await supabase.from('heroes')
      .select('id, hp').eq('user_id', user.id).single();
    if (!hero) return { error: 'Hero not found' };

    // Get current boss HP
    const { data: boss } = await supabase.from('boss_events')
      .select('boss_hp_current, boss_hp').eq('id', bossId).single();
    if (!boss) return { error: 'Boss not found' };

    const newBossHp = Math.max(0, boss.boss_hp_current - (isCorrect ? damage : 0));
    const heroHpLoss = isCorrect ? 0 : Math.floor(damage * 0.5); // mistakes damage hero

    // Update boss HP
    const updates: Partial<BossEvent> = { boss_hp_current: newBossHp };
    if (newBossHp === 0) {
      updates.status = 'defeated';
      updates.ended_at = new Date().toISOString();
    }

    const { error: bossErr } = await supabase.from('boss_events').update(updates).eq('id', bossId);
    if (bossErr) return { error: bossErr.message };

    // Update participant record (READ → INCREMENT → WRITE)
    const { data: existing } = await supabase.from('boss_participants')
      .select('damage_dealt, hp_lost, answers_correct, answers_wrong')
      .eq('boss_event_id', bossId)
      .eq('hero_id', hero.id)
      .maybeSingle();

    if (existing) {
      // Increment existing stats
      const { error: partErr } = await supabase.from('boss_participants').update({
        damage_dealt:    existing.damage_dealt + (isCorrect ? damage : 0),
        hp_lost:         existing.hp_lost + heroHpLoss,
        answers_correct: existing.answers_correct + (isCorrect ? 1 : 0),
        answers_wrong:   existing.answers_wrong + (isCorrect ? 0 : 1),
      }).eq('boss_event_id', bossId).eq('hero_id', hero.id);
      if (partErr) return { error: partErr.message, bossDefeated: newBossHp === 0 };
    } else {
      // First participation — insert
      const { error: partErr } = await supabase.from('boss_participants').insert({
        boss_event_id: bossId,
        hero_id: hero.id,
        damage_dealt: isCorrect ? damage : 0,
        hp_lost: heroHpLoss,
        answers_correct: isCorrect ? 1 : 0,
        answers_wrong: isCorrect ? 0 : 1,
      });
      if (partErr) return { error: partErr.message, bossDefeated: newBossHp === 0 };
    }

    // Damage hero HP if wrong answer (without negating)
    if (!isCorrect && heroHpLoss > 0) {
      const newHeroHp = Math.max(0, hero.hp - heroHpLoss);
      await supabase.from('heroes').update({
        hp: newHeroHp,
        status: newHeroHp === 0 ? 'inactive' : 'active',
      }).eq('id', hero.id);
    }

    // Boss defeated — distribute rewards
    if (newBossHp === 0) {
      await distributeBossRewards(bossId);
    }

    return { error: null, bossDefeated: newBossHp === 0 };
  }, [user, profile]);

  const distributeBossRewards = async (bossId: string) => {
    const { data: boss } = await supabase.from('boss_events')
      .select('rewards, class_id').eq('id', bossId).single();
    if (!boss) return;

    const { data: participants } = await supabase.from('boss_participants')
      .select('hero_id, damage_dealt').eq('boss_event_id', bossId);
    if (!participants) return;

    const rewards = boss.rewards as { xp?: number; gold?: number };
    const totalDamage = participants.reduce((s, p) => s + p.damage_dealt, 0);

    for (const p of participants) {
      const share = totalDamage > 0 ? p.damage_dealt / totalDamage : 1 / participants.length;
      const xpEarned = Math.round((rewards.xp ?? 300) * share);
      const goldEarned = Math.round((rewards.gold ?? 100) * share);

      // Get current hero stats and add rewards
      const { data: hero } = await supabase.from('heroes').select('xp, gold').eq('id', p.hero_id).single();
      if (hero) {
        await supabase.from('heroes').update({
          xp: hero.xp + xpEarned,
          gold: hero.gold + goldEarned,
        }).eq('id', p.hero_id);
      }
    }
  };

  /* ── Get participants for a boss ── */
  const fetchParticipants = useCallback(async (bossId: string): Promise<BossParticipant[]> => {
    const { data } = await supabase
      .from('boss_participants')
      .select('hero_id, damage_dealt, hp_lost, answers_correct, answers_wrong, heroes(users(display_name))')
      .eq('boss_event_id', bossId)
      .order('damage_dealt', { ascending: false });

    if (!data) return [];
    return data.map((p: Record<string, unknown>) => {
      const hero = p.heroes as Record<string, unknown> | null;
      const u = hero?.users as Record<string, unknown> | null;
      return {
        hero_id: p.hero_id as string,
        damage_dealt: p.damage_dealt as number,
        hp_lost: p.hp_lost as number,
        answers_correct: p.answers_correct as number,
        answers_wrong: p.answers_wrong as number,
        display_name: (u?.display_name as string) ?? 'Неизвестный',
      };
    });
  }, []);

  return {
    activeBosses, loading,
    createBoss, startBoss, dealDamage, fetchParticipants,
    refetch: fetchBosses,
  };
}
