'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useToastStore } from '@/lib/store/toastStore';

/* ──────────── types ──────────── */
export interface HeroData {
  id: string;
  user_id: string;
  name: string;
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
  streak: number;        // maps from streak_current
  streak_current: number;
  streak_best: number;
  status: string;
  gender: 'male' | 'female';
}

export interface HeroStats {
  strength: number;
  knowledge: number;
  endurance: number;
  luck: number;
  wisdom: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  xp_reward: number;
  gold_reward: number;
  unlocked: boolean;
  unlocked_at?: string;
}

/* ──────────── hook ──────────── */
export function useHero() {
  const supabase = createClient();
  const { user } = useAuth();
  const [hero, setHero] = useState<HeroData | null>(null);
  const [stats, setStats] = useState<HeroStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Streak milestone auto-rewards (XP + Gold + Loot Box) ── */
  // Uses streak_rewards (config template) + streak_claims (per-hero history, FK)
  const checkStreakRewards = useCallback(async (heroId: string, streak: number) => {
    // 1. Load all streak reward config rows from DB
    const { data: rewardConfig } = await supabase
      .from('streak_rewards')
      .select('id, day_threshold, xp_bonus, gold_bonus')
      .order('day_threshold', { ascending: true });

    if (!rewardConfig || rewardConfig.length === 0) return;

    // 2. Load already claimed rewards for this hero
    const { data: claims } = await supabase
      .from('streak_claims')
      .select('streak_reward_id')
      .eq('hero_id', heroId);

    const claimedIds = new Set((claims ?? []).map((c: Record<string, unknown>) => c.streak_reward_id as string));

    // 3. Award unclaimed milestones the hero has reached
    for (const reward of rewardConfig as Record<string, unknown>[]) {
      const dayThreshold = reward.day_threshold as number;
      const rewardId     = reward.id as string;
      const xpBonus      = (reward.xp_bonus as number) ?? 0;
      const goldBonus    = (reward.gold_bonus as number) ?? 0;

      if (streak < dayThreshold || claimedIds.has(rewardId)) continue;

      // XP + Gold with level-up check
      const { data: h } = await supabase
        .from('heroes')
        .select('xp, level, xp_to_next, gold')
        .eq('id', heroId)
        .single();

      if (h) {
        const newXp = (h.xp as number) + xpBonus;
        let newLevel = h.level as number;
        while (newXp >= newLevel * (1000 + 250 * (newLevel + 1))) { newLevel++; }
        const heroUpd: Record<string, unknown> = {
          xp: newXp,
          gold: (h.gold as number) + goldBonus,
        };
        if (newLevel > (h.level as number)) {
          heroUpd.level = newLevel;
          heroUpd.xp_to_next = newLevel * (1000 + 250 * (newLevel + 1));
        }
        await supabase.from('heroes').update(heroUpd).eq('id', heroId);
      }

      // 🎁 Loot box: tier by day_threshold
      const boxRarity = dayThreshold >= 30 ? 'epic' : dayThreshold >= 14 ? 'rare' : 'common';
      const { data: box } = await supabase
        .from('artifacts')
        .select('id')
        .eq('effect', 'lootbox')
        .eq('rarity', boxRarity)
        .single();

      if (box) {
        await supabase.from('hero_artifacts').insert({
          hero_id:           heroId,
          artifact_id:       (box as Record<string, unknown>).id,
          source:            'reward',
          quantity:          1,
          charges_remaining: 1,
        });
      }

      // ✅ Record the claim (correct schema: hero_id + streak_reward_id FK)
      await supabase.from('streak_claims').insert({
        hero_id:          heroId,
        streak_reward_id: rewardId,
      });
    }
  }, [supabase]);

  /* ── Open loot box: guaranteed drop with weighted rarity ── */
  const openLootbox = useCallback(async (heroArtifactId: string, boxRarity: string): Promise<{
    success: boolean;
    artifact?: { id: string; name: string; icon: string; rarity: string } | null;
    error?: string;
  }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const res = await fetch('/api/game/open-lootbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroArtifactId, boxRarity, userId: user.id }),
    });
    const data = await res.json();
    return data;
  }, [supabase]);


  /* ── Achievement auto-unlock ── */
  const checkAchievements = useCallback(async (heroId: string, heroData: HeroData, achievementList: Achievement[]) => {
    const locked = achievementList.filter(a => !a.unlocked);
    if (locked.length === 0) return;

    // Fetch counts we'll need (only once, not per achievement)
    let questCount: number | null = null;
    let bossCount: number | null = null;
    let artifactCount: number | null = null;

    for (const a of locked) {
      let met = false;
      const streak = heroData.streak_current ?? heroData.streak ?? 0;

      switch (a.condition_type) {
        case 'xp_total':           met = heroData.xp    >= a.condition_value; break;
        case 'level':              met = heroData.level  >= a.condition_value; break;
        case 'streak':
        case 'streak_days':        met = streak          >= a.condition_value; break;

        case 'quests_done':
        case 'quests_completed': {
          if (questCount === null) {
            const { count } = await supabase.from('activity_log')
              .select('id', { count: 'exact', head: true })
              .eq('hero_id', heroId)
              .in('action', ['teacher_xp_grant', 'quest_complete', 'quest_completed']);
            questCount = count ?? 0;
          }
          met = questCount >= a.condition_value;
          break;
        }
        case 'bosses_killed': {
          if (bossCount === null) {
            const { count } = await supabase.from('activity_log')
              .select('id', { count: 'exact', head: true })
              .eq('hero_id', heroId).eq('action', 'boss_kill_reward');
            bossCount = count ?? 0;
          }
          met = bossCount >= a.condition_value;
          break;
        }
        case 'artifacts_collected': {
          if (artifactCount === null) {
            const { count } = await supabase.from('hero_artifacts')
              .select('id', { count: 'exact', head: true }).eq('hero_id', heroId);
            artifactCount = count ?? 0;
          }
          met = artifactCount >= a.condition_value;
          break;
        }
        case 'gold_total':         met = (heroData.gold ?? 0) >= a.condition_value; break;
      }

      if (!met) continue;

      // Upsert into achievements_unlocked (correct table name in DB)
      const { error: dupErr } = await supabase
        .from('achievements_unlocked')
        .insert({ hero_id: heroId, achievement_id: a.id });
      if (dupErr) continue; // already unlocked (unique constraint)

      // Grant XP + Gold reward
      const { data: h } = await supabase.from('heroes').select('xp, gold').eq('id', heroId).single();
      if (h) {
        await supabase.from('heroes').update({
          xp:   (h.xp   as number) + (a.xp_reward   ?? 0),
          gold: (h.gold as number) + (a.gold_reward ?? 0),
        }).eq('id', heroId);
      }

      // Show toast
      useToastStore.getState().addToast({
        title: '🏆 Достижение!',
        message: `Разблокировано: ${a.name}`,
        type: 'info',
      });
    }
  }, [supabase]);

  const fetchHero = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const [heroRes, achRes, unlockedRes] = await Promise.all([
      supabase.from('heroes').select('*').eq('user_id', user.id).single(),
      supabase.from('achievements').select('*'),
      supabase.from('achievements_unlocked').select('achievement_id, unlocked_at'),
    ]);

    if (!heroRes.data) { setLoading(false); return; }
    const heroRow = heroRes.data as HeroData;
    setHero(heroRow);

    // Fetch stats separately
    const { data: statsData } = await supabase
      .from('hero_stats')
      .select('strength, knowledge, endurance, luck, wisdom')
      .eq('hero_id', heroRow.id)
      .single();
    if (statsData) setStats(statsData as HeroStats);

    // Merge achievements with unlocked status
    const achievementList: Achievement[] = [];
    if (achRes.data) {
      const unlockedMap = new Map(
        (unlockedRes.data || []).map((u: { achievement_id: string; unlocked_at: string }) => [u.achievement_id, u.unlocked_at])
      );
      achRes.data.forEach((a: {
        id: string; name: string; description: string; icon: string;
        condition_type: string; condition_value: number; xp_reward: number; gold_reward: number;
      }) => {
        achievementList.push({
          ...a,
          unlocked: unlockedMap.has(a.id),
          unlocked_at: unlockedMap.get(a.id) as string | undefined,
        });
      });
      setAchievements(achievementList);
    }

    // ✨ Auto-checks — fire-and-forget (non-blocking)
    void checkStreakRewards(heroRow.id, heroRow.streak_current ?? heroRow.streak ?? 0);
    void checkAchievements(heroRow.id, heroRow, achievementList);

    setLoading(false);
  }, [user, supabase, checkStreakRewards, checkAchievements]);

  useEffect(() => { fetchHero(); }, [fetchHero]);

  return { hero, stats, achievements, loading, refetch: fetchHero, openLootbox };
}
