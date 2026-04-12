'use client';

import { useState } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { useParentData } from '@/lib/hooks/use-parent-data';
import styles from './page.module.css';

const mockChild = {
  name: 'Артём Иванов', class: '5-Б', school: 'Школа №42',
  lastSeen: 'Сегодня, 18:42',
  avgGrade: 4.2, avgGradePrev: 3.9,
  homeworkDone: 42, homeworkTotal: 48,
  testsCount: 6, testsAvg: 4.0,
  classworkDone: 38, classworkTotal: 40,
  attendance: 96,
  streak: 14,
};

const mockSubjects = [
  {
    name: 'Математика', icon: '📐', avgGrade: 4.5, prevAvg: 4.2,
    grades: [
      { date: '13 мар', type: 'ДЗ', topic: 'Дроби и проценты', grade: 5, comment: '' },
      { date: '11 мар', type: 'Контр.', topic: 'Контрольная: Уравнения', grade: 4, comment: '2 ошибки в задачах' },
      { date: '8 мар', type: 'ДЗ', topic: 'Площадь фигур', grade: 5, comment: '' },
      { date: '5 мар', type: 'Работа на уроке', topic: 'Решение примеров', grade: 4, comment: '' },
      { date: '1 мар', type: 'ДЗ', topic: 'Периметр', grade: 5, comment: '' },
    ],
    weeklyAvg: [4.0, 4.2, 4.5, 4.3, 4.8, 4.5],
  },
  {
    name: 'Русский язык', icon: '📝', avgGrade: 4.3, prevAvg: 4.1,
    grades: [
      { date: '12 мар', type: 'ДЗ', topic: 'Спряжение глаголов', grade: 5, comment: '' },
      { date: '10 мар', type: 'Контр.', topic: 'Диктант', grade: 4, comment: '3 ошибки' },
      { date: '7 мар', type: 'ДЗ', topic: 'Причастия', grade: 4, comment: '' },
      { date: '4 мар', type: 'Работа на уроке', topic: 'Синтаксический разбор', grade: 5, comment: '' },
    ],
    weeklyAvg: [3.8, 4.0, 4.2, 4.1, 4.5, 4.3],
  },
  {
    name: 'Английский', icon: '🇬🇧', avgGrade: 3.8, prevAvg: 3.5,
    grades: [
      { date: '12 мар', type: 'ДЗ', topic: 'Past Perfect', grade: 4, comment: '' },
      { date: '9 мар', type: 'Контр.', topic: 'Тест: Времена', grade: 3, comment: '5 ошибок из 20' },
      { date: '6 мар', type: 'ДЗ', topic: 'Conditional II', grade: 4, comment: '' },
    ],
    weeklyAvg: [3.2, 3.4, 3.5, 3.8, 3.6, 3.8],
  },
  {
    name: 'Физика', icon: '⚡', avgGrade: 3.5, prevAvg: 3.8,
    grades: [
      { date: '11 мар', type: 'Контр.', topic: 'Контрольная: Законы Ньютона', grade: 3, comment: '2 ошибки в задачах, 1 в формулах' },
      { date: '7 мар', type: 'ДЗ', topic: 'Сила тяжести', grade: 4, comment: '' },
      { date: '3 мар', type: 'Работа на уроке', topic: 'Лабораторная: Измерение силы', grade: 3, comment: 'Неточный результат' },
    ],
    weeklyAvg: [4.0, 3.8, 3.5, 3.2, 3.5, 3.5],
  },
  {
    name: 'История', icon: '📜', avgGrade: 4.8, prevAvg: 4.6,
    grades: [
      { date: '10 мар', type: 'ДЗ', topic: 'Древний Рим', grade: 5, comment: '' },
      { date: '6 мар', type: 'Работа на уроке', topic: 'Доклад: Юлий Цезарь', grade: 5, comment: 'Отличный доклад!' },
      { date: '2 мар', type: 'ДЗ', topic: 'Греческие полисы', grade: 5, comment: '' },
    ],
    weeklyAvg: [4.5, 4.6, 4.8, 4.7, 5.0, 4.8],
  },
];

const mockRecentAll = mockSubjects
  .flatMap(s => s.grades.map(g => ({ ...g, subject: s.name, subjectIcon: s.icon })))
  .sort((a, b) => {
    const months: Record<string, number> = { 'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'июн': 5, 'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11 };
    const parse = (d: string) => { const [day, mon] = d.split(' '); return new Date(2026, months[mon] || 0, parseInt(day)).getTime(); };
    return parse(b.date) - parse(a.date);
  });

const gradeColor = (g: number) => g >= 5 ? 'var(--accent-xp)' : g >= 4 ? 'var(--accent-gold)' : g >= 3 ? 'var(--accent-streak)' : 'var(--accent-hp)';

export default function ParentOverview() {
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const { activeChild, quests, isLive } = useParentData();

  // Use live data if authenticated, otherwise fallback to mock
  const child = (isLive && activeChild) ? {
    name: activeChild.display_name,
    class: activeChild.class_name,
    school: activeChild.school_name,
    lastSeen: 'Только что',
    avgGrade: mockChild.avgGrade,
    avgGradePrev: mockChild.avgGradePrev,
    homeworkDone: quests.filter(q => q.attempt_status === 'completed').length,
    homeworkTotal: quests.length || mockChild.homeworkTotal,
    testsCount: mockChild.testsCount,
    testsAvg: mockChild.testsAvg,
    classworkDone: mockChild.classworkDone,
    classworkTotal: mockChild.classworkTotal,
    attendance: mockChild.attendance,
    streak: activeChild.streak,
  } : mockChild;

  const filteredGrades = gradeFilter === 'all'
    ? mockRecentAll
    : mockRecentAll.filter(g => g.type === gradeFilter);


  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-display">📒 Дневник</h1>
          <p className={styles.subtitle}>{child.name} · {child.class} · {child.school}</p>
        </div>
        <div className={styles.lastSeen}>Последний вход: {child.lastSeen}</div>
      </div>

      {/* Hero Stats */}
      {isLive && activeChild && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <StatCard icon="⭐" label="Уровень" value={activeChild.level} color="xp" />
          <StatCard icon="❤️" label="HP" value={`${activeChild.hp}/${activeChild.hp_max}`} color="hp" />
          <StatCard icon="🔥" label="Стрик" value={activeChild.streak} color="streak" />
          <StatCard icon="💰" label="Золото" value={activeChild.gold} color="gold" />
        </div>
      )}

      {/* Summary Stats */}
      <div className={styles.statsRow}>
        <StatCard icon="📚" label="ДЗ выполнено" value={`${child.homeworkDone}/${child.homeworkTotal}`} color="primary" />
        <StatCard icon="📝" label="Контрольных" value={child.testsCount} color="info" />
        <StatCard icon="⭐" label="Средний балл" value={child.avgGrade.toFixed(1)} color="xp" />
        <StatCard icon="🔥" label="Стрик" value={`${child.streak} дней`} color="streak" />
        <StatCard icon="✅" label="Посещаемость" value={`${child.attendance}%`} color="primary" />
      </div>

      {/* Live Quests Section */}
      {isLive && quests.length > 0 && (
        <div style={{ marginBottom: '1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-xl)', padding: '1rem', border: '1px solid var(--bg-glass-border)' }}>
          <h2 className="text-display" style={{ marginBottom: '0.75rem' }}>Активные квесты</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {quests.map(q => (
              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', borderLeft: `4px solid ${q.attempt_status === 'completed' ? 'var(--accent-xp)' : q.attempt_status === 'submitted' ? 'var(--accent-gold)' : 'var(--bg-glass-border)'}` }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{q.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{q.subject} · +{q.xp_reward} XP</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: q.attempt_status === 'completed' ? 'var(--accent-xp)' : 'var(--text-secondary)' }}>
                    {q.attempt_status === 'completed' ? '✅ Выполнен' : q.attempt_status === 'submitted' ? '⏳ На проверке' : '⚔️ Активен'}
                  </div>
                  {q.deadline && <div style={{ color: 'var(--text-tertiary)' }}>до {new Date(q.deadline).toLocaleDateString('ru')}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject List */}
      <div className={styles.subjectsGrid}>
        {mockSubjects.map(subject => (
          <div
            key={subject.name}
            className={`${styles.subjectCard} ${activeSubject === subject.name ? styles.subjectActive : ''}`}
            onClick={() => setActiveSubject(activeSubject === subject.name ? null : subject.name)}
          >
            <div className={styles.subjectTop}>
              <span className={styles.subjectIcon}>{subject.icon}</span>
              <div className={styles.subjectInfo}>
                <span className={styles.subjectName}>{subject.name}</span>
                <div className={styles.subjectGrades}>
                  <span className={styles.avgGrade} style={{ color: gradeColor(subject.avgGrade) }}>{subject.avgGrade.toFixed(1)}</span>
                  <span className={styles.prevGrade} style={{ color: subject.avgGrade > subject.prevAvg ? 'var(--accent-xp)' : 'var(--accent-hp)' }}>
                    {subject.avgGrade > subject.prevAvg ? '↑' : '↓'} {subject.prevAvg.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Inline grade list when expanded */}
            {activeSubject === subject.name && (
              <div className={styles.gradeList}>
                {subject.grades.map((g, i) => (
                  <div key={i} className={styles.gradeRow}>
                    <span className={styles.gradeDate}>{g.date}</span>
                    <span className={styles.gradeType}>{g.type}</span>
                    <span className={styles.gradeTopic}>{g.topic}</span>
                    <span className={styles.gradeVal} style={{ color: gradeColor(g.grade), fontWeight: 800 }}>{g.grade}</span>
                    {g.comment && <span className={styles.gradeComment}>💬 {g.comment}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Grades Feed */}
      <div className={styles.feedSection}>
        <div className={styles.feedHeader}>
          <h2 className="text-display">Последние оценки</h2>
          <div className={styles.filterRow}>
            {['all', 'ДЗ', 'Контр.', 'Работа на уроке'].map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${gradeFilter === f ? styles.filterActive : ''}`}
                onClick={() => setGradeFilter(f)}
              >
                {f === 'all' ? 'Все' : f}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.gradesFeed}>
          {filteredGrades.map((g, i) => (
            <div key={i} className={styles.feedItem}>
              <span className={styles.feedSubjectIcon}>{g.subjectIcon}</span>
              <div className={styles.feedContent}>
                <span className={styles.feedSubject}>{g.subject}</span>
                <span className={styles.feedTopic}>{g.topic}</span>
                <span className={styles.feedDate}>{g.date} · {g.type}</span>
                {g.comment && <span className={styles.feedComment}>💬 {g.comment}</span>}
              </div>
              <span className={styles.feedGrade} style={{ color: gradeColor(g.grade) }}>{g.grade}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
