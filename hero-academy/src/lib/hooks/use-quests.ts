'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

/* ──────────── types ──────────── */
export interface QuestData {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: 'quest' | 'dungeon' | 'boss';
  difficulty: 'easy' | 'medium' | 'hard';
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  deadline: string | null;
  status: string;
  grade_enabled: boolean;
  created_at: string;
  // joined from quest_attempts
  attempt_status?: 'in_progress' | 'completed' | 'failed' | 'graded';
  attempt_progress?: number;
  attempt_grade?: number;
  attempt_comment?: string;
}

/* ──────────── hook ──────────── */
export function useQuests() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuests = useCallback(async () => {
    if (!profile?.class_id) { setLoading(false); return; }

    // Fetch quests for this class
    const { data: questsData } = await supabase
      .from('quests')
      .select('*')
      .eq('class_id', profile.class_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!questsData) { setLoading(false); return; }

    // Fetch hero id
    const { data: hero } = await supabase
      .from('heroes')
      .select('id')
      .eq('user_id', profile.id)
      .single();

    if (!hero) {
      setQuests(questsData as QuestData[]);
      setLoading(false);
      return;
    }

    // Fetch attempts for these quests
    const questIds = questsData.map((q: { id: string }) => q.id);
    const { data: attempts } = await supabase
      .from('quest_attempts')
      .select('quest_id, status, current_stage, grade, teacher_comment')
      .eq('hero_id', hero.id)
      .in('quest_id', questIds);

    const attemptMap = new Map(
      (attempts || []).map((a: { quest_id: string; status: string; current_stage: number; grade: number; teacher_comment: string }) => [a.quest_id, a])
    );

    setQuests(
      questsData.map((q: { id: string }) => {
        const attempt = attemptMap.get(q.id) as { status?: string; current_stage?: number; grade?: number; teacher_comment?: string } | undefined;
        return {
          ...q,
          attempt_status: attempt?.status,
          attempt_progress: attempt?.current_stage,
          attempt_grade: attempt?.grade,
          attempt_comment: attempt?.teacher_comment,
        };
      }) as QuestData[]
    );

    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchQuests();
    })();
    return () => { cancelled = true; };
  }, [fetchQuests]);

  return { quests, loading, refetch: fetchQuests };
}
