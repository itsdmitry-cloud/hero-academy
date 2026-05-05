'use client';

/**
 * useAdminData — comprehensive admin data access hook.
 * Covers: schools, classes, users, analytics, economy settings, shop, seasons.
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cumulativeXpForLevel } from '@/lib/game/math';

const supabase = createClient();

/* ──────── Types ──────── */
export interface AdminSchool {
  id: string;
  name: string;
  created_at: string;
}

export interface AdminClass {
  id: string;
  name: string;
  invite_code: string;
  school_id: string;
  student_count: number;
  teacher_name: string | null;
  avg_xp: number;
  class_streak: number;
}

export interface AdminUser {
  id: string;
  display_name: string;
  role: string;
  email: string | null;
  school_id: string | null;
  school_name: string | null;
  class_id: string | null;
  class_name: string | null;
  hero_level: number | null;
  hero_xp: number | null;
  hero_status: string | null;
  last_sign_in: string | null;
}

export interface EconomyConfig {
  id: string;
  scope: 'global' | 'school' | 'class';
  scope_id: string | null;
  dmg_multiplier: number;
  xp_multiplier: number;
  gold_multiplier: number;
  drop_rate_multiplier: number;
  boss_hp_multiplier: number;
  hp_regen_rate: number;
}

export interface AdminShopItem {
  id: string;
  name: string;
  category: string;
  price_gold: number;
  stock: number | null;
  is_active: boolean;
  description: string;
}

export interface AdminSeason {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  school_id: string;
}

export interface AdminSubject {
  id: string;
  name: string;
}

export interface AdminAnalytics {
  total_students: number;
  total_teachers: number;
  total_schools: number;
  active_quests: number;
  avg_xp: number;
  hero_deaths: number;
  gold_in_circulation: number;
}

/* ──────── Hook ──────── */
export function useAdminData() {
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [shopItems, setShopItems] = useState<AdminShopItem[]>([]);
  const [seasons, setSeasons] = useState<AdminSeason[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [economyConfig, setEconomyConfig] = useState<EconomyConfig[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Schools ── */
  const fetchSchools = useCallback(async () => {
    const { data } = await supabase.from('schools').select('*').order('name');
    if (data) setSchools(data as AdminSchool[]);
  }, []);

  /* ── Classes with aggregated stats ── */
  const fetchClasses = useCallback(async (schoolId?: string) => {
    let q = supabase.from('classes').select(`
      id, name, invite_code, school_id
    `);
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data } = await q.order('name');

    if (!data) return;

    // Enrich with student counts and avg XP
    const enriched: AdminClass[] = await Promise.all(data.map(async (cls: Record<string, unknown>) => {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id as string)
        .eq('role', 'student');

      const { data: heroData } = await supabase
        .from('heroes')
        .select('xp, streak_current')
        .in('user_id',
          (await supabase.from('users').select('id').eq('class_id', cls.id as string).eq('role', 'student')).data?.map((u: Record<string, unknown>) => u.id) ?? []
        );

      const avg_xp = heroData && heroData.length > 0
        ? Math.round(heroData.reduce((s: number, h: Record<string, unknown>) => s + (h.xp as number || 0), 0) / heroData.length)
        : 0;

      const class_streak = heroData && heroData.length > 0
        ? Math.min(...heroData.map((h: Record<string, unknown>) => h.streak_current as number || 0))
        : 0;

      return {
        id: cls.id as string,
        name: cls.name as string,
        invite_code: cls.invite_code as string,
        school_id: cls.school_id as string,
        student_count: count ?? 0,
        teacher_name: null,
        avg_xp,
        class_streak,
      };
    }));
    setClasses(enriched);
  }, []);

  /* ── Users ── */
  const fetchUsers = useCallback(async (opts?: { role?: string; schoolId?: string }) => {
    // Step 1: Fetch users without joins
    let q = supabase.from('users').select('id, display_name, role, school_id, class_id');
    if (opts?.role) q = q.eq('role', opts.role);
    if (opts?.schoolId) q = q.eq('school_id', opts.schoolId);
    const { data: usersData } = await q.order('display_name').limit(200);

    if (!usersData || usersData.length === 0) {
      setUsers([]);
      return;
    }

    // Step 2: Get school names
    const schoolIds = [...new Set(usersData.map(u => u.school_id).filter(Boolean))] as string[];
    const schoolMap = new Map<string, string>();
    if (schoolIds.length > 0) {
      const { data: schoolsData } = await supabase.from('schools').select('id, name').in('id', schoolIds);
      if (schoolsData) schoolsData.forEach(s => schoolMap.set(s.id, s.name));
    }

    // Step 3: Get class names
    const classIds = [...new Set(usersData.map(u => u.class_id).filter(Boolean))] as string[];
    const classMap = new Map<string, string>();
    if (classIds.length > 0) {
      const { data: classesData } = await supabase.from('classes').select('id, name').in('id', classIds);
      if (classesData) classesData.forEach(c => classMap.set(c.id, c.name));
    }

    // Step 4: Get hero data
    const userIds = usersData.map(u => u.id);
    const heroMap = new Map<string, { level: number; xp: number; status: string }>();
    if (userIds.length > 0) {
      const { data: heroData } = await supabase.from('heroes').select('user_id, level, xp, status').in('user_id', userIds);
      if (heroData) heroData.forEach(h => heroMap.set(h.user_id, { level: h.level, xp: h.xp, status: h.status }));
    }

    setUsers(usersData.map(u => {
      const hero = heroMap.get(u.id);
      return {
        id: u.id,
        display_name: u.display_name,
        role: u.role,
        email: null,
        school_id: u.school_id,
        school_name: u.school_id ? schoolMap.get(u.school_id) ?? null : null,
        class_id: u.class_id,
        class_name: u.class_id ? classMap.get(u.class_id) ?? null : null,
        hero_level: hero?.level ?? null,
        hero_xp: hero?.xp ?? null,
        hero_status: hero?.status ?? null,
        last_sign_in: null,
      };
    }));
  }, []);

  /* ── Analytics ── */
  const fetchAnalytics = useCallback(async () => {
    const [{ count: studentCount }, { count: teacherCount }, { count: schoolCount }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('schools').select('*', { count: 'exact', head: true }),
    ]);

    const { data: heroStats } = await supabase.from('heroes').select('xp, gold, status');
    const { count: activeQuests } = await supabase.from('quests').select('*', { count: 'exact', head: true }).eq('status', 'active');

    if (heroStats) {
      const avg_xp = heroStats.length > 0
        ? Math.round(heroStats.reduce((s, h: Record<string, unknown>) => s + (h.xp as number || 0), 0) / heroStats.length)
        : 0;
      const gold_total = heroStats.reduce((s, h: Record<string, unknown>) => s + (h.gold as number || 0), 0);
      const deaths = heroStats.filter((h: Record<string, unknown>) => h.status === 'inactive').length;

      setAnalytics({
        total_students: studentCount ?? 0,
        total_teachers: teacherCount ?? 0,
        total_schools: schoolCount ?? 0,
        active_quests: activeQuests ?? 0,
        avg_xp,
        hero_deaths: deaths,
        gold_in_circulation: gold_total,
      });
    }
  }, []);

  /* ── Economy ── */
  // Uses existing key-value schema: key = 'scope_global' | 'scope_school_{id}' | 'scope_class_{id}'
  // value = { dmg_multiplier, xp_multiplier, gold_multiplier, drop_rate_multiplier, boss_hp_multiplier, hp_regen_rate }
  const fetchEconomy = useCallback(async () => {
    const { data } = await supabase.from('economy_config')
      .select('id, key, value')
      .like('key', 'scope_%');
    if (data) {
      // Reshape into EconomyConfig[] format expected by admin UI
      const shaped: EconomyConfig[] = data.map((row: { id: string; key: string; value: Record<string, number> }) => {
        const parts = row.key.split('_'); // ['scope','global'] or ['scope','class','uuid']
        const scopeType = parts[1] as 'global' | 'school' | 'class';
        const scopeId = parts.length > 2 ? parts.slice(2).join('_') : null;
        return {
          id: row.id,
          scope: scopeType,
          scope_id: scopeId,
          dmg_multiplier: row.value?.dmg_multiplier ?? 100,
          xp_multiplier: row.value?.xp_multiplier ?? 100,
          gold_multiplier: row.value?.gold_multiplier ?? 100,
          drop_rate_multiplier: row.value?.drop_rate_multiplier ?? 100,
          boss_hp_multiplier: row.value?.boss_hp_multiplier ?? 100,
          hp_regen_rate: row.value?.hp_regen_rate ?? 0,
        };
      });
      setEconomyConfig(shaped);
    }
  }, []);

  const saveEconomy = useCallback(async (config: Partial<EconomyConfig>, scope: 'global' | 'school' | 'class', scopeId: string | null, scopeLabel?: string) => {
    const res = await fetch('/api/admin/save-economy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, scope, scopeId, scopeLabel }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Save failed' };
    fetchEconomy();
    return { error: null };
  }, [fetchEconomy]);

  /* ── Shop ── */
  const fetchShop = useCallback(async () => {
    const { data } = await supabase.from('shop_items').select('*').order('category');
    if (data) setShopItems(data as AdminShopItem[]);
  }, []);

  const toggleShopItem = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('shop_items').update({ is_active }).eq('id', id);
    if (!error) fetchShop();
    return { error: error?.message ?? null };
  }, [fetchShop]);

  const updateShopPrice = useCallback(async (id: string, price_gold: number) => {
    const { error } = await supabase.from('shop_items').update({ price_gold }).eq('id', id);
    if (!error) fetchShop();
    return { error: error?.message ?? null };
  }, [fetchShop]);

  /* ── Seasons ── */
  const fetchSeasons = useCallback(async () => {
    const { data } = await supabase.from('seasons').select('*').order('starts_at', { ascending: false });
    if (data) setSeasons(data as AdminSeason[]);
  }, []);

  const createSeason = useCallback(async (name: string, startDate: string, endDate: string, schoolId: string) => {
    const res = await fetch('/api/admin/create-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startDate, endDate, schoolId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Ошибка создания сезона' };
    fetchSeasons();
    return { error: null };
  }, [fetchSeasons]);

  /* ── Subjects ── */
  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data as AdminSubject[]);
  }, []);

  /* ── Schools CRUD ── */
  const createSchool = useCallback(async (name: string) => {
    const { error } = await supabase.from('schools').insert({ name });
    if (!error) fetchSchools();
    return { error: error?.message ?? null };
  }, [fetchSchools]);

  const createClass = useCallback(async (schoolId: string, name: string) => {
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('classes').insert({
      school_id: schoolId,
      name,
      invite_code,
    });
    if (!error) fetchClasses(schoolId);
    return { error: error?.message ?? null, invite_code };
  }, [fetchClasses]);

  /* ── Update School ── */
  const updateSchool = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('schools').update({ name }).eq('id', id);
    if (!error) fetchSchools();
    return { error: error?.message ?? null };
  }, [fetchSchools]);

  /* ── Delete School (cascade) ── */
  const deleteSchool = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/admin/delete-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[deleteSchool] API error', res.status, data);
        return { error: data.error ?? `HTTP ${res.status}`, deleted_users: 0 };
      }
      fetchSchools();
      fetchClasses();
      fetchUsers();
      return { error: null, deleted_users: data.deleted_users ?? 0 };
    } catch (err) {
      console.error('[deleteSchool] network error', err);
      return { error: String(err), deleted_users: 0 };
    }
  }, [fetchSchools, fetchClasses, fetchUsers]);

  /* ── Update Class ── */
  const updateClass = useCallback(async (id: string, name: string, schoolId: string) => {
    const { error } = await supabase.from('classes').update({ name }).eq('id', id);
    if (!error) fetchClasses(schoolId);
    return { error: error?.message ?? null };
  }, [fetchClasses]);

  /* ── Update User (via API for auth changes) ── */
  const updateUser = useCallback(async (params: {
    user_id: string;
    display_name?: string;
    email?: string;
    password?: string;
    role?: string;
    class_id?: string | null;
    school_id?: string | null;
  }) => {
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Unknown error' };
    fetchUsers();
    return { error: null };
  }, [fetchUsers]);

  /* ── User actions ── */
  const resetHeroHp = useCallback(async (userId: string) => {
    const { data: hero } = await supabase.from('heroes').select('id, hp_max').eq('user_id', userId).single();
    if (!hero) return { error: 'Hero not found' };
    const { error } = await supabase.from('heroes').update({ hp: hero.hp_max, status: 'active' }).eq('id', hero.id);
    if (!error) fetchUsers();
    return { error: error?.message ?? null };
  }, [fetchUsers]);

  const grantXpToUser = useCallback(async (userId: string, amount: number) => {
    const { data: hero } = await supabase.from('heroes').select('id, xp, level, xp_to_next, season_xp').eq('user_id', userId).single();
    if (!hero) return { error: 'Hero not found' };

    // Cumulative XP: just add, check thresholds (never subtract)
    const newXp = hero.xp + amount;
    let newLevel = hero.level;
    while (newXp >= cumulativeXpForLevel(newLevel + 1)) {
      newLevel++;
    }
    const newXpNext = cumulativeXpForLevel(newLevel + 1);

    const heroWithSeason = hero as typeof hero & { season_xp?: number | null };
    const update: Record<string, unknown> = { xp: newXp, season_xp: (heroWithSeason.season_xp ?? 0) + amount };
    if (newLevel !== hero.level) { update.level = newLevel; update.xp_to_next = newXpNext; }

    const { error } = await supabase.from('heroes').update(update).eq('id', hero.id);
    if (!error) fetchUsers();
    return { error: error?.message ?? null };
  }, [fetchUsers]);


  /* ── Create User ── */
  const createUser = useCallback(async (params: {
    display_name: string;
    role: 'student' | 'teacher' | 'parent' | 'admin';
    school_id: string;
    class_id: string | null;
    email?: string;
    password?: string;
    subjects?: string[];
    gender?: 'male' | 'female';
  }) => {
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Unknown error', user: null };
    // Refresh data
    fetchUsers();
    if (params.school_id) fetchClasses(params.school_id);
    return { error: null, user: data.user };
  }, [fetchUsers, fetchClasses]);

  /* ── Delete User ── */
  const deleteUser = useCallback(async (userId: string) => {
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Unknown error' };
    fetchUsers();
    return { error: null };
  }, [fetchUsers]);

  /* ── Get Full User Details ── */
  const fetchUserDetails = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/get-user-details?userId=${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSchools(),
      fetchClasses(),
      fetchUsers(),
      fetchAnalytics(),
      fetchShop(),
      fetchSeasons(),
      fetchEconomy(),
      fetchSubjects(),
    ]).finally(() => setLoading(false));
  }, [fetchSchools, fetchClasses, fetchUsers, fetchAnalytics, fetchShop, fetchSeasons, fetchEconomy, fetchSubjects]);

  return {
    schools, classes, users, shopItems, seasons, subjects, analytics, economyConfig,
    loading,
    fetchClasses, fetchUsers, fetchUserDetails,
    saveEconomy, toggleShopItem, updateShopPrice,
    createSchool, createClass, createSeason, createUser, deleteUser, deleteSchool,
    updateSchool, updateClass, updateUser,
    resetHeroHp, grantXpToUser,
    refetch: () => {
      fetchSchools(); fetchClasses(); fetchUsers(); fetchAnalytics(); fetchShop(); fetchSeasons(); fetchEconomy(); fetchSubjects();
    },
  };
}
