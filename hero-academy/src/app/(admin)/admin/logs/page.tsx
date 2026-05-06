'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ActionBreakdown } from '@/components/shared/ActionBreakdown';
import styles from './page.module.css';

interface LogEntry {
  id: string;
  hero_id: string;
  user_id: string;
  action: string;
  xp_change: number | null;
  hp_change: number | null;
  gold_change: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // joined
  hero_name: string;
  student_name: string;
  class_id: string | null;
  school_id: string | null;
}

interface SchoolOption { id: string; name: string; }
interface ClassOption { id: string; name: string; school_id: string; }

const ACTION_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  teacher_damage: { icon: '💔', label: 'Урон от учителя', color: '#ef4444' },
  teacher_xp_grant: { icon: '⭐', label: 'XP от учителя', color: '#eab308' },
  teacher_gold_grant: { icon: '💰', label: 'Золото от учителя', color: '#f59e0b' },
  quest_complete: { icon: '⚔️', label: 'Квест выполнен', color: '#22c55e' },
  boss_damage: { icon: '🐉', label: 'Удар по боссу', color: '#f43f5e' },
  potion_used: { icon: '🧪', label: 'Зелье выпито', color: '#3b82f6' },
  artifact_equipped: { icon: '💎', label: 'Артефакт надет', color: '#a855f7' },
  artifact_drop: { icon: '🎁', label: 'Артефакт получен', color: '#8b5cf6' },
  lootbox_opened: { icon: '📦', label: 'Лутбокс открыт', color: '#06b6d4' },
  shop_purchase: { icon: '🛒', label: 'Покупка в магазине', color: '#f97316' },
  hp_regen: { icon: '💚', label: 'HP восстановлено', color: '#22c55e' },
  streak_bonus: { icon: '🔥', label: 'Бонус за стрик', color: '#ef4444' },
  admin_undo: { icon: '↩️', label: 'Отмена действия', color: '#64748b' },
};

export default function LogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; hero_id: string }[]>([]);

  // Filters
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [limit, setLimit] = useState(50);

  // Undo
  const [undoLoading, setUndoLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fetch schools
  useEffect(() => {
    supabase.from('schools').select('id, name').then(({ data }) => {
      if (data) setSchools(data);
    });
  }, [supabase]);

  // Fetch classes for school
  useEffect(() => {
    if (schoolFilter !== 'all') {
      supabase.from('classes').select('id, name, school_id').eq('school_id', schoolFilter).then(({ data }) => {
        if (data) setClasses(data);
      });
    } else {
      supabase.from('classes').select('id, name, school_id').then(({ data }) => {
        if (data) setClasses(data);
      });
    }
  }, [schoolFilter, supabase]);

  // Fetch students
  useEffect(() => {
    let q = supabase.from('users').select('id, display_name, class_id').eq('role', 'student');
    if (schoolFilter !== 'all') q = q.eq('school_id', schoolFilter);
    if (classFilter !== 'all') q = q.eq('class_id', classFilter);
    q.then(async ({ data: usersData }) => {
      if (!usersData) { setStudents([]); return; }
      const userIds = usersData.map(u => u.id);
      if (userIds.length === 0) { setStudents([]); return; }
      const { data: heroes } = await supabase.from('heroes').select('id, user_id').in('user_id', userIds);
      const heroMap = new Map(heroes?.map(h => [h.user_id, h.id]) ?? []);
      setStudents(usersData.map(u => ({ id: u.id, name: u.display_name, hero_id: heroMap.get(u.id) ?? '' })));
    });
  }, [schoolFilter, classFilter, supabase]);

  // Fetch logs — returns data, does NOT mutate state. State updates happen
  // at the call site (effect/handler), so react-hooks/set-state-in-effect
  // only ever sees setState inside async IIFE callbacks.
  const queryLogs = useCallback(async () => {
    // Get hero_ids to filter by
    let heroIds: string[] | null = null;
    if (studentFilter !== 'all') {
      const s = students.find(st => st.id === studentFilter);
      heroIds = s?.hero_id ? [s.hero_id] : [];
    } else if (classFilter !== 'all' || schoolFilter !== 'all') {
      heroIds = students.filter(s => s.hero_id).map(s => s.hero_id);
    }

    let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (heroIds !== null && heroIds.length > 0) {
      q = q.in('hero_id', heroIds);
    } else if (heroIds !== null && heroIds.length === 0) {
      return [] as LogEntry[];
    }
    if (actionFilter !== 'all') q = q.eq('action', actionFilter);

    const { data } = await q;
    if (!data) return [] as LogEntry[];

    // Enrich with hero/student names
    const allHeroIds = [...new Set(data.map(d => d.hero_id).filter(Boolean))];
    const heroMap = new Map<string, { name: string; user_id: string }>();
    if (allHeroIds.length > 0) {
      const { data: heroData } = await supabase.from('heroes').select('id, name, user_id').in('id', allHeroIds);
      if (heroData) heroData.forEach(h => heroMap.set(h.id, { name: h.name, user_id: h.user_id }));
    }
    const allUserIds = [...new Set([...heroMap.values()].map(h => h.user_id).filter(Boolean))];
    const userMap = new Map<string, { name: string; class_id: string | null; school_id: string | null }>();
    if (allUserIds.length > 0) {
      const { data: userData } = await supabase.from('users').select('id, display_name, class_id, school_id').in('id', allUserIds);
      if (userData) userData.forEach(u => userMap.set(u.id, { name: u.display_name, class_id: u.class_id, school_id: u.school_id }));
    }

    return data.map(d => {
      const hero = heroMap.get(d.hero_id);
      const user = hero ? userMap.get(hero.user_id) : undefined;
      return {
        ...d,
        hero_name: hero?.name ?? '—',
        student_name: user?.name ?? '—',
        class_id: user?.class_id ?? null,
        school_id: user?.school_id ?? null,
      } as LogEntry;
    });
  }, [supabase, schoolFilter, classFilter, studentFilter, actionFilter, limit, students]);

  // Auto-fetch logs when filters change. Every setState runs inside the
  // async IIFE callback — never in the sync effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await queryLogs();
      if (cancelled) return;
      setLogs(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [queryLogs]);

  // Event handler version used by handleUndo — safe to mutate state directly
  const refetchLogs = useCallback(async () => {
    setLoading(true);
    const rows = await queryLogs();
    setLogs(rows);
    setLoading(false);
  }, [queryLogs]);

  // Undo action
  const handleUndo = async (log: LogEntry) => {
    setUndoLoading(log.id);
    try {
      // Reverse the action
      if (log.xp_change) {
        const { data: hero } = await supabase.from('heroes').select('xp').eq('id', log.hero_id).single();
        if (hero) await supabase.from('heroes').update({ xp: Math.max(0, hero.xp - log.xp_change) }).eq('id', log.hero_id);
      }
      if (log.hp_change) {
        const { data: hero } = await supabase.from('heroes').select('hp, hp_max').eq('id', log.hero_id).single();
        if (hero) {
          const newHp = Math.min(hero.hp_max, Math.max(0, hero.hp - log.hp_change));
          await supabase.from('heroes').update({ hp: newHp, status: newHp > 0 ? 'active' : 'inactive' }).eq('id', log.hero_id);
        }
      }
      if (log.gold_change) {
        const { data: hero } = await supabase.from('heroes').select('gold').eq('id', log.hero_id).single();
        if (hero) await supabase.from('heroes').update({ gold: Math.max(0, hero.gold - log.gold_change) }).eq('id', log.hero_id);
      }

      // Log the undo
      await supabase.from('activity_log').insert({
        hero_id: log.hero_id,
        user_id: log.user_id,
        action: 'admin_undo',
        xp_change: log.xp_change ? -log.xp_change : null,
        hp_change: log.hp_change ? -log.hp_change : null,
        gold_change: log.gold_change ? -log.gold_change : null,
        metadata: { undone_log_id: log.id, original_action: log.action, original_metadata: log.metadata },
      });

      setFeedback(`↩️ Действие отменено: ${ACTION_LABELS[log.action]?.label ?? log.action} для ${log.student_name}`);
      refetchLogs();
    } catch (err) {
      setFeedback(`Ошибка: ${String(err)}`);
    }
    setUndoLoading(null);
    setTimeout(() => setFeedback(null), 4000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const classOptions = schoolFilter !== 'all' ? classes.filter(c => c.school_id === schoolFilter) : classes;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className="text-display">📋 Логи действий</h1>
        <span className={styles.counter}>{loading ? '…' : `${logs.length}`} записей</span>
      </div>

      {feedback && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 700 }}>
          {feedback}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <select className={styles.filterSelect} value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setClassFilter('all'); setStudentFilter('all'); }}>
          <option value="all">🏫 Все школы</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={classFilter} onChange={e => { setClassFilter(e.target.value); setStudentFilter('all'); }}>
          <option value="all">📚 Все классы</option>
          {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
          <option value="all">🧙 Все ученики</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="all">📋 Все действия</option>
          {Object.entries(ACTION_LABELS).map(([key, v]) => (
            <option key={key} value={key}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select className={styles.filterSelect} value={limit} onChange={e => setLimit(Number(e.target.value))}>
          <option value={50}>50 записей</option>
          <option value={100}>100 записей</option>
          <option value={250}>250 записей</option>
          <option value={500}>500 записей</option>
        </select>
      </div>

      {/* Logs table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div>
      ) : (
        <div className={styles.cardList}>
          {logs.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет записей</div>
          )}
          {logs.map(log => {
            const info = ACTION_LABELS[log.action] ?? { icon: '❓', label: log.action, color: '#64748b' };
            return (
              <div key={log.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTime}>{formatDate(log.created_at)}</span>
                  <span className={styles.cardStudent}>{log.student_name}</span>
                  <span className={styles.cardAction} style={{ color: info.color }}>
                    {info.icon} {info.label}
                  </span>
                  <div className={styles.cardDeltas}>
                    {log.xp_change !== null && log.xp_change !== 0 && (
                      <span className={log.xp_change > 0 ? styles.deltaXp : styles.deltaXpNeg}>
                        {log.xp_change > 0 ? `+${log.xp_change}` : log.xp_change} XP
                      </span>
                    )}
                    {log.hp_change !== null && log.hp_change !== 0 && (
                      <span className={log.hp_change > 0 ? styles.deltaHpPos : styles.deltaHpNeg}>
                        {log.hp_change > 0 ? `+${log.hp_change}` : log.hp_change} HP
                      </span>
                    )}
                    {log.gold_change !== null && log.gold_change !== 0 && (
                      <span className={styles.deltaGold}>
                        {log.gold_change > 0 ? `+${log.gold_change}` : log.gold_change} 💰
                      </span>
                    )}
                  </div>
                  {log.action !== 'admin_undo' && (log.xp_change || log.hp_change || log.gold_change) ? (
                    <button
                      className={styles.undoBtn}
                      onClick={() => handleUndo(log)}
                      disabled={undoLoading === log.id}
                      title="Отменить действие"
                    >
                      {undoLoading === log.id ? '⏳' : '↩️ Отменить'}
                    </button>
                  ) : null}
                </div>
                <ActionBreakdown
                  action={log.action}
                  metadata={log.metadata}
                  xpChange={log.xp_change}
                  hpChange={log.hp_change}
                  goldChange={log.gold_change}
                  showRawJson
                  borderColor={info.color}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
