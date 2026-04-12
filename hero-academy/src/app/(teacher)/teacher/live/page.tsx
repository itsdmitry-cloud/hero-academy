'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useTeacherData } from '@/lib/hooks/use-teacher-data';
import { useRealtimeClass } from '@/lib/hooks/use-realtime-class';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import type { LiveStudentState } from '@/lib/hooks/use-realtime-class';
import styles from './page.module.css';

const supabase = createClient();

const BUFF_LABELS   = ['Блестящий ответ', 'Отличная работа', 'Помощь товарищу'];
const DEBUFF_LABELS = ['Отвлёкся', 'Мешает вести урок', 'Списывание'];
const ALL_LABELS    = [...BUFF_LABELS, ...DEBUFF_LABELS];

const hpColor = (hp: number, max: number) => {
  const pct = hp / max;
  if (pct > 0.6) return 'var(--accent-xp)';
  if (pct > 0.3) return 'var(--accent-gold)';
  return 'var(--accent-hp)';
};

export default function LiveRadarPage() {
  const { user } = useAuth();
  const { classes, activeClassId, setActiveClassId, subjects, grantXp, damageHp, activeSubject, createQuest, quests } = useTeacherData();
  const { students: liveStudents, loading, optimisticUpdate } = useRealtimeClass(activeClassId);

  const students: LiveStudentState[] = liveStudents;

  const [selected, setSelected] = useState<LiveStudentState | null>(null);
  const [actionLog, setActionLog] = useState<{ id: number; text: string; type: 'buff' | 'debuff' }[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  // Buff/Debuff counters per student → per subject → per action label
  // e.g. allLessonCounters[heroId][биология][Блестящий ответ] = 3
  const [allLessonCounters, setAllLessonCounters] = useState<Record<string, Record<string, Record<string, number>>>>({});

  // Fetch per-action counts from activity_log (current season only)
  useEffect(() => {
    if (!activeClassId) return;
    const load = async () => {
      const { data: users } = await supabase
        .from('users').select('id').eq('class_id', activeClassId).eq('role', 'student');
      const userIds = users?.map((u: Record<string, unknown>) => u.id as string) ?? [];
      if (!userIds.length) return;
      const { data: heroes } = await supabase
        .from('heroes').select('id').in('user_id', userIds);
      const heroIds = heroes?.map((h: Record<string, unknown>) => h.id as string) ?? [];
      if (!heroIds.length) return;
      const { data: seasons } = await supabase
        .from('seasons').select('starts_at').in('status', ['active'])
        .order('starts_at', { ascending: false }).limit(1);
      const seasonStart = seasons?.[0]?.starts_at
        ?? new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('activity_log').select('hero_id, action, metadata')
        .in('hero_id', heroIds)
        .in('action', ['teacher_xp_grant', 'teacher_damage'])
        .gte('created_at', seasonStart);
      if (!data) return;
      const counts: Record<string, Record<string, Record<string, number>>> = {};
      for (const row of data as { hero_id: string; metadata: Record<string, unknown> }[]) {
        const reason = String(row.metadata?.reason ?? '');
        const subj   = String(row.metadata?.subject ?? '').toLowerCase();
        if (!subj || !ALL_LABELS.includes(reason)) continue;
        if (!counts[row.hero_id]) counts[row.hero_id] = {};
        if (!counts[row.hero_id][subj]) counts[row.hero_id][subj] = {};
        counts[row.hero_id][subj][reason] = (counts[row.hero_id][subj][reason] ?? 0) + 1;
      }
      setAllLessonCounters(counts);
    };
    load().catch(() => {});
  }, [activeClassId]);

  const bumpCounter = (heroId: string, label: string) => {
    const subj = (activeSubject ?? 'общий').toLowerCase();
    setAllLessonCounters(prev => {
      const hero = prev[heroId] ?? {};
      const subMap = hero[subj] ?? {};
      return { ...prev, [heroId]: { ...hero, [subj]: { ...subMap, [label]: (subMap[label] ?? 0) + 1 } } };
    });
  };

  // Helper: get totals for active subject badges on avatar card
  const getAvatarCounts = (heroId: string) => {
    const subj = (activeSubject ?? '').toLowerCase();
    const actions = allLessonCounters[heroId]?.[subj] ?? {};
    const buffs   = BUFF_LABELS.reduce((s, l) => s + (actions[l] ?? 0), 0);
    const debuffs = DEBUFF_LABELS.reduce((s, l) => s + (actions[l] ?? 0), 0);
    return { buffs, debuffs };
  };


  // Per-student average score for EVERY subject (fetched once, keyed by [heroId][subject])
  const [allAverages, setAllAverages] = useState<Record<string, Record<string, number>>>({});

  // Fetch all quest_graded logs for this class once on mount / when students change.
  // State updates run inside the async IIFE (never in the sync effect body),
  // satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!students.length) {
        if (cancelled) return;
        setAllAverages({});
        return;
      }
      const heroIds = students.map(s => s.hero_id).filter(Boolean) as string[];
      if (!heroIds.length) return;
      const { data } = await supabase
        .from('activity_log')
        .select('hero_id, metadata')
        .in('hero_id', heroIds)
        .eq('action', 'quest_graded');
      if (cancelled || !data) return;
      const buckets: Record<string, Record<string, number[]>> = {};
      for (const row of data as { hero_id: string; metadata: Record<string, unknown> }[]) {
        const subj = ((row.metadata?.subject as string) ?? '').toLowerCase();
        const score = Number(row.metadata?.score ?? 0);
        if (!subj || score <= 0) continue;
        if (!buckets[row.hero_id]) buckets[row.hero_id] = {};
        if (!buckets[row.hero_id][subj]) buckets[row.hero_id][subj] = [];
        buckets[row.hero_id][subj].push(score);
      }
      const avgs: Record<string, Record<string, number>> = {};
      for (const heroId of heroIds) {
        avgs[heroId] = {};
        for (const [subj, scores] of Object.entries(buckets[heroId] ?? {})) {
          avgs[heroId][subj] = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        }
      }
      setAllAverages(avgs);
    })();
    return () => { cancelled = true; };
  }, [students]); // only re-fetches when class students change (season reset = page reload)

  const [lessonToast, setLessonToast] = useState<string | null>(null);
  const [lessonCreating, setLessonCreating] = useState(false);
  const [lessonModal, setLessonModal] = useState<typeof LESSON_TYPES[0] | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDeadlineDays, setLessonDeadlineDays] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);

  const addLog = (text: string, type: 'buff' | 'debuff') => {
    setActionLog(prev => [{ id: Date.now(), text, type }, ...prev].slice(0, 8));
  };



  const handleBuff = (label: string, xpAmount: number) => {
    if (!selected || !selected.hero_id) return;
    const heroId = selected.hero_id;
    const studentName = selected.display_name;

    // 1. Instant UI: optimistic update + close modal + log + counter
    optimisticUpdate(heroId, { xp: selected.xp + xpAmount });
    addLog(`${studentName}: ${label} (+${xpAmount} XP)`, 'buff');
    if (BUFF_LABELS.includes(label)) bumpCounter(heroId, label);
    setSelected(null);

    // 2. Background: API call (no blocking)
    grantXp(heroId, xpAmount, label, activeSubject ?? undefined)
      .then(({ error }) => { if (error) setLessonToast(`❌ ${label}: ${error}`); })
      .catch(() => setLessonToast(`❌ Ошибка сохранения`));
  };

  const handleDebuff = (label: string, hpAmount: number) => {
    if (!selected || !selected.hero_id) return;
    const heroId = selected.hero_id;
    const studentName = selected.display_name;
    const newHp = Math.max(0, selected.hp - hpAmount);

    // 1. Instant UI
    optimisticUpdate(heroId, { hp: newHp, status: newHp === 0 ? 'inactive' : 'active' });
    addLog(`${studentName}: ${label} (-${hpAmount} HP)`, 'debuff');
    if (DEBUFF_LABELS.includes(label)) bumpCounter(heroId, label);
    setSelected(null);

    // 2. Background: API call
    damageHp(heroId, hpAmount, label, activeSubject ?? undefined)
      .then(({ error }) => { if (error) setLessonToast(`❌ ${label}: ${error}`); })
      .catch(() => setLessonToast(`❌ Ошибка сохранения`));
  };

  const handleGroupBuff = async () => {
    for (const s of students) {
      if (s.hero_id && s.status === 'active') {
        optimisticUpdate(s.hero_id, { xp: s.xp + 20 });
        await grantXp(s.hero_id, 20, 'Групповая награда', activeSubject ?? undefined);
      }
    }
    addLog('Mass Cast: Идеальная работа (+20 XP всем)', 'buff');
  };

  /* ── Lesson assignment templates ── */
  const LESSON_TYPES = [
    { icon: '✏️', label: 'Самостоятельная', type: 'dungeon',   difficulty: 'medium', xp: 150, gold: 30, damage: 10, desc: 'Самостоятельная работа на уроке' },
    { icon: '✅', label: 'Проверочная',     type: 'check',     difficulty: 'medium', xp: 150, gold: 30, damage: 10, desc: 'Проверочная работа по теме' },
    { icon: '📋', label: 'Контрольная',     type: 'control',   difficulty: 'hard',   xp: 350, gold: 70, damage: 20, desc: 'Контрольная работа' },
    { icon: '🖊️', label: 'Диктант',         type: 'dictation', difficulty: 'medium', xp: 200, gold: 40, damage: 15, desc: 'Диктант' },
  ];

  const openLessonModal = (tpl: typeof LESSON_TYPES[0]) => {
    setLessonModal(tpl);
    setLessonTitle('');
    setLessonDeadlineDays(1);
  };

  const handleCreateLesson = async () => {
    if (!activeClassId || !lessonModal) return;
    setLessonCreating(true);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + lessonDeadlineDays);
    if (lessonDeadlineDays === 1) deadline.setHours(23, 59, 59, 999);
    const tpl = lessonModal;
    const { error } = await createQuest({
      title: lessonTitle.trim() || tpl.label,
      description: tpl.desc,
      subject: activeSubject || subjects[0] || 'Общий',
      type: 'dungeon',
      difficulty: tpl.difficulty,
      xp_reward: tpl.xp,
      gold_reward: tpl.gold,
      hp_damage: tpl.damage,
      deadline: deadline.toISOString(),
      context: `lesson_${tpl.type}`,
    });
    setLessonCreating(false);
    setLessonModal(null);
    if (error) {
      setLessonToast(`❌ Ошибка: ${error}`);
    } else {
      setLessonToast(`✅ ${tpl.icon} ${lessonTitle.trim() || tpl.label} — отправлено классу`);
    }
    setTimeout(() => setLessonToast(null), 3500);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h1 className="text-display">Радар Класса</h1>
            <p className={styles.subtitle}>
              Раздавайте награды и штрафы прямо во время урока.
            </p>
          </div>
          {activeSubject && (
            <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-xp)' }}>
              🐉 {activeSubject}
            </div>
          )}
        </div>
        <button className={styles.aoeBtn} onClick={handleGroupBuff}>✨ Наградить весь класс</button>
      </div>

      <div className={styles.mainArea}>
        {/* Radar Grid */}
        <div className={styles.radarGrid}>
          {students.map((s) => (
            <div
              key={s.user_id}
              className={styles.avatarNode}
              onClick={() => setSelected(s)}
              style={{ opacity: s.status === 'inactive' ? 0.5 : 1 }}
            >
              <div
                className={styles.avatarBorder}
                style={{ borderColor: s.status === 'inactive' ? 'var(--accent-hp)' : 'var(--accent-primary)', position: 'relative' }}
              >
                <span className={styles.avatarIcon}>🧙‍♂️</span>
                {s.status === 'inactive' && (
                  <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent-hp)', background: 'var(--bg-primary)', padding: '1px 4px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    💀 Пал
                  </div>
                )}
                {/* Buff counter badge */}
                {getAvatarCounts(s.hero_id ?? '').buffs > 0 && (
                  <div style={{ position: 'absolute', top: '-8px', right: '-8px', minWidth: '22px', height: '22px', borderRadius: '999px', background: '#22c55e', color: '#fff', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--bg-primary)', padding: '0 4px' }}>
                    {getAvatarCounts(s.hero_id ?? '').buffs}
                  </div>
                )}
                {/* Debuff counter badge */}
                {getAvatarCounts(s.hero_id ?? '').debuffs > 0 && (
                  <div style={{ position: 'absolute', top: '-8px', left: '-8px', minWidth: '22px', height: '22px', borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--bg-primary)', padding: '0 4px' }}>
                    {getAvatarCounts(s.hero_id ?? '').debuffs}
                  </div>
                )}
              </div>
              <span className={styles.avatarName}>{s.display_name}</span>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {activeSubject && s.hero_id ? (() => {
                  const avg = allAverages[s.hero_id]?.[activeSubject.toLowerCase()];
                  return avg != null ? (
                    <span><span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>★ {avg}</span><span style={{ opacity: 0.5 }}> · средний балл</span></span>
                  ) : <span style={{ opacity: 0.45 }}>нет оценок</span>;
                })() : `Lv.${s.level} · ⭐${s.xp}`}
              </div>
            </div>
          ))}
          {students.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
              <div style={{ fontSize: '2rem' }}>📭</div>
              <div>Нет учеников в классе</div>
            </div>
          )}
        </div>

        {/* Live Feed Sidebar */}
        <div className={styles.liveFeed}>
          <h3 className={styles.feedTitle}>⚡ Журнал Заклинаний</h3>
          <div className={styles.feedList}>
            {actionLog.length === 0 ? (
              <p className={styles.emptyFeed}>Выберите ученика для действия</p>
            ) : (
              actionLog.map(log => (
                <div key={log.id} className={`${styles.logItem} ${log.type === 'debuff' ? styles.logDebuff : ''}`}>
                  {log.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Задания на уроке ─────────────────────────────── */}
      <div className={styles.lessonSection}>
        <div className={styles.lessonHeader}>
          <div>
            <h2 className={styles.lessonTitle}>📝 Задания на уроке</h2>
            <p className={styles.lessonSubtitle}>
              Один клик — задание создаётся для всего класса и появляется на дашборде для проверки
            </p>
          </div>
          {activeSubject && (
            <div className={styles.lessonSubject}>🐉 {activeSubject}</div>
          )}
        </div>
        <div className={styles.lessonGrid}>
          {LESSON_TYPES.map(tpl => (
            <button
              key={tpl.type}
              className={styles.lessonBtn}
              onClick={() => openLessonModal(tpl)}
              disabled={!activeClassId}
            >
              <span className={styles.lessonIcon}>{tpl.icon}</span>
              <span className={styles.lessonLabel}>{tpl.label}</span>
              <div className={styles.lessonMeta}>
                <span>+{tpl.xp} XP</span>
                <span>💰{tpl.gold}</span>
                <span>-{tpl.damage}❤️</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lesson toast */}
      {lessonToast && (
        <div className={styles.lessonToast}>{lessonToast}</div>
      )}

      {/* Lesson detail modal */}
      <Modal
        isOpen={!!lessonModal}
        onClose={() => setLessonModal(null)}
        title={lessonModal ? `${lessonModal.icon} ${lessonModal.label} — новое задание` : ''}
        size="sm"
      >
        {lessonModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Info row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-xp)', fontSize: '1.1rem' }}>+{lessonModal.xp}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>XP</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-gold)', fontSize: '1.1rem' }}>💰{lessonModal.gold}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gold</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-hp)', fontSize: '1.1rem' }}>-{lessonModal.damage}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HP (за ошибки)</div>
              </div>
            </div>

            {/* Subject */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.08)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-xp)' }}>
              🐉 {activeSubject || subjects[0] || 'Общий'}
            </div>

            {/* Title */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Тема / название (необязательно)
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={e => setLessonTitle(e.target.value)}
                placeholder={`Например: ${lessonModal.label} — тема 5`}
                style={{ width: '100%', padding: '0.65rem 0.75rem', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                autoFocus
              />
            </div>            {/* Current date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>📅</span>
              <span>{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>сегодня</span>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreateLesson}
              disabled={lessonCreating}
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--gradient-purple)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', opacity: lessonCreating ? 0.6 : 1 }}
            >
              {lessonCreating ? 'Создаём...' : `✨ Отправить классу`}
            </button>
          </div>
        )}
      </Modal>

      {/* Action Ring Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Действия: ${selected?.display_name}`} size="md">
        {selected && (
          <div className={styles.actionMenu}>
            {/* Per-action breakdown for active subject */}
            {selected.hero_id && (() => {
              const subj    = (activeSubject ?? '').toLowerCase();
              const actions = allLessonCounters[selected.hero_id!]?.[subj] ?? {};
              const rows = [
                { label: 'Блестящий ответ',   color: '#22c55e' },
                { label: 'Отличная работа',    color: '#22c55e' },
                { label: 'Помощь товарищу',   color: '#22c55e' },
                { label: 'Отвлёкся',          color: '#ef4444' },
                { label: 'Мешает вести урок', color: '#ef4444' },
                { label: 'Списывание',        color: '#ef4444' },
              ];
              return (
                <div style={{ marginBottom: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '0.6rem 0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
                  {activeSubject && <div style={{ gridColumn: '1/-1', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem', fontWeight: 600 }}>🐉 {activeSubject}</div>}
                  {rows.map(r => {
                    const count = actions[r.label] ?? 0;
                    return (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', color: count > 0 ? r.color : 'var(--text-muted)', opacity: count === 0 ? 0.45 : 1 }}>{r.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.82rem', color: count > 0 ? r.color : 'var(--text-muted)', minWidth: '16px', textAlign: 'right' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className={styles.actionGroup}>
              <h4 className={styles.groupTitle}>🌟 Наградить (Баффы)</h4>
              <div className={styles.btnGrid}>
                <button className={`${styles.spellBtn} ${styles.spellBuff}`} onClick={() => handleBuff('Блестящий ответ', 50)} disabled={actionLoading}>
                  <span>🎯</span> Блестящий ответ<br/><small>+50 XP</small>
                </button>
                <button className={`${styles.spellBtn} ${styles.spellBuff}`} onClick={() => handleBuff('Отличная работа', 30)} disabled={actionLoading}>
                  <span>⭐</span> Отличная работа<br/><small>+30 XP</small>
                </button>
                <button className={`${styles.spellBtn} ${styles.spellBuff}`} onClick={() => handleBuff('Помощь товарищу', 20)} disabled={actionLoading}>
                  <span>🤝</span> Помощь товарищу<br/><small>+20 XP</small>
                </button>
              </div>
            </div>

            <div className={styles.actionGroup}>
              <h4 className={styles.groupTitle}>⚡ Наказать (Дебаффы)</h4>
              <div className={styles.btnGrid}>
                <button className={`${styles.spellBtn} ${styles.spellDebuff}`} onClick={() => handleDebuff('Отвлёкся', 10)} disabled={actionLoading}>
                  <span>💬</span> Отвлёкся<br/><small>-10 HP</small>
                </button>
                <button className={`${styles.spellBtn} ${styles.spellDebuff}`} onClick={() => handleDebuff('Мешает вести урок', 30)} disabled={actionLoading}>
                  <span>⚔️</span> Мешает вести урок<br/><small>-30 HP</small>
                </button>
                <button className={`${styles.spellBtn} ${styles.spellDebuff}`} onClick={() => handleDebuff('Списывание', 50)} disabled={actionLoading}>
                  <span>💀</span> Списывание<br/><small>-50 HP</small>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* История заданий на уроке */}
      {(() => {
        const LESSON_CONTEXTS = ['lesson_dungeon', 'lesson_check', 'lesson_control', 'lesson_dictation', 'lesson'];
        const CONTEXT_ICONS: Record<string, string> = { lesson_dungeon: '✏️', lesson_check: '✅', lesson_control: '📋', lesson_dictation: '🖊️', lesson: '✏️' };
        const STATUS_COLOR: Record<string, string> = { active: '#facc15', completed: '#22c55e', archived: '#6b7280', graded: '#22c55e', expired: '#ef4444', closed: '#6b7280' };
        const STATUS_LABEL: Record<string, string> = { active: 'активно', completed: 'завершено', archived: 'архив', graded: 'проверено', expired: 'просрочено', closed: 'закрыто' };
        const CONTEXT_LABEL: Record<string, string> = { lesson_dungeon: 'Самост.', lesson_check: 'Провер.', lesson_control: 'Контр.', lesson_dictation: 'Диктант', lesson: 'Классн.' };
        const logQuests = quests
          .filter(q => (LESSON_CONTEXTS.includes(q.context || '') || LESSON_CONTEXTS.includes(`lesson_${q.type}`))
            && (!activeSubject || q.subject?.trim().toLowerCase() === activeSubject.trim().toLowerCase()))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 15);
        return (
          <div style={{ padding: '0.75rem 1rem', margin: '0', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-xl)' }}>
            <button
              onClick={() => setHistoryOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.9rem', padding: 0, width: '100%' }}
            >
              <span style={{ transition: 'transform 0.2s', transform: historyOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>▶</span>
              📅 История заданий на уроке{activeSubject ? ` — ${activeSubject}` : ''}
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{logQuests.length}</span>
            </button>
            {historyOpen && (
              logQuests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
                  📭 {activeSubject ? `Нет заданий по «${activeSubject}»` : 'Нет заданий'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.6rem' }}>
                {logQuests.map(q => {
                  const issued   = new Date(q.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  const deadline = q.deadline ? new Date(q.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'без срока';
                  const sc = STATUS_COLOR[q.status] ?? '#6b7280';
                  const sl = STATUS_LABEL[q.status] ?? q.status;
                  const icon = CONTEXT_ICONS[q.context as string] || CONTEXT_ICONS[`lesson_${q.type}`] || '📌';
                  const tLabel = CONTEXT_LABEL[q.context as string] || CONTEXT_LABEL[`lesson_${q.type}`] || 'Задание';
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', padding: '0.4rem 0.75rem' }}>
                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginRight: '0.3rem' }}>{tLabel}</span>{q.title}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>Выдано: {issued} · Дедлайн: {deadline}</div>
                      </div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: `${sc}18`, color: sc, border: `1px solid ${sc}40`, whiteSpace: 'nowrap' }}>{sl}</span>
                    </div>
                  );
                })}
                </div>
              ))
            }
          </div>
        );
      })()}
    </div>
  );
}
