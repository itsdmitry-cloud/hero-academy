'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

const supabase = createClient();

/* ─── Score → rewards mapping ───────────────────────────────────────
   Score 5 = Отлично  → 100% XP, 100% Gold, 0 HP damage
   Score 4 = Хорошо   → 80%  XP, 80%  Gold, 0 HP damage
   Score 3 = Тройка   → 50%  XP, 50%  Gold, 10 HP damage
   Score 2 = Двойка   → 20%  XP, 10%  Gold, 20 HP damage
   Score 1 = Единица  → 0%   XP, 0%   Gold, 30 HP damage
*/
const SCORE_CONFIG: Record<number, { xpPct: number; goldPct: number; hpDamage: number; label: string; color: string }> = {
  5: { xpPct: 1.00, goldPct: 1.00, hpDamage:  0, label: 'Отлично',  color: '#22c55e' },
  4: { xpPct: 0.80, goldPct: 0.80, hpDamage:  0, label: 'Хорошо',   color: '#84cc16' },
  3: { xpPct: 0.50, goldPct: 0.50, hpDamage: 10, label: 'Тройка',   color: '#f59e0b' },
  2: { xpPct: 0.20, goldPct: 0.10, hpDamage: 20, label: 'Двойка',   color: '#f97316' },
  1: { xpPct: 0.00, goldPct: 0.00, hpDamage: 30, label: 'Единица',  color: '#ef4444' },
  0: { xpPct: 0.00, goldPct: 0.00, hpDamage:  0, label: 'НБ (Отсутствует)', color: '#9ca3af' },
};

const QUEST_TYPE_LABELS: Record<string, string> = {
  'base':       '📝 Базовое',
  'hard':       '🧠 Сложное',
  'control':    '📋 Контрольная',
  'check':      '✅ Проверочная',
  'dictation':  '🖊️ Диктант',
  'quest':      '📝 Задание',
  'dungeon':    '✏️ Самостоятельная',
  'lesson_independent': '✏️ Самостоятельная',
  'lesson_check':       '✅ Проверочная',
  'lesson_control':     '📋 Контрольная',
  'lesson_dictation':   '🖊️ Диктант',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy:   '🟢 Лёгкая',
  medium: '🟡 Средняя',
  hard:   '🔴 Сложная',
};

interface StudentRow {
  userId: string;
  heroId: string;
  name: string;
  score: number; // 1–5, default 5
  notSubmitted: boolean; // «Не сдал» — score=1 + флаг для метаданных
  hasArtifacts: boolean; // just a flag — actual calc done server-side
}

const NOT_SUBMITTED_COLOR = '#a855f7';

interface QuestInfo {
  id: string;
  title: string;
  subject: string;
  type: string;
  difficulty: string;
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  class_id: string;
}

export default function CheckHomeworkPage() {
  const { id: questId } = useParams<{ id: string }>();

  const [quest, setQuest] = useState<QuestInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!questId) return;
    setLoading(true);

    const { data: q } = await supabase.from('quests').select('*').eq('id', questId).single();
    if (!q) { setError('Квест не найден'); setLoading(false); return; }
    setQuest(q as QuestInfo);

    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, heroes!left(id)')
      .eq('class_id', (q as QuestInfo).class_id)
      .eq('role', 'student')
      .order('display_name');

    if (!users) { setLoading(false); return; }

    const rows: StudentRow[] = await Promise.all(users.map(async (u: Record<string, unknown>) => {
      const heroArr = Array.isArray(u.heroes) ? u.heroes : (u.heroes ? [u.heroes] : []);
      const hero = heroArr[0] as Record<string, unknown> | null;
      const heroId = (hero?.id as string) ?? '';

      // Check if hero has any equipped artifacts (just for indicator)
      let hasArtifacts = false;
      if (heroId) {
        const { data: equipped } = await supabase
          .from('hero_artifacts')
          .select('id')
          .eq('hero_id', heroId)
          .eq('is_equipped', true)
          .gt('charges_remaining', 0)
          .limit(1);
        hasArtifacts = (equipped?.length ?? 0) > 0;
      }

      return { userId: u.id as string, heroId, name: u.display_name as string, score: 5, notSubmitted: false, hasArtifacts };
    }));

    setStudents(rows);
    setLoading(false);
  }, [questId]);

  useEffect(() => { loadData(); }, [loadData]);

  const setScore = (userId: string, score: number) => {
    setStudents(prev => prev.map(s => s.userId === userId ? { ...s, score, notSubmitted: false } : s));
  };

  const setNotSubmitted = (userId: string) => {
    setStudents(prev => prev.map(s => s.userId === userId ? { ...s, score: 1, notSubmitted: true } : s));
  };

  const handleFinish = async () => {
    if (!quest) return;
    setSubmitting(true);
    setError(null);

    try {
      // ── 1. Upsert quest_attempts in PARALLEL (fast DB writes) ──
      await Promise.all(students.map(async (s) => {
        if (!s.heroId) return;
        const cfg = SCORE_CONFIG[s.score];
        const baseXp    = Math.round(quest.xp_reward  * cfg.xpPct);
        const baseGold  = Math.round(quest.gold_reward * cfg.goldPct);
        const baseHpDmg = cfg.hpDamage; // absolute HP damage; backend applies eco + artifact + random

        const attemptData = {
          grade: s.score,
          xp_earned: baseXp,
          gold_earned: baseGold,
          hp_lost: baseHpDmg,
          status: 'completed',
          graded_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from('quest_attempts').select('id')
          .eq('quest_id', quest.id).eq('hero_id', s.heroId).maybeSingle();

        if (existing) {
          await supabase.from('quest_attempts').update(attemptData).eq('id', existing.id);
        } else {
          await supabase.from('quest_attempts').insert({ quest_id: quest.id, hero_id: s.heroId, ...attemptData });
        }
      }));

      // ── 2. Ensure boss exists ──
      await fetch('/api/bosses/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: quest.class_id, subjects: [quest.subject] }),
      });

      // ── 3. Single batch grading call — all students processed in parallel server-side ──
      const { data: { session } } = await supabase.auth.getSession();
      const teacherId = session?.user?.id ?? '';

      const grades = students
        .filter(s => s.heroId)
        .map(s => {
          const cfg = SCORE_CONFIG[s.score];
          return {
            heroId: s.heroId,
            score: s.score,
            notSubmitted: s.notSubmitted,
            xp:       Math.round(quest.xp_reward  * cfg.xpPct),
            gold:     Math.round(quest.gold_reward * cfg.goldPct),
            hpDamage: cfg.hpDamage, // absolute; backend applies eco + artifact + random
          };
        });

      const res = await fetch('/api/game/grade-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questId:   quest.id,
          classId:   quest.class_id,
          subject:   quest.subject,
          teacherId,
          difficulty: quest.difficulty,
          questType:  quest.type,
          grades,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Ошибка сервера: ${res.status}`);
      }

      setSuccess(true);
    } catch (e) {
      setError((e as Error).message ?? 'Ошибка при сохранении');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success screen ── */
  if (success && quest) {
    const goodCount = students.filter(s => s.score >= 4).length;
    return (
      <div className={styles.page}>
        <div className={styles.successScreen}>
          <span className={styles.successIcon}>✅</span>
          <h1 className="text-display">Задание проверено!</h1>
          <p>XP, Gold и HP распределены.<br/>{goodCount} из {students.length} учеников получили полный XP.</p>
          <a href="/teacher" style={{ display:'inline-block', marginTop:'1rem', padding:'0.75rem 1.5rem', background:'var(--gradient-purple)', color:'white', borderRadius:'var(--radius-lg)', fontWeight:700, textDecoration:'none' }}>
            ← На главную
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className="text-display">Проверка: {quest?.title ?? '…'}</h1>
          <p className={styles.subtitle}>
            {quest?.subject} · {QUEST_TYPE_LABELS[quest?.type ?? ''] ?? quest?.type} · {DIFFICULTY_LABELS[quest?.difficulty ?? ''] ?? quest?.difficulty}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Нет учеников в классе</div>
      ) : (
        <>
          <div className={styles.studentList}>
            <div className={styles.listHeader}>
              <span>Ученик</span>
              <span style={{ textAlign: 'center' }}>Оценка</span>
              <span className={styles.headerEffect}>Итог</span>
            </div>

            {students.map((student) => {
              const cfg = SCORE_CONFIG[student.score];
              // Preview shows BASE values — server applies eco multipliers, artifacts, ±10% random
              const xp   = Math.round(quest!.xp_reward  * cfg.xpPct);
              const gold = Math.round(quest!.gold_reward * cfg.goldPct);
              const hp   = cfg.hpDamage; // base damage from quest; server applies dmg_multiplier

              return (
                <div key={student.userId} className={`${styles.studentRow} ${student.score <= 2 ? styles.rowDamaged : ''}`}>
                  <div className={styles.studentInfo}>
                    <span className={styles.avatar}>🧙‍♂️</span>
                    <div>
                      <span className={styles.name}>{student.name}</span>
                      {student.hasArtifacts && (
                        <span style={{ fontSize: '0.65rem', marginLeft: '0.4rem', opacity: 0.7 }} title="Есть активные артефакты — итог посчитает сервер">💎</span>
                      )}
                    </div>
                  </div>

                  {/* Кнопки оценок: НБ, 1-5, «Не сдал» */}
                  <div className={styles.statusCell} style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {[0, 1, 2, 3, 4, 5].map(n => {
                      const isSelected = student.score === n && !student.notSubmitted;
                      return (
                        <button
                          key={n}
                          onClick={() => setScore(student.userId, n)}
                          style={{
                            width: 36, height: 36,
                            borderRadius: '50%',
                            border: isSelected ? `2px solid ${SCORE_CONFIG[n].color}` : '1px solid rgba(255,255,255,0.15)',
                            background: isSelected ? SCORE_CONFIG[n].color : 'rgba(255,255,255,0.05)',
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 800, fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                          }}
                        >
                          {n === 0 ? 'НБ' : n}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setNotSubmitted(student.userId)}
                      title="Не сдал задание — 30 HP урона, 0 XP, 0 Gold"
                      style={{
                        minWidth: 70, height: 36,
                        padding: '0 0.5rem',
                        borderRadius: 18,
                        border: student.notSubmitted ? `2px solid ${NOT_SUBMITTED_COLOR}` : '1px solid rgba(255,255,255,0.15)',
                        background: student.notSubmitted ? NOT_SUBMITTED_COLOR : 'rgba(255,255,255,0.05)',
                        color: student.notSubmitted ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 800, fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        transform: student.notSubmitted ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      Не сдал
                    </button>
                  </div>

                  <div className={styles.effectCell}>
                    {xp > 0 && <span className={styles.xpText} title="Базовое значение, итог ±10%">+{xp} XP</span>}
                    {gold > 0 && <span style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 700 }}>+{gold} 💰</span>}
                    {hp > 0 && <span className={styles.hpText} title="Базовый урон, итог зависит от баланса и артефактов">-{hp} ❤️</span>}
                    {xp === 0 && hp === 0 && <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>—</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{ color: 'var(--accent-hp)', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div className={styles.actionBar}>
            <div className={styles.stats}>
              Получат XP: <strong>{students.filter(s => s.score >= 3).length}</strong> из {students.length}
            </div>
            <Button variant="primary" onClick={handleFinish} disabled={submitting} className={styles.finishBtn}>
              {submitting ? '⏳ Сохранение...' : '✅ Выставить оценки классу'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
