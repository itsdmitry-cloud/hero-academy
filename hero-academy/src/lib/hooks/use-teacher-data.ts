'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useTeacherStore } from '@/lib/store/teacherStore';

/* ──────────── types ──────────── */
export interface ClassInfo {
  id: string;
  name: string;
  invite_code: string;
  school_id: string;
}

export interface StudentRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  hero_id: string | null;
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

export interface TeacherQuestRow {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: string;
  difficulty: string;
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  deadline: string | null;
  status: string;
  context?: string;
  created_at: string;
  attempt_count: number;
  completed_count: number;
}

export interface ClassStats {
  student_count: number;
  active_quests: number;
  avg_xp: number;
  total_xp: number;
  class_streak: number;
}

/* ──────────── hook ──────────── */
export function useTeacherData() {
  const supabase = createClient();
  const { user, profile } = useAuth();

  const subjects = profile?.subjects || [];

  const classes = useTeacherStore((s) => s.classes);
  const setClasses = useTeacherStore((s) => s.setClasses);
  const activeClassId = useTeacherStore((s) => s.activeClassId);
  const setActiveClassId = useTeacherStore((s) => s.setActiveClassId);
  const activeSubject = useTeacherStore((s) => s.activeSubject);
  const setActiveSubject = useTeacherStore((s) => s.setActiveSubject);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [quests, setQuests] = useState<TeacherQuestRow[]>([]);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-initialise activeSubject to first when profile loads
  useEffect(() => {
    if (subjects.length > 0 && !activeSubject) {
      setActiveSubject(subjects[0]);
    }
  }, [subjects.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch teacher's class list
  const fetchClasses = useCallback(async () => {
    if (!profile?.school_id) return;

    const { data } = await supabase
      .from('classes')
      .select('id, name, invite_code, school_id')
      .eq('school_id', profile.school_id)
      .order('name');

    if (data && data.length > 0) {
      setClasses(data as ClassInfo[]);
      // Only set active class if not already set
      if (!activeClassId) setActiveClassId(data[0].id);
    }
  }, [profile?.school_id, supabase, activeClassId, setActiveClassId, setClasses]);

  // Fetch students for active class
  const fetchStudents = useCallback(async (classId: string) => {
    const { data } = await supabase
      .from('users')
      .select(`
        id, display_name, avatar_url,
        heroes!left(id, level, xp, xp_to_next, hp, hp_max, gold, streak_current, streak_best, status)
      `)
      .eq('class_id', classId)
      .eq('role', 'student')
      .order('display_name');

    if (data) {
      setStudents(data.map((u: Record<string, unknown>) => {
        const hero = Array.isArray(u.heroes) ? u.heroes[0] : u.heroes as Record<string, unknown> | null;
        return {
          id: u.id as string,
          display_name: u.display_name as string,
          avatar_url: u.avatar_url as string | null,
          hero_id: hero?.id as string ?? null,
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
      }));
    }
  }, [supabase]);

  // Fetch quests for active class
  const fetchQuests = useCallback(async (classId: string) => {
    const { data } = await supabase
      .from('quests')
      .select('*, quest_attempts(count)')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (data) {
      setQuests(data.map((q: Record<string, unknown>) => ({
        id: q.id as string,
        title: q.title as string,
        description: q.description as string,
        subject: q.subject as string,
        type: q.type as string,
        difficulty: q.difficulty as string,
        xp_reward: q.xp_reward as number,
        gold_reward: q.gold_reward as number,
        hp_damage: q.hp_damage as number,
        deadline: q.deadline as string | null,
        status: q.status as string,
        context: q.context as string | undefined,
        created_at: q.created_at as string,
        attempt_count: 0,
        completed_count: 0,
      })));
    }
  }, [supabase]);

  // Compute class stats from students
  const computeStats = useCallback((studentList: StudentRow[], questList: TeacherQuestRow[]) => {
    if (studentList.length === 0) { setStats(null); return; }
    const totalXp = studentList.reduce((s, st) => s + st.xp, 0);
    const classStreak = studentList.length > 0
      ? Math.min(...studentList.map(s => s.streak))
      : 0;
    setStats({
      student_count: studentList.length,
      active_quests: questList.filter(q => q.status === 'active').length,
      avg_xp: Math.round(totalXp / studentList.length),
      total_xp: totalXp,
      class_streak: classStreak,
    });
  }, []);

  // Initial load
  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Load class-specific data when activeClassId changes
  useEffect(() => {
    if (!activeClassId) return;
    setLoading(true);
    Promise.all([fetchStudents(activeClassId), fetchQuests(activeClassId)])
      .finally(() => setLoading(false));
  }, [activeClassId, fetchStudents, fetchQuests]);

  // Recompute stats when data changes
  useEffect(() => { computeStats(students, quests); }, [students, quests, computeStats]);

  /* ── Teacher actions (routed through game pipeline) ── */
  const grantXp = useCallback(async (heroId: string, amount: number, reason: string, subject: string = '') => {
    if (!heroId || !user) return { error: 'Hero or user not found', pipeline: [] };

    // Optimistic update
    setStudents(prev => prev.map(s =>
      s.hero_id === heroId ? { ...s, xp: s.xp + amount } : s
    ));

    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hero_id: heroId,
        action: 'grant_xp',
        base_amount: amount,
        reason,
        subject,
        teacher_id: user.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Unknown error', pipeline: [] };

    // Refresh with real data
    if (activeClassId) fetchStudents(activeClassId);
    return { error: null, pipeline: data.pipeline ?? [], final_amount: data.final_amount };
  }, [user, activeClassId, fetchStudents]);

  const damageHp = useCallback(async (heroId: string, amount: number, reason: string, subject: string = '') => {
    if (!heroId || !user) return { error: 'Hero or user not found', pipeline: [] };

    // Optimistic update
    setStudents(prev => prev.map(s => {
      if (s.hero_id !== heroId) return s;
      const newHp = Math.max(0, s.hp - amount);
      return { ...s, hp: newHp, status: newHp === 0 ? 'inactive' : 'active' };
    }));

    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hero_id: heroId,
        action: 'damage',
        base_amount: amount,
        reason,
        subject,
        teacher_id: user.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Unknown error', pipeline: [] };

    // Refresh with real data
    if (activeClassId) fetchStudents(activeClassId);
    return { error: null, pipeline: data.pipeline ?? [], final_amount: data.final_amount, new_hp: data.new_hp };
  }, [user, activeClassId, fetchStudents]);

  const createQuest = useCallback(async (questData: {
    title: string;
    description: string;
    subject: string;
    type: string;
    difficulty: string;
    xp_reward: number;
    gold_reward: number;
    hp_damage: number;
    deadline: string | null;
    context?: string;
  }) => {
    if (!activeClassId || !user) return { error: 'No active class or user' };
    const { context = 'homework', ...rest } = questData;
    const { error } = await supabase.from('quests').insert({
      ...rest,
      context,
      class_id: activeClassId,
      created_by: user.id,
      status: 'active',
    });
    if (!error && activeClassId) fetchQuests(activeClassId);
    return { error: error?.message ?? null };
  }, [activeClassId, user, supabase, fetchQuests]);

  return {
    classes,
    subjects,
    activeClassId,
    setActiveClassId,
    activeSubject,
    students,
    quests,
    stats,
    loading,
    grantXp,
    damageHp,
    createQuest,
    refetch: () => {
      if (activeClassId) {
        fetchStudents(activeClassId);
        fetchQuests(activeClassId);
      }
    },
  };
}
