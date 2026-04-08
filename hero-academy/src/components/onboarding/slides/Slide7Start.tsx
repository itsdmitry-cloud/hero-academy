'use client';

import styles from './Slide7Start.module.css';

export default function Slide7Start() {
  return (
    <div className={styles.slide}>
      {/* Background particles */}
      <div className={`${styles.particle} ${styles.particle1}`} />
      <div className={`${styles.particle} ${styles.particle2}`} />
      <div className={`${styles.particle} ${styles.particle3}`} />
      <div className={`${styles.particle} ${styles.particle4}`} />
      <div className={`${styles.particle} ${styles.particle5}`} />
      <div className={`${styles.particle} ${styles.particle6}`} />

      {/* Sword icon with glow */}
      <div className={styles.swordWrap}>
        <div className={styles.swordGlow} />
        <span className={styles.swordIcon} role="img" aria-label="swords">
          ⚔️
        </span>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <h2 className={styles.title}>
          Твоё приключение
          <br />
          начинается!
        </h2>
        <p className={styles.subtitle}>
          Выполняй квесты, побеждай боссов, собирай артефакты и стань легендой
          своего класса
        </p>

        {/* Summary pills */}
        <div className={styles.pills}>
          <div className={`${styles.pill} ${styles.pillOrange}`}>
            <span className={styles.pillIcon}>📜</span>
            Квесты дают XP и золото
          </div>
          <div className={`${styles.pill} ${styles.pillRed}`}>
            <span className={styles.pillIcon}>🐉</span>
            Боссы падут перед классом
          </div>
          <div className={`${styles.pill} ${styles.pillPurple}`}>
            <span className={styles.pillIcon}>👑</span>
            Артефакты усилят героя
          </div>
        </div>
      </div>
    </div>
  );
}
