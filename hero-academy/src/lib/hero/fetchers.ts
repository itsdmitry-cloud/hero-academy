// src/lib/hero/fetchers.ts
// Server-only Supabase fetchers. Not callable from browser bundle.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  HeroPageInitialData, HeroRow, HeroStatsRow, ActivityLogRow,
  ArtifactRow, HeroArtifactRow, ClassRank,
} from './types';

// Catalog rarely mutates (только админ через /api/admin/seed-artifacts и
// родственные эндпоинты). Кеш живёт час, бастится через revalidateTag('artifacts').
// Anon-клиент достаточен — на artifacts стоит RLS `FOR SELECT USING (true)`.
const getArtifactCatalog = unstable_cache(
  async (): Promise<ArtifactRow[]> => {
    const sb = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error } = await sb.from('artifacts').select('*').order('rarity');
    if (error) {
      console.error('[hero/fetchers] cached artifact catalog:', error);
      return [];
    }
    return (data ?? []) as ArtifactRow[];
  },
  ['artifact-catalog-v1'],
  { revalidate: 3600, tags: ['artifacts'] }
);

async function safe<T>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await p;
    if (error) {
      console.error('[hero/fetchers] supabase error:', error);
      return fallback;
    }
    return data ?? fallback;
  } catch (err) {
    console.error('[hero/fetchers] thrown:', err);
    return fallback;
  }
}

export async function getHeroPageData(
  supabase: SupabaseClient,
  userId: string,
): Promise<HeroPageInitialData> {
  // Hero + stats first — heroId needed for hero_artifacts.
  // Profile (school_id, class_id) needed for school/class names.
  const [heroRes, profileRes] = await Promise.all([
    safe(
      supabase
        .from('heroes')
        .select('*, hero_stats(strength, knowledge, endurance, luck, wisdom)')
        .eq('user_id', userId)
        .single() as PromiseLike<{ data: (HeroRow & { hero_stats: HeroStatsRow[] | HeroStatsRow | null }) | null; error: unknown }>,
      null,
    ),
    safe(
      supabase
        .from('users')
        .select('school_id, class_id')
        .eq('id', userId)
        .single() as PromiseLike<{ data: { school_id: string | null; class_id: string | null } | null; error: unknown }>,
      null,
    ),
  ]);

  const hero: HeroRow | null = heroRes ? { ...heroRes, hero_stats: undefined } as HeroRow : null;
  const stats: HeroStatsRow | null = heroRes
    ? Array.isArray(heroRes.hero_stats)
      ? heroRes.hero_stats[0] ?? null
      : heroRes.hero_stats ?? null
    : null;
  const heroId = hero?.id ?? null;
  const schoolId = profileRes?.school_id ?? null;
  const classId = profileRes?.class_id ?? null;

  const [
    activityLog,
    artifactCatalog,
    heroArtifacts,
    classRank,
    seasonName,
    schoolName,
    className,
  ] = await Promise.all([
    safe(
      supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20) as PromiseLike<{ data: ActivityLogRow[] | null; error: unknown }>,
      [] as ActivityLogRow[],
    ),
    getArtifactCatalog(),
    heroId
      ? safe(
          supabase
            .from('hero_artifacts')
            .select('*, artifact:artifact_id(*)')
            .eq('hero_id', heroId) as PromiseLike<{ data: HeroArtifactRow[] | null; error: unknown }>,
          [] as HeroArtifactRow[],
        )
      : Promise.resolve([] as HeroArtifactRow[]),
    fetchClassRank(supabase, userId),
    schoolId ? fetchSeasonName(supabase, schoolId) : Promise.resolve(null),
    schoolId ? fetchSingleName(supabase, 'schools', schoolId) : Promise.resolve(null),
    classId ? fetchSingleName(supabase, 'classes', classId) : Promise.resolve(null),
  ]);

  return {
    hero,
    stats,
    activityLog,
    artifactCatalog,
    heroArtifacts,
    classRank,
    seasonName,
    schoolName,
    className,
  };
}

async function fetchClassRank(supabase: SupabaseClient, userId: string): Promise<ClassRank | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_rating_rank', {
      p_user_id: userId,
      p_scope: 'class',
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    const me = data[0] as { rank: number; total: number };
    return { rank: me.rank > 0 ? me.rank : 0, total: me.total ?? 0 };
  } catch (err) {
    console.error('[hero/fetchers] classRank:', err);
    return null;
  }
}

async function fetchSeasonName(supabase: SupabaseClient, schoolId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('seasons')
      .select('name')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

async function fetchSingleName(
  supabase: SupabaseClient,
  table: 'schools' | 'classes',
  id: string,
): Promise<string | null> {
  try {
    const { data } = await supabase.from(table).select('name').eq('id', id).maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}
