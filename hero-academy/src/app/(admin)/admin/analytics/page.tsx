'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminData } from '@/lib/hooks/use-admin-data';
import styles from '../page.module.css';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const supabase = createClient();

/* ── Metric descriptions for admin ── */
const METRIC_INFO: Record<string, { title: string; desc: string; icon: string; color: string }> = {
  avg_hp:        { title: 'Средний HP',           desc: 'Среднее здоровье всех героев. Ниже 50 → класс на грани массового вымирания, нужно снижать dmg_multiplier или давать бонусные зелья.',  icon: '❤️', color: '#ef4444' },
  danger_zone:   { title: 'В красной зоне',       desc: 'Ученики с HP ниже 30. Они одну тройку от «смерти». Если их больше 20% — экономика слишком жёсткая.',                                 icon: '🚑', color: '#f97316' },
  avg_gold:      { title: 'Средний баланс Gold',   desc: 'Если Gold копится без потребления → магазин дорогой или неинтересный. Если 0 → ученики не могут купить зелья.',                       icon: '💰', color: '#eab308' },
  avg_level:     { title: 'Средний уровень',       desc: 'Темп прокачки. За сезон (90 дней) при 4 уроках/день ожидаемый уровень ~15–25.',                                                     icon: '🌟', color: '#8b5cf6' },
  dau:           { title: 'DAU (Активные)',         desc: 'Уникальные ученики, совершившие любое действие за день. Если DAU < 50% от Total → половина класса не пользуется системой.',          icon: '📱', color: '#3b82f6' },
  gold_balance:  { title: 'Баланс экономики Gold', desc: 'Добыто vs Потрачено. Если Добыто >> Потрачено → инфляция. Если Потрачено >> Добыто → дефицит.',                                    icon: '⚖️', color: '#06b6d4' },
  hp_balance:    { title: 'Баланс HP',             desc: 'Получено урона vs Восстановлено. Если урон >> восстановление → ученики умирают быстрее, чем лечатся.',                              icon: '🩺', color: '#ec4899' },
};

/* ── Descriptive card with info tooltip ── */
function MetricCard({ metricKey, value, sub }: { metricKey: string; value: string | number; sub?: string }) {
  const m = METRIC_INFO[metricKey];
  if (!m) return null;
  return (
    <div style={{
      background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
      border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-2xl)',
      padding: '1.25rem', position: 'relative',
    }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, marginBottom: '0.4rem' }}>
        {m.icon} {m.title}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color: m.color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>{sub}</div>}
      <div style={{
        fontSize: '0.72rem', opacity: 0.45, marginTop: '0.75rem', lineHeight: 1.4,
        borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem',
      }}>
        💡 {m.desc}
      </div>
    </div>
  );
}

/* ── Chart wrapper ── */
function ChartSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
      border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-2xl)',
      padding: '1.5rem', marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem' }}>{title}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.45, marginTop: '0.2rem', maxWidth: 600 }}>{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

const COLORS_PIE = ['#22c55e','#84cc16','#f59e0b','#ef4444','#8b5cf6'];

/* ── Types ── */
interface TooltipPayloadItem {
  color?: string;
  name?: string | number;
  value?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

interface ClassRef {
  id: string;
  name: string;
}

interface AnalyticsSummary {
  total_students?: number;
  avg_hp?: number;
  danger_zone_count?: number;
  avg_gold?: number;
  avg_level?: number;
  total_gold_earned?: number;
  total_gold_spent?: number;
  total_hp_lost?: number;
  total_hp_restored?: number;
  quests_completed?: number;
}

interface DailyDataRaw {
  day: string;
  dau?: number;
  gold_earned?: number;
  gold_spent?: number;
  shop_purchases?: number;
  hp_lost?: number;
  hp_restored?: number;
  teacher_rewards?: number;
  teacher_penalties?: number;
  boss_hits?: number;
  boss_kills?: number;
  xp_earned?: number;
  quests_done?: number;
  artifacts_dropped?: number;
}

interface DailyData extends DailyDataRaw {
  label: string;
}

interface HeroUserInfo {
  display_name?: string | null;
  class_id?: string | null;
  classes?: { school_id?: string | null; name?: string | null } | null;
}

interface CriticalHero {
  id: string;
  hp: number;
  hp_max: number;
  gold: number;
  level: number;
  xp: number;
  streak_current: number | null;
  users?: HeroUserInfo | null;
}

interface HpBucket {
  name: string;
  min: number;
  max: number;
  count: number;
}

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: '0.5rem' }}>
          <span style={{ opacity: 0.7 }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{fmt(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { schools } = useAdminData();
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState<number>(30);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [criticalStudents, setCriticalStudents] = useState<CriticalHero[]>([]);
  const [hpDistribution, setHpDistribution] = useState<HpBucket[]>([]);
  const [loading, setLoading] = useState(true);

  // Load classes when school changes. Every state update runs inside the
  // async IIFE so react-hooks/set-state-in-effect stays quiet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (schoolFilter === 'all') {
        if (cancelled) return;
        setClasses([]);
        setClassFilter('all');
        return;
      }
      const { data } = await supabase.from('classes').select('id, name').eq('school_id', schoolFilter);
      if (cancelled) return;
      if (data) setClasses(data);
      setClassFilter('all');
    })();
    return () => { cancelled = true; };
  }, [schoolFilter]);

  // Load analytics data when filters change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const pSchoolId = schoolFilter === 'all' ? null : schoolFilter;
      const pClassId = classFilter === 'all' ? null : classFilter;

      const [summaryRes, dailyRes] = await Promise.all([
        supabase.rpc('get_admin_analytics', { p_school_id: pSchoolId, p_class_id: pClassId, p_days: daysFilter }),
        supabase.rpc('get_analytics_daily', { p_school_id: pSchoolId, p_class_id: pClassId, p_days: daysFilter }),
      ]);
      if (cancelled) return;

      setSummary((summaryRes.data as AnalyticsSummary | null) || {});

      // Format daily data for recharts (short date labels)
      const rawDaily = (dailyRes.data || []) as DailyDataRaw[];
      setDaily(rawDaily.map((d) => ({
        ...d,
        label: new Date(d.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      })));

      // Load hero HP distribution + critical students
      let heroQuery = supabase.from('heroes').select(`
        id, hp, hp_max, gold, level, xp, streak_current,
        users!inner ( display_name, class_id, classes!inner (school_id, name) )
      `);
      if (pClassId) heroQuery = heroQuery.eq('users.class_id', pClassId);
      if (pSchoolId) heroQuery = heroQuery.eq('users.classes.school_id', pSchoolId);

      const { data: allHeroes } = await heroQuery.order('hp', { ascending: true });
      if (cancelled) return;
      const heroes = (allHeroes as unknown as CriticalHero[] | null) || [];

      // Critical students (bottom 10 by HP)
      setCriticalStudents(heroes.slice(0, 10));

      // HP distribution buckets
      const buckets: HpBucket[] = [
        { name: 'Мёртвые (0)', min: 0, max: 0, count: 0 },
        { name: 'Критично (1–30)', min: 1, max: 30, count: 0 },
        { name: 'Плохо (31–60)', min: 31, max: 60, count: 0 },
        { name: 'Норма (61–120)', min: 61, max: 120, count: 0 },
        { name: 'Здоров (121–150)', min: 121, max: 150, count: 0 },
      ];
      heroes.forEach((h) => {
        const b = buckets.find(b => h.hp >= b.min && h.hp <= b.max);
        if (b) b.count++;
      });
      setHpDistribution(buckets.filter(b => b.count > 0));

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [schoolFilter, classFilter, daysFilter]);

  const s = summary || {};
  const totalStudents = s.total_students || 1;
  const dangerPct = Math.round(((s.danger_zone_count || 0) / totalStudents) * 100);

  return (
    <div className={styles.page}>
      {/* ── Header + Filters ── */}
      <div className={styles.headerRow}>
        <h1 className="text-display">📈 Глубокая Аналитика</h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select className={styles.select} value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
            <option value="all">🏫 Все школы</option>
            {schools.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
          <select className={styles.select} value={classFilter} onChange={e => setClassFilter(e.target.value)} disabled={schoolFilter === 'all'}>
            <option value="all">📚 Все классы</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={styles.select} value={daysFilter} onChange={e => setDaysFilter(Number(e.target.value))}>
            <option value={1}>Сегодня</option>
            <option value={3}>3 дня</option>
            <option value={7}>Неделя</option>
            <option value={14}>2 недели</option>
            <option value={30}>Месяц</option>
            <option value={90}>Квартал</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '6rem', textAlign: 'center', opacity: 0.4 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          Собираем аналитику...
        </div>
      ) : (
        <>
          {/* ═══════ SECTION 1: KPI cards ═══════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
            <MetricCard metricKey="avg_hp" value={`${s.avg_hp ?? 0} / 150`} sub={`${totalStudents} учеников`} />
            <MetricCard metricKey="danger_zone" value={`${s.danger_zone_count ?? 0} чел.`} sub={`${dangerPct}% от класса`} />
            <MetricCard metricKey="avg_gold" value={fmt(s.avg_gold ?? 0)} sub="в среднем на руках" />
            <MetricCard metricKey="avg_level" value={s.avg_level ?? 0} sub="средний уровень героев" />
          </div>

          {/* ═══════ SECTION 2: DAU chart ═══════ */}
          <ChartSection
            title="📱 Ежедневная активность (DAU)"
            description="Сколько уникальных учеников совершили хотя бы одно действие за день. Падение DAU = падение интереса к системе."
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="dau" name="Активных" stroke="#3b82f6" fill="url(#dauGrad)" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>

          {/* ═══════ SECTION 3: Gold economy ═══════ */}
          <ChartSection
            title="⚖️ Экономика золота (Добыто vs Потрачено)"
            description="Зелёное — заработанное золото (квесты, оценки). Красное — потраченное (магазин, зелья). Здоровая экономика: тратится 40–70% от заработанного."
          >
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gold_earned" name="💰 Добыто" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="gold_spent" name="💸 Потрачено" fill="#ef4444" radius={[4,4,0,0]} />
                <Line type="monotone" dataKey="shop_purchases" name="🛒 Покупки" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '2rem', padding: '1rem 0 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Всего добыто</div>
                <div style={{ fontWeight: 800, color: '#22c55e', fontSize: '1.2rem' }}>+{fmt(s.total_gold_earned ?? 0)} Gold</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Всего потрачено</div>
                <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '1.2rem' }}>-{fmt(s.total_gold_spent ?? 0)} Gold</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Конверсия</div>
                <div style={{ fontWeight: 800, color: '#eab308', fontSize: '1.2rem' }}>
                  {s.total_gold_earned ? Math.round(((s.total_gold_spent ?? 0) / s.total_gold_earned) * 100) : 0}%
                </div>
              </div>
            </div>
          </ChartSection>

          {/* ═══════ SECTION 4: HP Balance ═══════ */}
          <ChartSection
            title="🩺 Баланс HP (Урон vs Лечение)"
            description="Показывает, успевают ли ученики восстанавливать здоровье. Если красная зона всегда выше зелёной — нужно снизить урон (dmg_multiplier) или удешевить зелья."
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="hp_lost" name="💔 Урон" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="hp_restored" name="💚 Восстановлено" fill="#22c55e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '2rem', padding: '1rem 0 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Всего урона</div>
                <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '1.2rem' }}>-{fmt(s.total_hp_lost ?? 0)} HP</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Всего восстановлено</div>
                <div style={{ fontWeight: 800, color: '#22c55e', fontSize: '1.2rem' }}>+{fmt(s.total_hp_restored ?? 0)} HP</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Баланс</div>
                <div style={{ fontWeight: 800, color: (s.total_hp_lost || 0) > (s.total_hp_restored || 0) ? '#ef4444' : '#22c55e', fontSize: '1.2rem' }}>
                  {(s.total_hp_lost || 0) > (s.total_hp_restored || 0) ? '⚠️ Дефицит' : '✅ Норма'}
                </div>
              </div>
            </div>
          </ChartSection>

          {/* ═══════ SECTION 4b: Teacher & Boss Activity ═══════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <ChartSection
              title="👩‍🏫 Активность учителя"
              description="Зелёное — награды учителя (XP/Gold гранты). Красное — штрафные санкции. Баланс показывает стиль преподавания."
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="teacher_rewards" name="🎁 Награды" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="teacher_penalties" name="⚡ Штрафы" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>

            <ChartSection
              title="🐉 Боссы"
              description="Удары по боссам и победы. Показывает, насколько популярен PvE-контент у класса."
            >
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="boss_hits" name="⚔️ Ударов" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Line type="monotone" dataKey="boss_kills" name="💀 Побед" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartSection>
          </div>


          {/* ═══════ SECTION 5: Two columns — XP + HP Distribution ═══════ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

            {/* XP Earned per day */}
            <ChartSection
              title="⭐ Заработано XP по дням"
              description="Ежедневный приток опыта. Показывает реальную учебную активность."
            >
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="xp_earned" name="XP" stroke="#8b5cf6" fill="url(#xpGrad)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartSection>

            {/* HP Distribution Pie */}
            <ChartSection
              title="🫀 Распределение HP героев"
              description="Пирог здоровья: сколько учеников в каждой зоне. Зелёная = здоровые, красная = на грани."
            >
              {hpDistribution.length === 0 ? (
                <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Нет данных</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={hpDistribution}
                      dataKey="count"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={80}
                      label={(props: { name?: string; count?: number }) => `${props.name ?? ''}: ${props.count ?? 0}`}
                      labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    >
                      {hpDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartSection>
          </div>

          {/* ═══════ SECTION 6: Quests volume ═══════ */}
          <ChartSection
            title="⚔️ Объём активности по дням"
            description="Количество выполненных квестов и выпавших артефактов. Рост = ученики активно пользуются системой."
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="quests_done" name="📋 Квестов" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="artifacts_dropped" name="💎 Артефактов" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ padding: '0.75rem 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', opacity: 0.5 }}>
              Всего за период: {fmt(s.quests_completed ?? 0)} квестов выполнено
            </div>
          </ChartSection>

          {/* ═══════ SECTION 7: Critical Students ═══════ */}
          <div style={{
            background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-2xl)',
            padding: '1.5rem',
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>🚑 Критические ученики</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.45, marginTop: '0.2rem' }}>
                Ученики с минимальным HP. Им нужна помощь: бонусный квест, подарок артефакта или учительская награда.
              </div>
            </div>
            <div className={styles.tableWrap}>
              <div className={styles.tHeader} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                <span>Ученик</span><span>Класс</span><span>HP</span><span>Gold</span><span>Уровень</span><span>Стрик</span>
              </div>
              {criticalStudents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет данных по выбранным фильтрам.</div>
              ) : criticalStudents.map((h) => {
                const hpPct = Math.round((h.hp / Math.max(h.hp_max, 1)) * 100);
                const hpColor = hpPct < 20 ? '#ef4444' : hpPct < 50 ? '#f59e0b' : '#22c55e';
                return (
                  <div key={h.id} className={styles.tRow} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                    <span style={{ fontWeight: 700 }}>{h.users?.display_name || '?'}</span>
                    <span style={{ opacity: 0.6 }}>{h.users?.classes?.name || '—'}</span>
                    <span>
                      <span style={{ color: hpColor, fontWeight: 800 }}>{h.hp}</span>
                      <span style={{ opacity: 0.4 }}>/{h.hp_max}</span>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginTop: 3 }}>
                        <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor, borderRadius: 99 }} />
                      </div>
                    </span>
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{fmt(h.gold)}</span>
                    <span style={{ fontWeight: 600 }}>lvl {h.level}</span>
                    <span>🔥 {h.streak_current || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
