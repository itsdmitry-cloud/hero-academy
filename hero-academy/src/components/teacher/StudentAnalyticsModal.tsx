'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import type { StudentRow } from '@/lib/hooks/use-teacher-data';
import styles from './StudentAnalyticsModal.module.css';

/* ─── Types ────────────────────────────── */
interface Attempt {
  id: string;
  completed_at: string;
  grade: number | null;
  xp_earned: number;
  hp_lost: number;
  correct_count: number;
  mistake_count: number;
  status: string;
  quests: {
    title: string;
    type: string;
    subject: string;
    difficulty: string;
  } | null;
}

/* ─── Constants ────────────────────────── */
const TYPE_LABEL: Record<string, string> = {
  quest: 'ДЗ',
  dungeon: 'Самост.',
  boss: 'Контр.',
};
const TYPE_COLOR: Record<string, string> = {
  quest: '#ff9f43',
  dungeon: '#a855f7',
  boss: '#ee5a6f',
};
const GRADE_COLOR = (g: number) =>
  g >= 5 ? '#2ed573' : g >= 4 ? '#ff9f43' : g >= 3 ? '#ffa502' : '#ee5a6f';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
function fmtWeek(iso: string) {
  const d = new Date(iso);
  const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1);
  return mon.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/* ─── Custom Tooltip ───────────────────── */
function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{String(label)}</div>
      {(payload as Array<{name: string; value: number; color: string}>).map((p) => (
        <div key={p.name} className={styles.tooltipRow} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ───────────────────── */
interface Props {
  student: StudentRow | null;
  onClose: () => void;
}

export function StudentAnalyticsModal({ student, onClose }: Props) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!student?.hero_id) return;
    setLoading(true);
    const sb = createClient();
    sb.from('quest_attempts')
      .select(`
        id, completed_at, grade, xp_earned, hp_lost,
        correct_count, mistake_count, status,
        quests!inner(title, type, subject, difficulty)
      `)
      .eq('hero_id', student.hero_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })
      .limit(60)
      .then(({ data }) => {
        setAttempts((data ?? []) as unknown as Attempt[]);
        setLoading(false);
      });
  }, [student?.hero_id]);

  /* ── Derived data ───────────────────── */
  const stats = useMemo(() => {
    const graded = attempts.filter(a => a.grade !== null && a.grade > 0);
    const avgGrade = graded.length
      ? +(graded.reduce((s, a) => s + (a.grade ?? 0), 0) / graded.length).toFixed(2)
      : 0;
    const totalXp = attempts.reduce((s, a) => s + a.xp_earned, 0);
    const totalHpLost = attempts.reduce((s, a) => s + a.hp_lost, 0);
    const totalCorrect = attempts.reduce((s, a) => s + a.correct_count, 0);
    const totalMistakes = attempts.reduce((s, a) => s + a.mistake_count, 0);
    const accuracy = (totalCorrect + totalMistakes) > 0
      ? Math.round((totalCorrect / (totalCorrect + totalMistakes)) * 100)
      : null;
    return { avgGrade, totalXp, totalHpLost, totalCorrect, totalMistakes, accuracy, count: attempts.length, graded: graded.length };
  }, [attempts]);

  /* Grade trend — last 20 attempts */
  const gradeTrend = useMemo(() =>
    attempts
      .filter(a => a.grade !== null && a.grade > 0)
      .slice(-20)
      .map(a => ({
        date: fmtDate(a.completed_at),
        grade: a.grade,
        type: TYPE_LABEL[a.quests?.type ?? ''] ?? a.quests?.type,
        title: a.quests?.title,
        color: TYPE_COLOR[a.quests?.type ?? ''] ?? '#ccc',
      })),
  [attempts]);

  /* Avg grade by quest type */
  const byType = useMemo(() => {
    const map: Record<string, { sum: number, count: number, hp: number, xp: number }> = {};
    attempts.forEach(a => {
      const t = a.quests?.type ?? 'unknown';
      if (!map[t]) map[t] = { sum: 0, count: 0, hp: 0, xp: 0 };
      if (a.grade && a.grade > 0) { map[t].sum += a.grade; map[t].count++; }
      map[t].hp += a.hp_lost;
      map[t].xp += a.xp_earned;
    });
    return Object.entries(map).map(([type, v]) => ({
      type: TYPE_LABEL[type] ?? type,
      color: TYPE_COLOR[type] ?? '#888',
      avgGrade: v.count ? +(v.sum / v.count).toFixed(1) : 0,
      count: v.count,
      hp: v.hp,
      xp: v.xp,
    }));
  }, [attempts]);

  /* XP by week */
  const xpByWeek = useMemo(() => {
    const map: Record<string, { xp: number, quests: number }> = {};
    attempts.forEach(a => {
      const w = fmtWeek(a.completed_at);
      if (!map[w]) map[w] = { xp: 0, quests: 0 };
      map[w].xp += a.xp_earned;
      map[w].quests++;
    });
    return Object.entries(map).slice(-8).map(([week, v]) => ({ week, ...v }));
  }, [attempts]);

  /* Score distribution 1-5 */
  const scoreDist = useMemo(() => {
    const dist = [1, 2, 3, 4, 5].map(g => ({
      grade: `${g}`,
      count: attempts.filter(a => a.grade === g).length,
    }));
    return dist;
  }, [attempts]);

  const isOpen = !!student;
  if (!student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full"
      title={`📊 Аналитика — ${student.display_name}`}>
      {loading ? (
        <div className={styles.loading}>⏳ Загрузка данных...</div>
      ) : attempts.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: '3rem' }}>📭</div>
          <p>Нет выполненных заданий</p>
        </div>
      ) : (
        <div className={styles.content}>

          {/* ── KPI Row ──────────────────────── */}
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <span className={styles.kpiVal} style={{ color: GRADE_COLOR(stats.avgGrade) }}>
                {stats.avgGrade > 0 ? stats.avgGrade : '—'}
              </span>
              <span className={styles.kpiLbl}>Ср. оценка</span>
            </div>
            <div className={styles.kpiDiv} />
            <div className={styles.kpi}>
              <span className={styles.kpiVal}>{stats.count}</span>
              <span className={styles.kpiLbl}>Заданий</span>
            </div>
            <div className={styles.kpiDiv} />
            <div className={styles.kpi}>
              <span className={styles.kpiVal} style={{ color: 'var(--accent-xp)' }}>
                +{stats.totalXp.toLocaleString('ru-RU')}
              </span>
              <span className={styles.kpiLbl}>XP заработано</span>
            </div>
            <div className={styles.kpiDiv} />
            <div className={styles.kpi}>
              <span className={styles.kpiVal} style={{ color: 'var(--accent-hp)' }}>
                -{stats.totalHpLost}
              </span>
              <span className={styles.kpiLbl}>HP потеряно</span>
            </div>
            <div className={styles.kpiDiv} />
            <div className={styles.kpi}>
              <span className={styles.kpiVal} style={{ color: stats.accuracy && stats.accuracy >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                {stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
              </span>
              <span className={styles.kpiLbl}>Точность</span>
            </div>
          </div>

          <div className={styles.chartsGrid}>

            {/* ── 1. Grade Trend ────────────── */}
            <div className={`${styles.chartCard} ${styles.wide}`}>
              <div className={styles.chartTitle}>📈 Тренд оценок</div>
              <div className={styles.chartSub}>Последние {gradeTrend.length} выполненных заданий</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={gradeTrend} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#6b6b8d', fontSize: 11 }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#6b6b8d', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip active={undefined} payload={undefined} label={undefined} />} />
                  <Line
                    type="monotone" dataKey="grade" name="Оценка"
                    stroke="#a855f7" strokeWidth={2.5} dot={(props) => {
                      const { cx, cy, payload } = props;
                      return <circle key={payload.date} cx={cx} cy={cy} r={5} fill={payload.color} stroke="#1a0e35" strokeWidth={1.5} />;
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className={styles.legend}>
                {Object.entries(TYPE_COLOR).map(([k, c]) => (
                  <span key={k} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: c }} />
                    {TYPE_LABEL[k]}
                  </span>
                ))}
              </div>
            </div>

            {/* ── 2. Avg Grade by Type ─────── */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>🏆 Оценка по типу</div>
              <div className={styles.chartSub}>Средний балл</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byType} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="type" tick={{ fill: '#6b6b8d', fontSize: 12 }} />
                  <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fill: '#6b6b8d', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip active={undefined} payload={undefined} label={undefined} />} />
                  <Bar dataKey="avgGrade" name="Ср. оценка" radius={[6, 6, 0, 0]}>
                    {byType.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── 3. Score Distribution ────── */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>📊 Распределение оценок</div>
              <div className={styles.chartSub}>Количество по баллам 1–5</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreDist} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="grade" tick={{ fill: '#6b6b8d', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#6b6b8d', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip active={undefined} payload={undefined} label={undefined} />} />
                  <Bar dataKey="count" name="Кол-во" radius={[6, 6, 0, 0]}>
                    {scoreDist.map((entry, i) => (
                      <Cell key={i} fill={GRADE_COLOR(+entry.grade)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── 4. XP by Week ────────────── */}
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>⚡ XP по неделям</div>
              <div className={styles.chartSub}>Заработанный опыт</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={xpByWeek} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={{ fill: '#6b6b8d', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b6b8d', fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip active={undefined} payload={undefined} label={undefined} />} />
                  <Bar dataKey="xp" name="XP" fill="#ff9f43" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── 5. Type breakdown table ──── */}
            <div className={`${styles.chartCard} ${styles.wide}`}>
              <div className={styles.chartTitle}>📋 Детали по типу заданий</div>
              <table className={styles.breakTable}>
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Заданий</th>
                    <th>Ср. оценка</th>
                    <th>XP заработано</th>
                    <th>HP потеряно</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map(row => (
                    <tr key={row.type}>
                      <td>
                        <span className={styles.typeChip} style={{ background: row.color + '25', color: row.color, borderColor: row.color + '50' }}>
                          {row.type}
                        </span>
                      </td>
                      <td>{row.count}</td>
                      <td style={{ color: GRADE_COLOR(row.avgGrade), fontWeight: 700 }}>
                        {row.avgGrade > 0 ? row.avgGrade : '—'}
                      </td>
                      <td style={{ color: 'var(--accent-xp)' }}>+{row.xp.toLocaleString('ru-RU')}</td>
                      <td style={{ color: 'var(--accent-hp)' }}>-{row.hp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </Modal>
  );
}
