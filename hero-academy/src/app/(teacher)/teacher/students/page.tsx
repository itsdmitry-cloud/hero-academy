'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTeacherData, type StudentRow } from '@/lib/hooks/use-teacher-data';
import { useAuth } from '@/lib/supabase/auth-context';
import { StudentAnalyticsModal } from '@/components/teacher/StudentAnalyticsModal';
import styles from './page.module.css';

/* Deterministic color per student name */
function nameColor(name: string) {
  const colors = [
    'linear-gradient(135deg,#7c3aed,#a855f7)',
    'linear-gradient(135deg,#2563eb,#3b82f6)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#d97706,#f59e0b)',
    'linear-gradient(135deg,#dc2626,#ef4444)',
    'linear-gradient(135deg,#7c3aed,#06b6d4)',
    'linear-gradient(135deg,#be185d,#ec4899)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

export default function StudentsPage() {
  useAuth();
  const { classes, activeClassId, setActiveClassId, students, stats, loading, grantXp, damageHp } = useTeacherData();

  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [actionMode, setActionMode] = useState<'xp' | 'hp' | null>(null);
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [infoStudent, setInfoStudent] = useState<StudentRow | null>(null);

  const activeClass = classes.find(c => c.id === activeClassId);

  const handleAction = async () => {
    if (!selected || !actionMode) return;
    if (!selected.hero_id) { setFeedback('У ученика нет героя'); return; }
    setActionLoading(true);
    const { error } = actionMode === 'xp'
      ? await grantXp(selected.hero_id, amount, reason)
      : await damageHp(selected.hero_id, amount, reason);
    setActionLoading(false);
    if (error) { setFeedback(`Ошибка: ${error}`); return; }
    setFeedback(actionMode === 'xp'
      ? `✅ +${amount} XP → ${selected.display_name}`
      : `✅ -${amount} HP ← ${selected.display_name}`);
    setTimeout(() => { setFeedback(null); setSelected(null); setActionMode(null); }, 2500);
  };

  /* Sort by XP desc for ranking */
  const sorted = [...students].sort((a, b) => b.xp - a.xp);

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className="text-display">Мои Классы</h1>
          <p className={styles.subtitle}>
            {classes.length} {classes.length === 1 ? 'класс' : 'класса'} · {students.length} учеников
          </p>
        </div>
      </div>

      {/* ── Class Tabs ─────────────── */}
      {classes.length > 0 && (
        <div className={styles.classTabs}>
          {classes.map(cls => (
            <button
              key={cls.id}
              className={`${styles.tabBtn} ${cls.id === activeClassId ? styles.tabActive : ''}`}
              onClick={() => setActiveClassId(cls.id)}
            >
              <span className={styles.tabIcon}>🏛️</span>
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Class Banner ───────────── */}
      {activeClass && (
        <div className={styles.classBanner}>
          <div className={styles.bannerLeft}>
            <div className={styles.classIconWrap}>🏛️</div>
            <div>
              <div className={styles.className}>{activeClass.name}</div>
              <div className={styles.inviteRow}>
                <span className={styles.inviteLabel}>Код приглашения:</span>
                <span className={styles.inviteCode}>{activeClass.invite_code}</span>
              </div>
            </div>
          </div>

          <div className={styles.bannerStats}>
            <div className={styles.bstat}>
              <span className={styles.bstatVal}>{stats?.student_count ?? students.length}</span>
              <span className={styles.bstatLbl}>Учеников</span>
            </div>
            <div className={styles.bstatDivider} />
            <div className={styles.bstat}>
              <span className={styles.bstatVal}>{(stats?.avg_xp ?? 0).toLocaleString('ru-RU')}</span>
              <span className={styles.bstatLbl}>Ср. XP</span>
            </div>
            <div className={styles.bstatDivider} />
            <div className={styles.bstat}>
              <span className={styles.bstatVal}>🔥&thinsp;{stats?.class_streak ?? 0}</span>
              <span className={styles.bstatLbl}>Стрик</span>
            </div>
            <div className={styles.bstatDivider} />
            <div className={styles.bstat}>
              <span className={styles.bstatVal}>{stats?.active_quests ?? 0}</span>
              <span className={styles.bstatLbl}>Квестов</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────── */}
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpin}>⏳</div>
          <p>Загрузка учеников...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyTitle}>Нет учеников в классе</div>
          <p className={styles.emptyText}>Поделитесь кодом приглашения чтобы ученики присоединились</p>
          {activeClass && (
            <div className={styles.emptyCode}>{activeClass.invite_code}</div>
          )}
        </div>
      ) : (
        /* ── Student Grid ──────────── */
        <div className={styles.studentGrid}>
          {sorted.map((st, idx) => {
            const hpPct  = Math.round((st.hp / Math.max(st.hp_max, 1)) * 100);
            const xpPct  = Math.round((st.xp / Math.max(st.xp_to_next, 1)) * 100);
            const isDead = st.status === 'inactive';
            const rank   = idx + 1;
            const initial = (st.display_name[0] ?? '?').toUpperCase();

            return (
              <div key={st.id} className={`${styles.card} ${isDead ? styles.cardDead : ''}`}>

                {/* Rank */}
                <div className={`${styles.rankBadge} ${rank <= 3 ? styles[`rank${rank}` as keyof typeof styles] : ''}`}>
                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                </div>

                {/* Avatar */}
                <div className={styles.avatarWrap}>
                  <div
                    className={styles.avatar}
                    style={{ background: nameColor(st.display_name) }}
                  >
                    {initial}
                  </div>
                  {isDead && <div className={styles.deadOverlay}>💀</div>}
                  <div className={styles.lvlBadge}>Lv.{st.level}</div>
                </div>

                {/* Name */}
                <div className={styles.studentName} title={st.display_name}>
                  {st.display_name}
                  {isDead && <span className={styles.deadTag}>Пал</span>}
                </div>

                {/* HP Bar */}
                <div className={styles.barRow}>
                  <span className={styles.barIcon}>❤️</span>
                  <div className={styles.track}>
                    <div
                      className={styles.fill}
                      style={{
                        width: `${hpPct}%`,
                        background: hpPct > 60
                          ? 'var(--accent-hp)'
                          : hpPct > 25
                          ? '#ff9f43'
                          : '#ff4757',
                      }}
                    />
                  </div>
                  <span className={styles.barVal}>{st.hp}<span className={styles.barSep}>/</span>{st.hp_max}</span>
                </div>

                {/* XP Bar */}
                <div className={styles.barRow}>
                  <span className={styles.barIcon}>⚡</span>
                  <div className={styles.track}>
                    <div
                      className={styles.fill}
                      style={{ width: `${xpPct}%`, background: 'var(--accent-xp)' }}
                    />
                  </div>
                  <span className={styles.barVal}>{xpPct}%</span>
                </div>

                {/* Mini stats */}
                <div className={styles.miniStats}>
                  <span className={styles.mstat}><span>💰</span>{st.gold.toLocaleString('ru-RU')}</span>
                  <span className={styles.mstat}><span>🔥</span>{st.streak}д</span>
                  <span className={styles.mstat}><span>⚡</span>{st.xp.toLocaleString('ru-RU')}</span>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                  <button
                    className={styles.btnXp}
                    onClick={() => { setSelected(st); setActionMode('xp'); setAmount(50); setReason(''); }}
                  >⭐ XP</button>
                  <button
                    className={styles.btnHp}
                    onClick={() => { setSelected(st); setActionMode('hp'); setAmount(10); setReason(''); }}
                  >💔 HP</button>
                </div>
                <button
                  className={styles.btnInfo}
                  onClick={() => setInfoStudent(st)}
                >📊 Аналитика</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Toast ──────────────────── */}
      {feedback && <div className={styles.toast}>{feedback}</div>}

      {/* ── Action Modal ───────────── */}
      <Modal
        isOpen={!!selected && !!actionMode}
        onClose={() => { setSelected(null); setActionMode(null); }}
        title={actionMode === 'xp'
          ? `⭐ Выдать XP — ${selected?.display_name}`
          : `💔 Снять HP — ${selected?.display_name}`}
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {actionMode === 'xp' ? 'Количество XP' : 'Количество HP'}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(actionMode === 'xp' ? [25, 50, 100, 150, 200, 300] : [5, 10, 15, 20, 30, 50]).map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)',
                    border: amount === v ? '2px solid var(--accent-xp)' : '2px solid var(--bg-glass-border)',
                    background: amount === v ? 'rgba(255,159,67,0.2)' : 'var(--bg-glass)',
                    color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {actionMode === 'xp' ? `+${v}` : `-${v}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Причина (необязательно)
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Активность на уроке..."
              style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
          </div>
          <Button variant="primary" fullWidth disabled={actionLoading} onClick={handleAction}>
            {actionLoading ? 'Применяем...' : actionMode === 'xp' ? `Выдать +${amount} XP` : `Снять -${amount} HP`}
          </Button>
        </div>
      </Modal>

      {/* ── Analytics Modal ─────────── */}
      <StudentAnalyticsModal
        student={infoStudent}
        onClose={() => setInfoStudent(null)}
      />
    </div>
  );
}
