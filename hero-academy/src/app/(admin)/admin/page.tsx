'use client';

import { useState, useEffect } from 'react';
import { useAdminData } from '@/lib/hooks/use-admin-data';
import { StatCard } from '@/components/ui/StatCard';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ── Mini CSS bar chart ── */
function BarChart({ data, color = 'var(--accent-primary)' }: {
  data: { label: string; value: number; max: number }[];
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {data.map(({ label, value, max }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem', fontWeight: 700 }}>
            <span>{label}</span>
            <span style={{ opacity: 0.7 }}>{value}</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Chart card wrapper ── */
function ChartCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-2xl)', padding: '1.25rem' }}>
      <div style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>{icon} {title}</div>
      {children}
    </div>
  );
}

const supabase = createClient();

export default function AdminDashboard() {
  const { schools, classes, analytics, loading } = useAdminData();
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [heroStats, setHeroStats] = useState<{ xp: number; status: string }[]>([]);
  const [questStats, setQuestStats] = useState<{ status: string }[]>([]);

  useEffect(() => {
    // Подписка на "внешний источник" (Supabase) для one-shot fetch. setState
    // внутри then() — это callback от внешней системы, а не sync effect body,
    // поэтому правило `set-state-in-effect` удовлетворено. Cancelled-флаг
    // защищает от setState после размонтирования.
    let cancelled = false;
    Promise.all([
      supabase.from('heroes').select('xp, status'),
      supabase.from('quests').select('status'),
    ]).then(([heroesRes, questsRes]) => {
      if (cancelled) return;
      if (heroesRes.data) setHeroStats(heroesRes.data as { xp: number; status: string }[]);
      if (questsRes.data) setQuestStats(questsRes.data as { status: string }[]);
    });
    return () => { cancelled = true; };
  }, []);

  const a = analytics ?? {
    total_students: 0, total_teachers: 0, total_schools: 0,
    active_quests: 0, avg_xp: 0, hero_deaths: 0, gold_in_circulation: 0,
  };

  /* ── XP distribution brackets ── */
  const xpBuckets = [
    { label: '0–499',     min: 0,    max: 499 },
    { label: '500–1999',  min: 500,  max: 1999 },
    { label: '2000–4999', min: 2000, max: 4999 },
    { label: '5000–9999', min: 5000, max: 9999 },
    { label: '10 000+',   min: 10000, max: Infinity },
  ];
  const maxBucket = Math.max(1, ...xpBuckets.map(b => heroStats.filter(h => h.xp >= b.min && h.xp <= b.max).length));
  const xpChartData = xpBuckets.map(b => ({
    label: b.label,
    value: heroStats.filter(h => h.xp >= b.min && h.xp <= b.max).length,
    max: maxBucket,
  }));

  /* ── HP survival ── */
  const alive = heroStats.filter(h => h.status === 'active').length;
  const fallen = heroStats.filter(h => h.status === 'inactive').length;
  const total = alive + fallen || 1;
  const survivalPct = Math.round((alive / total) * 100);

  /* ── Quest funnel ── */
  const qActive = questStats.filter(q => q.status === 'active').length;
  const qDraft = questStats.filter(q => q.status === 'draft').length;
  const qArchived = questStats.filter(q => q.status === 'archived').length;
  const maxQ = Math.max(1, qActive + qDraft + qArchived);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className="text-display">📊 Аналитика</h1>
        <div className={styles.filters}>
          <select className={styles.select} value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
            <option value="all">Все школы</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Live KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard icon="🧙" label="Учеников" value={loading ? '…' : a.total_students} color="primary" />
        <StatCard icon="👩‍🏫" label="Учителей" value={loading ? '…' : a.total_teachers} color="info" />
        <StatCard icon="🏫" label="Школ" value={loading ? '…' : a.total_schools} color="info" />
        <StatCard icon="⚔️" label="Активных квестов" value={loading ? '…' : a.active_quests} color="primary" />
        <StatCard icon="⭐" label="Средний XP" value={loading ? '…' : fmt(a.avg_xp)} color="xp" />
        <StatCard icon="💀" label="Герои HP=0" value={loading ? '…' : a.hero_deaths} color="hp" />
        <StatCard icon="💰" label="Gold в обороте" value={loading ? '…' : fmt(a.gold_in_circulation)} color="gold" />
      </div>

      {/* Alerts */}
      <div className={styles.alertsSection}>
        {a.hero_deaths > 0 && (
          <div className={`${styles.alertCard} ${styles.alert_danger}`}>
            <span className={styles.alertIcon}>💀</span>
            <span className={styles.alertText}>{a.hero_deaths} учеников с HP=0 (неактивны)</span>
          </div>
        )}
        {a.total_students === 0 && !loading && (
          <div className={`${styles.alertCard} ${styles.alert_info}`}>
            <span className={styles.alertIcon}>ℹ️</span>
            <span className={styles.alertText}>Нет учеников — пригласите через коды классов</span>
          </div>
        )}
      </div>

      {/* Analytics Charts */}
      <h2 className="text-display" style={{ marginBottom: '0.75rem' }}>📈 Графики</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* XP Distribution */}
        <ChartCard title="Распределение XP" icon="⭐">
          {heroStats.length === 0
            ? <div style={{ opacity: 0.5, textAlign: 'center', padding: '1rem' }}>Нет данных</div>
            : <BarChart data={xpChartData} color="var(--accent-xp)" />
          }
        </ChartCard>

        {/* HP Survival */}
        <ChartCard title="Выживаемость героев" icon="❤️">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${survivalPct}%`, background: 'linear-gradient(90deg, var(--accent-xp), var(--accent-primary))', borderRadius: '999px', transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', minWidth: '3rem' }}>{survivalPct}%</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <span style={{ color: 'var(--accent-xp)' }}>✅ Живые: {alive}</span>
              <span style={{ color: 'var(--accent-hp)' }}>💀 Упали: {fallen}</span>
            </div>
          </div>
        </ChartCard>

        {/* Quest Funnel */}
        <ChartCard title="Квесты по статусу" icon="⚔️">
          <BarChart color="var(--accent-primary)" data={[
            { label: '🟢 Активные', value: qActive, max: maxQ },
            { label: '📝 Черновики', value: qDraft, max: maxQ },
            { label: '📦 Архивные', value: qArchived, max: maxQ },
          ]} />
        </ChartCard>
      </div>

      {/* Schools Table */}
      <h2 className="text-display" style={{ marginBottom: '0.75rem' }}>🏫 Школы</h2>
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <span>Школа</span><span>Классов</span><span>Учеников</span><span>Статус</span>
        </div>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>⏳ Загрузка...</div>
        ) : schools.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет школ. Создайте в разделе Школы.</div>
        ) : schools.filter(s => !s.name.startsWith('__TEST_')).map(s => {
          const schoolClasses = classes.filter(c => c.school_id === s.id);
          const classCount = schoolClasses.length;
          const studentCount = schoolClasses.reduce((sum, c) => sum + c.student_count, 0);
          return (
            <div key={s.id} className={styles.tableRow} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
              <span style={{ fontWeight: 700 }}>{s.name}</span>
              <span>{classCount}</span>
              <span>{studentCount}</span>
              <span style={{ color: studentCount > 0 ? 'var(--accent-xp)' : 'var(--text-muted)' }}>
                {studentCount > 0 ? '🟢 Активна' : '⚪ Пусто'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

