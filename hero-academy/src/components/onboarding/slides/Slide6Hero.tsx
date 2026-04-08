'use client';

import styles from './Slide6Hero.module.css';

export default function Slide6Hero() {
  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>Прокачивай героя</h2>
      <p className={styles.subtitle}>
        Уровень, здоровье, стрик — всё в твоих руках
      </p>

      {/* Hero card */}
      <div className={styles.heroCard}>
        {/* Header: avatar + name */}
        <div className={styles.heroHeader}>
          <div className={styles.avatar}>
            <span role="img" aria-label="shield">🛡️</span>
          </div>
          <div className={styles.heroInfo}>
            <span className={styles.heroName}>Демо Герой</span>
            <div className={styles.heroBadges}>
              <span className={styles.levelBadge}>Lv.12</span>
              <span className={styles.heroClass}>Воин</span>
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className={styles.barBlock}>
          <div className={styles.barLabel}>
            <span className={styles.barLabelLeft}>⚡ Опыт</span>
            <span className={styles.barLabelXp}>850 / 1200 XP</span>
          </div>
          <div className={`${styles.barTrack} ${styles.barTrackXp}`}>
            <div
              className={`${styles.barFill} ${styles.barFillXp}`}
              style={{ width: '71%' }}
            />
          </div>
        </div>

        {/* HP bar */}
        <div className={styles.barBlock}>
          <div className={styles.barLabel}>
            <span className={styles.barLabelLeft}>❤️ Здоровье</span>
            <span className={styles.barLabelHp}>78 / 100 HP</span>
          </div>
          <div className={`${styles.barTrack} ${styles.barTrackHp}`}>
            <div
              className={`${styles.barFill} ${styles.barFillHp}`}
              style={{ width: '78%' }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={`${styles.statValue} ${styles.statValueGold}`}>
              2 500
            </span>
            <span className={styles.statLabel}>Золото</span>
          </div>
          <div className={styles.statBox}>
            <span className={`${styles.statValue} ${styles.statValueStreak}`}>
              7 🔥
            </span>
            <span className={styles.statLabel}>Стрик</span>
          </div>
        </div>
      </div>

      {/* Streak explanation */}
      <div className={styles.streakBlock}>
        <span className={styles.streakTitle}>
          🔥 Стрик — серия дней без пропуска
        </span>
        <div className={styles.milestonesRow}>
          <span className={`${styles.milestonePill} ${styles.milestoneGray}`}>
            3д → 📦
          </span>
          <span className={`${styles.milestonePill} ${styles.milestoneBlue}`}>
            7д → 📦📦
          </span>
          <span className={`${styles.milestonePill} ${styles.milestonePurple}`}>
            14д → 📦📦📦
          </span>
          <span className={`${styles.milestonePill} ${styles.milestoneGold}`}>
            30д → 📦👑
          </span>
        </div>
      </div>

      {/* Equipment slots */}
      <div className={styles.equipBlock}>
        <p className={styles.equipText}>
          6 слотов экипировки — надевай артефакты на героя для постоянных
          бонусов. Новые слоты открываются на уровнях 10, 20, 30, 40, 50.
        </p>
      </div>
    </div>
  );
}
