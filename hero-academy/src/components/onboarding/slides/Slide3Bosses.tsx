'use client';

import styles from './Slide3Bosses.module.css';

export default function Slide3Bosses() {
  return (
    <div className={styles.slide}>
      <div className={styles.icon}>🐉</div>

      <h1 className={styles.title}>
        Побеждай боссов<br />всем классом
      </h1>
      <p className={styles.subtitle}>
        У каждого предмета свой босс на четверть
      </p>

      {/* Boss card */}
      <div className={styles.bossCard}>
        <div className={styles.bossHeader}>
          <div className={styles.bossIcon}>🐉</div>
          <div className={styles.bossInfo}>
            <div className={styles.bossName}>Дракон Алгебры</div>
            <div className={styles.bossDetail}>
              Математика · 1 четверть
            </div>
          </div>
        </div>

        {/* HP bar */}
        <div className={styles.hpSection}>
          <div className={styles.hpLabel}>
            <span className={styles.hpText}>HP</span>
            <span className={styles.hpValue}>8 400 / 12 500</span>
          </div>
          <div className={styles.hpBarTrack}>
            <div className={styles.hpBarFill} />
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.statValueOrange}`}>
              4 100
            </div>
            <div className={styles.statLabel}>Урон класса</div>
          </div>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.statValueGreen}`}>
              25
            </div>
            <div className={styles.statLabel}>Учеников бьют</div>
          </div>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.statValuePurple}`}>
              164
            </div>
            <div className={styles.statLabel}>Твой урон</div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <p className={styles.explanation}>
        Каждая оценка наносит урон боссу. Чем выше оценка — тем больше урон.
        Победите босса вместе до конца четверти!
      </p>
    </div>
  );
}
