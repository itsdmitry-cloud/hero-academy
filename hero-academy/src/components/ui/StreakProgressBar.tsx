'use client';

import React from 'react';
import styles from './StreakProgressBar.module.css';

interface StreakMilestone {
  day: number;
  emoji: string;
  xp: number;
  gold: number;
}

const MILESTONES: StreakMilestone[] = [
  { day: 3,  emoji: '🔥', xp: 150,  gold: 50 },
  { day: 6,  emoji: '💎', xp: 300,  gold: 150 },
  { day: 10, emoji: '🏆', xp: 600,  gold: 300 },
  { day: 14, emoji: '👑', xp: 1000, gold: 500 },
];

interface StreakProgressBarProps {
  currentStreak: number;
  bestStreak?: number;
}

export function StreakProgressBar({ currentStreak, bestStreak }: StreakProgressBarProps) {
  const maxDay = MILESTONES[MILESTONES.length - 1].day;
  const progressPct = Math.min((currentStreak / maxDay) * 100, 100);
  const nextMilestone = MILESTONES.find(m => m.day > currentStreak);
  const daysToNext = nextMilestone ? nextMilestone.day - currentStreak : 0;

  return (
    <div className={styles.streakSection}>

      <div className={styles.streakHeader}>
        <div className={styles.streakTitle}>
          <span className={styles.fireIcon}>🔥</span>
          Стрик урока
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={styles.streakCount}>{currentStreak}</div>
          <div className={styles.streakLabel}>
            {bestStreak ? `Рекорд: ${bestStreak}` : 'дней'}
          </div>
        </div>
      </div>

      {/* How to maintain — compact hint */}
      <div style={{
        fontSize: '0.74rem',
        color: 'var(--text-muted)',
        marginBottom: '8px',
        lineHeight: 1.5,
        padding: '6px 10px',
        background: 'rgba(251,146,60,0.06)',
        borderRadius: '8px',
        border: '1px solid rgba(251,146,60,0.15)',
      }}>
        {currentStreak === 0
          ? '💡 Получи XP от учителя на уроке — и стрик начнётся!'
          : nextMilestone
          ? `💡 Получай XP на каждом уроке. До награды: ${daysToNext} ${daysToNext === 1 ? 'уч. день' : 'уч. дня'}`
          : '🌟 Максимальный стрик! Ты прошёл весь альфа-тест на стриках!'
        }
        <span style={{ display: 'block', opacity: 0.7, marginTop: '2px' }}>Выходные не считаются — стрик сохраняется в пт→пн</span>
      </div>

      {/* Progress Track */}
      <div className={styles.trackContainer}>
        <div className={styles.track}>
          <div className={styles.trackFill} style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Milestones Row — simple emoji dots, no big images */}
      <div className={styles.milestones}>
        {MILESTONES.map((ms) => {
          const isReached = currentStreak >= ms.day;
          const isNext = nextMilestone?.day === ms.day;
          const statusClass = isReached ? styles.reached : isNext ? styles.next : styles.locked;

          return (
            <div key={ms.day} className={styles.milestone}>
              <div
                className={`${styles.milestoneIcon} ${statusClass}`}
                style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {ms.emoji}
              </div>
              <span className={styles.milestoneDay}>{ms.day} дн</span>
              <span className={styles.milestoneName} style={{ fontSize: '0.62rem' }}>
                +{ms.xp}XP +{ms.gold}G
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
