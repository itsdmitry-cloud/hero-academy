'use client';

import Image from 'next/image';
import styles from './Slide5RoyalSet.module.css';

const ROYAL_ITEMS = [
  { name: 'Мантия\nПрогульщика', img: '/assets/artifacts/roy_mantle.png' },
  { name: 'Скипетр\nОтгула', img: '/assets/artifacts/roy_scepter.png' },
  { name: 'Держава\nЛени', img: '/assets/artifacts/roy_orb.png' },
  { name: 'Корона Свободы', img: '/assets/artifacts/roy_crown.png' },
  { name: 'Печать Директора', img: '/assets/artifacts/roy_seal.png' },
] as const;

const PARTICLE_COUNT = 8;

export default function Slide5RoyalSet() {
  return (
    <div className={styles.slide}>
      {/* Gold particles */}
      <div className={styles.particles}>
        {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
          <div key={i} className={styles.particle} />
        ))}
      </div>

      {/* Badge */}
      <div className={styles.badge}>СЕКРЕТНЫЙ НАБОР</div>

      {/* Title */}
      <h2 className={styles.title}>Королевский Набор</h2>
      <p className={styles.subtitle}>
        Собери все 5 предметов и получи суперприз
      </p>

      {/* Royal items grid: 3 top + 2 bottom centered */}
      <div className={styles.royalGrid}>
        {ROYAL_ITEMS.map((item) => (
          <div key={item.img} className={styles.royalCard}>
            <div className={styles.royalImgWrap}>
              <Image src={item.img} alt={item.name.replace('\n', ' ')} width={48} height={48} />
            </div>
            <span className={styles.royalName}>{item.name}</span>
          </div>
        ))}
      </div>

      {/* Reward banner */}
      <div className={styles.rewardBanner}>
        <span className={styles.rewardIcon}>🏆</span>
        <span className={styles.rewardTitle}>Официальный выходной!</span>
        <span className={styles.rewardDesc}>
          Собери все 5 предметов Королевского Набора — и ты можешь официально
          пропустить один учебный день
        </span>
        <div className={styles.tags}>
          <span className={styles.tagGold}>0.1% шанс</span>
          <span className={styles.tagPurple}>Только из сундуков</span>
        </div>
      </div>
    </div>
  );
}
