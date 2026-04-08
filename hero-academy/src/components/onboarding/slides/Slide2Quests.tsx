'use client';

import styles from './Slide2Quests.module.css';

export default function Slide2Quests() {
  return (
    <div className={styles.slide}>
      <div className={styles.icon}>📜</div>

      <h1 className={styles.title}>Домашка — это квест</h1>
      <p className={styles.subtitle}>
        Получай XP и золото за каждую оценку
      </p>

      {/* Quest card */}
      <div className={styles.questCard}>
        <div className={styles.questHeader}>
          <div className={styles.questIcon}>∑</div>
          <div className={styles.questInfo}>
            <div className={styles.questTitle}>
              Математика · §4.2 · Уравнения
            </div>
            <span className={styles.questTag}>Домашка</span>
          </div>
        </div>
        <div className={styles.questRewards}>
          <span className={styles.rewardXP}>+120 XP</span>
          <span className={styles.rewardDot} />
          <span className={styles.rewardGold}>+80 Gold</span>
        </div>
      </div>

      {/* Grade table */}
      <div className={styles.gradeCard}>
        <div className={styles.gradeHeader}>Как работают оценки</div>
        <div className={styles.gradeTable}>
          {/* Grade 5 */}
          <div className={styles.gradeRow}>
            <span className={styles.gradeName}>
              <span className={`${styles.gradeDot} ${styles.dotGreen}`} />
              5 — Отлично
            </span>
            <span className={styles.gradeReward}>
              <span className={styles.gradePercent}>100%</span>
            </span>
          </div>

          {/* Grade 4 */}
          <div className={styles.gradeRow}>
            <span className={styles.gradeName}>
              <span className={`${styles.gradeDot} ${styles.dotOrange}`} />
              4 — Хорошо
            </span>
            <span className={styles.gradeReward}>
              <span className={styles.gradePercent}>80%</span>
            </span>
          </div>

          {/* Grade 3 */}
          <div className={styles.gradeRow}>
            <span className={styles.gradeName}>
              <span className={`${styles.gradeDot} ${styles.dotGray}`} />
              3 — Тройка
            </span>
            <span className={styles.gradeReward}>
              <span className={styles.gradePercent}>50%</span>
              <span className={styles.gradeHP}>−10 HP</span>
            </span>
          </div>

          {/* Grade 2 */}
          <div className={styles.gradeRow}>
            <span className={styles.gradeName}>
              <span className={`${styles.gradeDot} ${styles.dotRed}`} />
              2 — Двойка
            </span>
            <span className={styles.gradeReward}>
              <span className={styles.gradePercent}>20%</span>
              <span className={styles.gradeHP}>−20 HP</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
