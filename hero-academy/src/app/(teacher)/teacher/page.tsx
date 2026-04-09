'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTeacherData } from '@/lib/hooks/use-teacher-data';
import { useAuth } from '@/lib/supabase/auth-context';
import { StatCard } from '@/components/ui/StatCard';
import { useSubjectBosses } from '@/lib/hooks/use-subject-bosses';
import styles from './page.module.css';

interface FeedEvent {
  id: string; hero_name: string; icon: string; label: string; subject: string; created_at: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { classes, activeClassId, setActiveClassId, students, quests, stats, loading, subjects, activeSubject } = useTeacherData();
  // Always create bosses for ALL teacher subjects on dashboard load
  // Display only the active subject's boss in the UI
  const { bosses: allBosses, seasonMissing } = useSubjectBosses(activeClassId, subjects);
  const subjectBosses = activeSubject
    ? allBosses.filter(b => b.subject_id.toLowerCase() === activeSubject.toLowerCase())
    : allBosses;

  const [feed, setFeed] = useState<FeedEvent[]>([]);

  useEffect(() => {
    if (!activeClassId) return;
    const load = () => {
      const subjectParam = activeSubject ? `&subject=${encodeURIComponent(activeSubject)}` : '';
      fetch(`/api/teacher/feed?classId=${activeClassId}&limit=30${subjectParam}`)
        .then(r => r.json())
        .then(d => setFeed(d.events ?? []))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [activeClassId, activeSubject]);


  const activeClass = classes.find(c => c.id === activeClassId);
  const displayName = activeClass ? activeClass.name : 'Дашборд';
  const displayStats = stats ?? { student_count: 0, active_quests: 0, avg_xp: 0, total_xp: 0, class_streak: 0 };
  const displayStudents = students;

  return (
    <div className={styles.page}>


      <h1 className="text-display">Дашборд: {displayName}</h1>

      {/* Stat Cards */}
      <div className={styles.stats}>
        <StatCard icon="👥" label="Учеников" value={displayStats.student_count} color="info" />
        <StatCard icon="⚔️" label="Активных квестов" value={displayStats.active_quests} color="primary" />
        <StatCard icon="⭐" label="Средний XP" value={displayStats.avg_xp.toLocaleString('ru-RU')} color="xp" />
        <StatCard icon="🔥" label="Стрик класса" value={`${displayStats.class_streak}`} color="streak" />
      </div>

      {/* Season-not-configured banner */}
      {seasonMissing && (
        <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--bg-glass)', border: '1px solid #f59e0b', borderRadius: 'var(--radius-xl)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: 'var(--text-base)' }}>Сезон не настроен</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Боссы по предметам появятся после того, как администратор создаст и активирует сезон для вашей школы.
            </div>
          </div>
        </div>
      )}

      {/* Subject Boss Bars */}
      {subjectBosses.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {subjectBosses.map(boss => {
            const pct = Math.min(100, Math.round(((boss.max_hp - boss.current_hp) / boss.max_hp) * 100));
            return (
              <div key={boss.id} style={{ background: 'var(--bg-glass)', padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)', border: `1px solid ${boss.is_defeated ? '#34d39966' : 'var(--accent-xp)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>{boss.avatar || '🐉'}</span>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{boss.name}</h3>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                        {boss.is_defeated ? '☠️ Повержен этот сезон!' : `Нанесено урона: ${(boss.max_hp - boss.current_hp).toLocaleString('ru-RU')} / ${boss.max_hp.toLocaleString('ru-RU')}`}
                      </p>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: boss.is_defeated ? '#34d399' : 'var(--accent-xp)', fontSize: 'var(--text-lg)' }}>
                    {pct}%
                  </div>
                </div>
                <div style={{ height: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--bg-glass-border)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: boss.is_defeated ? 'linear-gradient(90deg,#34d399,#059669)' : 'var(--gradient-hp)', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Active Quests — quick check panel */}
      {quests.filter(q => q.status === 'active' && (!activeSubject || q.subject?.trim().toLowerCase() === activeSubject.trim().toLowerCase())).length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="text-display" style={{ marginBottom: '0.75rem' }}>📋 Требуют проверки</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {quests.filter(q => q.status === 'active' && (!activeSubject || q.subject?.trim().toLowerCase() === activeSubject.trim().toLowerCase())).map(q => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-xl)', padding: '0.75rem 1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{q.title}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{q.subject} · {q.deadline ? new Date(q.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Без срока'}</div>
                </div>
                <Link
                  href={`/teacher/quests/${q.id}/check`}
                  style={{ padding: '0.4rem 1rem', background: 'var(--gradient-purple)', color: '#fff', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  ✅ Проверить
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className={styles.columns}>
        {/* Activity Feed */}
        <div className={styles.feedSection}>
          <h2 className="text-display">Лента событий</h2>
          <div className={styles.feed}>
            {feed.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                <div>Действий пока нет</div>
              </div>
            )}
            {feed.map((item) => {
              const t = new Date(item.created_at);
              const timeStr = t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const dateStr = t.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              return (
                <div key={item.id} className={styles.feedItem}>
                  <span className={styles.feedIcon}>{item.icon}</span>
                  <div className={styles.feedContent}>
                    <span className={styles.feedText}>
                      <strong>{item.hero_name}</strong> — {item.label}
                      {item.subject && <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', opacity: 0.6 }}>[{item.subject}]</span>}
                    </span>
                    <span className={styles.feedTime}>{dateStr} {timeStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* Students Quick View */}
        <div className={styles.studentsSection}>
          <h2 className="text-display">Ученики {loading ? '⏳' : `(${displayStudents.length})`}</h2>
          <div className={styles.studentsList}>
            {displayStudents.map((s) => (
              <div key={s.id} className={`${styles.studentRow} ${s.status === 'inactive' ? styles.inactive : ''}`}>
                <span className={styles.studentAvatar} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {s.avatar_url && s.avatar_url.startsWith('/') ? (
                    <img src={s.avatar_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (s.avatar_url || '🧙‍♂️')}
                </span>
                <div className={styles.studentInfo}>
                  <span className={styles.studentName}>
                    {s.display_name}
                    {s.status === 'inactive' && <span className={styles.inactiveBadge}>💀</span>}
                  </span>
                  <span className={styles.studentMeta}>
                    Lv.{s.level} · ❤️ {s.hp} · 🔥 {s.streak}
                  </span>
                </div>
                <span className={styles.studentXp}>{s.xp.toLocaleString('ru-RU')} XP</span>
              </div>
            ))}
            {displayStudents.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2rem' }}>📭</div>
                <div>Нет учеников в этом классе</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Код: <strong>{activeClass?.invite_code}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
