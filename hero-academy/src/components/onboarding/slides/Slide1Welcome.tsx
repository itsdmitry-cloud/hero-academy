'use client';

import styles from './Slide1Welcome.module.css';

export default function Slide1Welcome() {
  return (
    <div className={styles.slide}>
      {/* Background particles */}
      <div className={`${styles.particle} ${styles.particle1}`} />
      <div className={`${styles.particle} ${styles.particle2}`} />
      <div className={`${styles.particle} ${styles.particle3}`} />
      <div className={`${styles.particle} ${styles.particle4}`} />

      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoLetter}>H</span>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <h1 className={styles.title}>
          Добро пожаловать в Академию Героев!
        </h1>
        <p className={styles.subtitle}>
          Здесь учёба превращается в настоящее приключение
        </p>

        {/* Feature pills */}
        <div className={styles.pills}>
          <span className={`${styles.pill} ${styles.pillOrange}`}>
            📜 Квесты
          </span>
          <span className={`${styles.pill} ${styles.pillRed}`}>
            🐉 Боссы
          </span>
          <span className={`${styles.pill} ${styles.pillPurple}`}>
            💎 Артефакты
          </span>
          <span className={`${styles.pill} ${styles.pillGold}`}>
            🏆 Рейтинг
          </span>
        </div>
      </div>
    </div>
  );
}
