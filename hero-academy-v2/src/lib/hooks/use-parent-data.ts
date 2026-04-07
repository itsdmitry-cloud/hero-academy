'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

export interface ChildHero {
  user_id: string;
  display_name: string;
  class_name: string;
  school_name: string;
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
  streak: number;
  streak_best: number;
  status: string;
}

export interface ChildQuest {
  id: string;
  title: string;
  subject: string;
  type: string;
  difficulty: string;
  xp_reward: number;
  gold_reward: number;
  deadline: string | null;
  status: string;
  attempt_status: string | null;
  grade: number | null;
  submitted_at: string | null;
}

export function useParentData() {
  const supabase = createClient();
  const { user, profile } = useAuth();

  const [children, setChildren] = useState<ChildHero[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [quests, setQuests] = useState<ChildQuest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;

    async function fetchChildren() {
      // Parent's children are stored in users.parent_id
      const { data: kids } = await supabase
        .from('users')
        .select(`
          id, display_name, class_id,
          classes!left(name, school_id, schools!left(name)),
          heroes!left(level, xp, xp_to_next, hp, hp_max, gold, streak_current, streak_best, status)
        `)
        .eq('parent_id', user!.id)
        .eq('role', 'student');

      if (kids && kids.length > 0) {
        const mapped: ChildHero[] = kids.map((kid: Record<string, unknown>) => {
          const hero = Array.isArray(kid.heroes) ? kid.heroes[0] : kid.heroes as Record<string, unknown> | null;
          const cls = kid.classes as Record<string, unknown> | null;
          const school = cls?.schools as Record<string, unknown> | null;
          return {
            user_id: kid.id as string,
            display_name: kid.display_name as string,
            class_name: (cls?.name as string) ?? '—',
            school_name: (school?.name as string) ?? '—',
            level: (hero?.level as number) ?? 1,
            xp: (hero?.xp as number) ?? 0,
            xp_to_next: (hero?.xp_to_next as number) ?? 100,
            hp: (hero?.hp as number) ?? 100,
            hp_max: (hero?.hp_max as number) ?? 100,
            gold: (hero?.gold as number) ?? 0,
            streak: (hero?.streak_current as number) ?? 0,
            streak_best: (hero?.streak_best as number) ?? 0,
            status: (hero?.status as string) ?? 'active',
          };
        });
        setChildren(mapped);
        setActiveChildId(prev => prev ?? mapped[0].user_id);
      }
      setLoading(false);
    }

    fetchChildren();
  }, [user, profile, supabase]);

  // Fetch quests for the active child
  useEffect(() => {
    if (!activeChildId) return;

    async function fetchChildQuests() {
      // Get child's class_id
      const { data: kid } = await supabase
        .from('users')
        .select('class_id')
        .eq('id', activeChildId)
        .single();

      if (!kid?.class_id) return;

      const { data } = await supabase
        .from('quests')
        .select(`
          id, title, subject, type, difficulty, xp_reward, gold_reward, deadline, status,
          quest_attempts!left(status, grade, submitted_at)
        `)
        .eq('class_id', kid.class_id)
        .eq('status', 'active')
        .order('deadline');

      if (data) {
        setQuests(data.map((q: Record<string, unknown>) => {
          const attempt = Array.isArray(q.quest_attempts) ? q.quest_attempts[0] : q.quest_attempts as Record<string, unknown> | null;
          return {
            id: q.id as string,
            title: q.title as string,
            subject: q.subject as string,
            type: q.type as string,
            difficulty: q.difficulty as string,
            xp_reward: q.xp_reward as number,
            gold_reward: q.gold_reward as number,
            deadline: q.deadline as string | null,
            status: q.status as string,
            attempt_status: (attempt?.status as string) ?? null,
            grade: (attempt?.grade as number) ?? null,
            submitted_at: (attempt?.submitted_at as string) ?? null,
          };
        }));
      }
    }

    fetchChildQuests();
  }, [activeChildId, supabase]);

  const activeChild = children.find(c => c.user_id === activeChildId) ?? null;

  return { children, activeChild, activeChildId, setActiveChildId, quests, loading, isLive: !!user };
}
