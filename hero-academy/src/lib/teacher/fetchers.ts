// Server-only Supabase fetchers for teacher pages. Не импортировать из браузерного кода.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClassInfo,
  StudentRow,
  TeacherQuestRow,
  TeacherInitialData,
  LiveStudentState,
  LessonCounters,
  LessonAverages,
  LiveInitialData,
} from './types';

const BUFF_LABELS = ['Блестящий ответ', 'Отличная работа', 'Помощь товарищу'];
const DEBUFF_LABELS = ['Отвлёкся', 'Мешает вести урок', 'Списывание'];
const ALL_LABELS = [...BUFF_LABELS, ...DEBUFF_LABELS];

function mapStudents(rows: Record<string, unknown>[]): StudentRow[] {
  return rows.map((u) => {
    const hero = Array.isArray(u.heroes) ? u.heroes[0] : (u.heroes as Record<string, unknown> | null);
    return {
      id: u.id as string,
      display_name: u.display_name as string,
      avatar_url: (u.avatar_url as string | null) ?? null,
      hero_id: (hero?.id as string) ?? null,
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
}

function mapQuests(rows: Record<string, unknown>[]): TeacherQuestRow[] {
  return rows.map((q) => ({
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
  }));
}

export async function getTeacherInitialData(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<TeacherInitialData> {
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name, invite_code, school_id')
    .eq('school_id', schoolId)
    .order('name');

  const classes = (classData ?? []) as ClassInfo[];
  const activeClassId = classes[0]?.id ?? null;

  if (!activeClassId) {
    return { classes, activeClassId: null, students: [], quests: [] };
  }

  const [studentsRes, questsRes] = await Promise.all([
    supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, heroes!left(id, level, xp, xp_to_next, hp, hp_max, gold, streak_current, streak_best, status)'
      )
      .eq('class_id', activeClassId)
      .eq('role', 'student')
      .order('display_name'),
    supabase
      .from('quests')
      .select('*, quest_attempts(count)')
      .eq('class_id', activeClassId)
      .order('created_at', { ascending: false }),
  ]);

  return {
    classes,
    activeClassId,
    students: mapStudents((studentsRes.data ?? []) as Record<string, unknown>[]),
    quests: mapQuests((questsRes.data ?? []) as Record<string, unknown>[]),
  };
}

// Live-страница использует чуть другую форму студентов (с lastUpdated) + два среза activity_log
// (бафф/дебафф счётчики и средние оценки). Всё это — отдельные запросы, которые сейчас крутятся
// в useEffect'ах клиента; делаем их параллельно на сервере.
export async function getLiveClassData(
  supabase: SupabaseClient,
  classId: string,
  studentRows: StudentRow[],
): Promise<LiveInitialData> {
  const heroIds = studentRows.map((s) => s.hero_id).filter((id): id is string => Boolean(id));
  const liveStudents: LiveStudentState[] = studentRows.map((s) => ({
    hero_id: s.hero_id ?? '',
    user_id: s.id,
    display_name: s.display_name,
    hp: s.hp,
    hp_max: s.hp_max,
    xp: s.xp,
    level: s.level,
    streak_current: s.streak,
    status: s.status,
    lastUpdated: 0,
  }));

  if (heroIds.length === 0) {
    return { liveStudents, counters: {}, averages: {} };
  }

  const [seasonRes, gradedRes] = await Promise.all([
    supabase
      .from('seasons')
      .select('starts_at')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('activity_log')
      .select('hero_id, metadata')
      .in('hero_id', heroIds)
      .eq('action', 'quest_graded'),
  ]);

  const seasonStart = (seasonRes.data?.starts_at as string | undefined)
    ?? new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

  const { data: counterData } = await supabase
    .from('activity_log')
    .select('hero_id, action, metadata')
    .in('hero_id', heroIds)
    .in('action', ['teacher_xp_grant', 'teacher_damage'])
    .gte('created_at', seasonStart);

  const counters: LessonCounters = {};
  for (const row of (counterData ?? []) as { hero_id: string; metadata: Record<string, unknown> }[]) {
    const reason = String(row.metadata?.reason ?? '');
    const subj = String(row.metadata?.subject ?? '').toLowerCase();
    if (!subj || !ALL_LABELS.includes(reason)) continue;
    if (!counters[row.hero_id]) counters[row.hero_id] = {};
    if (!counters[row.hero_id][subj]) counters[row.hero_id][subj] = {};
    counters[row.hero_id][subj][reason] = (counters[row.hero_id][subj][reason] ?? 0) + 1;
  }

  const buckets: Record<string, Record<string, number[]>> = {};
  for (const row of (gradedRes.data ?? []) as { hero_id: string; metadata: Record<string, unknown> }[]) {
    const subj = ((row.metadata?.subject as string) ?? '').toLowerCase();
    const score = Number(row.metadata?.score ?? 0);
    if (!subj || score <= 0) continue;
    if (!buckets[row.hero_id]) buckets[row.hero_id] = {};
    if (!buckets[row.hero_id][subj]) buckets[row.hero_id][subj] = [];
    buckets[row.hero_id][subj].push(score);
  }
  const averages: LessonAverages = {};
  for (const heroId of heroIds) {
    averages[heroId] = {};
    for (const [subj, scores] of Object.entries(buckets[heroId] ?? {})) {
      averages[heroId][subj] = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    }
  }

  return { liveStudents, counters, averages };
}
