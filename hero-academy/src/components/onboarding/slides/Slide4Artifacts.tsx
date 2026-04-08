'use client';

import Image from 'next/image';
import styles from './Slide4Artifacts.module.css';

const ARTIFACTS = [
  {
    name: 'Перо Мудрости',
    img: '/assets/artifacts/rar_pen.png',
    rarity: 'rare' as const,
    rarityLabel: 'Редкий',
    rarityColor: 'blue' as const,
    effect: '+15% XP',
  },
  {
    name: 'Щит Стража',
    img: '/assets/artifacts/epi_shield.png',
    rarity: 'epic' as const,
    rarityLabel: 'Эпический',
    rarityColor: 'purple' as const,
    effect: '−25% урона',
  },
  {
    name: 'Корона Знаний',
    img: '/assets/artifacts/leg_crown.png',
    rarity: 'legendary' as const,
    rarityLabel: 'Легендарный',
    rarityColor: 'gold' as const,
    effect: '+30% XP',
  },
] as const;

const CHESTS = [
  { type: 'Обычный', img: '/assets/lootboxes/common.png', color: '#9ca3af' },
  { type: 'Редкий', img: '/assets/lootboxes/rare.png', color: '#3b82f6' },
  { type: 'Эпический', img: '/assets/lootboxes/epic.png', color: '#a855f7' },
  { type: 'Легендарный', img: '/assets/lootboxes/legendary.png', color: '#ffd700' },
] as const;

export default function Slide4Artifacts() {
  return (
    <div className={styles.slide}>
      <h2 className={styles.title}>Собирай артефакты</h2>
      <p className={styles.subtitle}>Выпадают из квестов и сундуков</p>

      {/* Artifact cards */}
      <div className={styles.artifactRow}>
        {ARTIFACTS.map((a) => (
          <div key={a.name} className={styles.artifactCard} data-rarity={a.rarity}>
            <div className={styles.artifactImgWrap}>
              <Image src={a.img} alt={a.name} width={52} height={52} />
            </div>
            <span className={styles.artifactName}>{a.name}</span>
            <span className={styles.rarityLabel} data-color={a.rarityColor}>
              {a.rarityLabel}
            </span>
            <span className={styles.effectLabel}>{a.effect}</span>
          </div>
        ))}
      </div>

      {/* Chests */}
      <div className={styles.chestsCard}>
        <div className={styles.chestsRow}>
          {CHESTS.map((c) => (
            <div key={c.type} className={styles.chestItem}>
              <div className={styles.chestImgWrap}>
                <Image src={c.img} alt={c.type} width={52} height={52} />
              </div>
              <span className={styles.chestLabel} style={{ color: c.color }}>
                {c.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className={styles.footerText}>
        Открывай сундуки → крути рулетку → получай артефакты!
      </p>
    </div>
  );
}
