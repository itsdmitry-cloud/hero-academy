'use client';

import { useState, useCallback } from 'react';
import { useAdminData } from '@/lib/hooks/use-admin-data';
import styles from './page.module.css';

const seasonResets = [
  { param: 'HP всех героев', action: 'Сброс до 100%', icon: '❤️' },
  { param: 'Streak', action: 'Сброс до 0', icon: '🔥' },
  { param: 'Лидерборд', action: 'Архивирование + сброс', icon: '🏆' },
  { param: 'Нерозданные награды', action: 'Авто-раздача', icon: '🎁' },
  { param: 'Золото', action: 'Без изменений', icon: '💰' },
  { param: 'Артефакты', action: 'Без изменений', icon: '💎' },
];

export default function SeasonsPage() {
  const { schools, seasons, loading, createSeason, refetch } = useAdminData();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activateSeason = useCallback(async (seasonId: string) => {
    setActivating(seasonId);
    const res = await fetch('/api/admin/activate-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId }),
    });
    const data = await res.json();
    setActivating(null);
    if (!res.ok) { setFeedback(`❌ Ошибка: ${data.error}`); }
    else { setFeedback('✅ Сезон активирован! Теперь боссы будут создаваться для этого сезона.'); if (refetch) refetch(); }
    setTimeout(() => setFeedback(null), 4000);
  }, [refetch]);

  /* ── End Season: reset HP+streak, archive leaderboard ── */
  const endSeason = useCallback(async (seasonId: string) => {
    if (!window.confirm('Завершить сезон? Это сбросит HP и стрик всем героям.')) return;
    setEnding(seasonId);

    const res = await fetch('/api/admin/end-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId }),
    });
    const data = await res.json();

    setEnding(null);
    if (!res.ok) {
      setFeedback(`❌ Ошибка: ${data.error}`);
    } else {
      setFeedback('✅ Сезон завершён. HP и стрик сброшены. Лидерборд архивирован.');
      if (refetch) refetch();
    }
    setTimeout(() => setFeedback(null), 4000);
  }, [refetch]);

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate) {
      setFeedback('❌ Заполните все поля: Название, Начало и Конец');
      return;
    }
    const schoolId = selectedSchoolId;
    if (!schoolId) {
      setFeedback('❌ Пожалуйста, выберите школу из выпадающего списка!');
      return;
    }
    setSaving(true);
    const { error } = await createSeason(name.trim(), startDate, endDate, schoolId);
    setSaving(false);
    if (error) { setFeedback(`Ошибка: ${error}`); return; }
    setFeedback('✅ Сезон создан!');
    setName(''); setStartDate(''); setEndDate('');
    setShowAdd(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className="text-display">🗓️ Сезоны</h1>
        <button className={styles.addBtn} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '✕ Отмена' : '+ Новый сезон'}
        </button>
      </div>

      {feedback && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 700 }}>
          {feedback}
        </div>
      )}

      {/* Create season form */}
      {showAdd && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Название сезона *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Весна 2026" style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '180px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Начало *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.6rem', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Школа *</label>
            <select value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)} style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '200px' }}>
              <option value="">-- Выберите школу --</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Крайняя дата (конец) *</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.6rem', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>
          <button onClick={handleCreate} disabled={saving} style={{ padding: '0.6rem 1.5rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Создание...' : 'Создать'}
          </button>
        </div>
      )}

      {/* Seasons list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div>
      ) : (
        <div className={styles.seasonGrid}>
          {seasons.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
              Нет сезонов. Создайте первый.
            </div>
          )}
          {seasons.map(s => {
            const schoolName = schools.find(sc => sc.id === s.school_id)?.name ?? '—';
            return (
            <div key={s.id} className={`${styles.seasonCard} ${s.status === 'active' ? styles.seasonActive : ''}`}>
              <div className={styles.seasonHeader}>
                <span className={styles.seasonName}>{s.name}</span>
                <span className={`${styles.seasonStatus} ${s.status === 'active' ? styles.sActive : s.status === 'upcoming' ? styles.sUpcoming : styles.sEnded}`}>
                  {s.status === 'active' ? '🟢 Активен' : s.status === 'upcoming' ? '📅 Запланирован' : '⚫ Завершён'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>
                🏫 {schoolName}
              </div>
              <div className={styles.seasonDates}>
                📅 {new Date(s.starts_at).toLocaleDateString('ru')} — {new Date(s.ends_at).toLocaleDateString('ru')}
              </div>
              {s.status === 'upcoming' && (
                <>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Начинается через {Math.max(0, Math.ceil((new Date(s.starts_at).getTime() - Date.now()) / 86400000))} дн.
                  </div>
                  <button
                    onClick={() => activateSeason(s.id)}
                    disabled={activating === s.id}
                    style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)', borderRadius: 'var(--radius-lg)', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {activating === s.id ? '⏳ Активация...' : '🚀 Активировать сезон'}
                  </button>
                </>
              )}
              {s.status === 'active' && (
                <button
                  onClick={() => endSeason(s.id)}
                  disabled={ending === s.id}
                  style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 'var(--radius-lg)', color: '#f87171', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {ending === s.id ? '⏳ Завершение...' : '🏁 Завершить сезон'}
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Season end rules */}
      <div className={styles.rulesSection}>
        <h2 className="text-display">📋 Правила конца сезона</h2>
        <div className={styles.rulesGrid}>
          {seasonResets.map((r, i) => (
            <div key={i} className={styles.ruleCard}>
              <span className={styles.ruleIcon}>{r.icon}</span>
              <div>
                <div className={styles.ruleParam}>{r.param}</div>
                <div className={styles.ruleAction}>{r.action}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
