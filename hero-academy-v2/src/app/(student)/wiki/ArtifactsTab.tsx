'use client';

import React from 'react';
import { ARTIFACT_CATALOG, Rarity } from '@/lib/utils/artifacts';
import { ARTIFACT_IMAGES } from '@/lib/utils/artifactImages';
import styles from './page.module.css';

const RARITY_INFO: Record<Rarity, { title: string, chance: string, source: string }> = {
  common: { title: 'Обычные', chance: '70% шанс дропа', source: 'Ежедневные квесты, Магазин' },
  rare: { title: 'Редкие', chance: '20% шанс дропа', source: 'Сложные квесты, Стрик 7 дней' },
  epic: { title: 'Эпические', chance: '9% шанс дропа', source: 'Рядовые Боссы, Стрик 14 дней' },
  legendary: { title: 'Легендарные', chance: '0.9% шанс дропа', source: 'Финальный Босс Четверти' },
  royal: { title: 'Королевский Сет', chance: '0.1% шанс дропа', source: 'Секретный дроп' },
};

function ArtifactIcon({ id }: { id: string }) {
  const imgSrc = ARTIFACT_IMAGES[id];
  if (imgSrc) {
    return <img src={imgSrc} alt="" style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />;
  }
  return <span style={{ fontSize: 32 }}>✨</span>;
}

function getEffectDescription(code: string) {
  const map: Record<string, string> = {
    'HEAL_30': 'Восстанавливает 30 HP',
    'HEAL_60': 'Восстанавливает 60 HP',
    'HEAL_100': 'Восстанавливает 100 HP',
    'XP_BOOST_10': '+10% к получаемому XP',
    'XP_BOOST_20': '+20% к получаемому XP',
    'XP_BOOST_50': '+50% к получаемому XP',
    'GOLD_BOOST_5': '+5% к золоту',
    'GOLD_BOOST_10': '+10% к золоту',
    'GOLD_BOOST_20': '+20% к золоту',
    'GOLD_BOOST_30': '+30% к золоту',
    'GOLD_BOOST_100': '+100% к золоту',
    'XP_GOLD_5': '+5% XP и +5% Gold',
    'XP_GOLD_15': '+15% XP и +15% Gold',
    'XP_GOLD_50': '+50% XP и +50% Gold',
    'XP_GOLD_MASSIVE': '+100% XP и +50% Gold',
    'FLAT_GOLD_5': '+5 фиксированного Золота за квест',
    'FLAT_XP_100': 'Мгновенно дает 100 XP',
    'FLAT_BOSS_XP_200': '+200 XP бонус за победу над Боссом',
    'DMG_REDUCE_10': 'Снижает урон от ошибки на 10%',
    'DMG_REDUCE_20': 'Снижает урон от ошибки на 20%',
    'DMG_REDUCE_30': 'Снижает урон от ошибки на 30%',
    'DMG_REDUCE_50': 'Снижает урон от ошибки на 50%',
    'DMG_REDUCE_70': 'Снижает урон от ошибки на 70%',
    'FLAT_DMG_REDUCE_5': 'Блокирует ровно -5 HP урона',
    'BLOCK_ONE_MISTAKE': '100% уклонение от одной ошибки',
    'BLOCK_ALL_MISTAKES': '100% иммунитет ко всем ошибкам',
    'BLOCK_CRITICAL_DMG': '100% иммунитет от двойки (крит. урон)',
    'PROTECT_STREAK': 'Защищает стрик от потери при пропуске 1 дня',
    'INFINITE_STREAK': 'Иммунитет к потере Стрика (навсегда, пока одет)',
    'CLASSWORK_XP_50': '+50% XP за работу у доски',
    'CLASSWORK_XP_200': '+200% XP за работу у доски',
    'SKIP_HOMEWORK': 'Легальный пропуск 1 ДЗ без штрафа',
    'PREVENT_DEATH_30': 'Спасает от смерти, оставляя 30 HP',
    'PREVENT_DEATH_50': 'Спасает от смерти, оставляя 50 HP',
    'RETRY_QUEST': 'Позволяет пересдать плохую оценку',
    'GOLD_MULTIPLIER_3X': 'Умножает все добытое золото в x3 раза',
    'BOSS_MULTIPLIER_3X': 'Умножает весь XP с Босса в x3 раза',
    'FORCE_LEVEL_UP': 'Мгновенно повышает Уровень на +1',
    'TEAM_XP_10': 'Дает пассивно +10% XP всему классу',
    'ROYAL_PIECE': 'Часть древнего сета Директора. Собери все 5 штук.'
  };
  return map[code] || 'Секретный эффект';
}

export default function ArtifactsTab() {
  const allArtifacts = Object.values(ARTIFACT_CATALOG);
  const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'royal'];

  return (
    <div className={styles.artifactsTab}>
      <div className={styles.introBlock}>
        <h2 className={styles.introTitle}>Каталог древних предметов</h2>
        <p className={styles.introText}>
          Здесь хранятся знания о 45 мощных артефактах Hero Academy. Собери правильный билд на своей Полке, 
          комбинируй расходники и стань настоящей Легендой!
        </p>
      </div>

      {rarities.map((rarity, index) => {
        const items = allArtifacts.filter((a) => a.rarity === rarity);
        const info = RARITY_INFO[rarity];

        return (
          <section key={rarity} className={styles.raritySection} style={{ animationDelay: `${index * 0.15}s` }}>
            <div className={styles.rarityHeader}>
              <h2 className={`${styles.rarityTitle} ${styles[`title_${rarity}`]}`}>
                {info.title} <span>({items.length} шт)</span>
              </h2>
              <div className={styles.rarityInfo}>
                <div className={styles.chance}>{info.chance}</div>
                <div className={styles.source}>{info.source}</div>
              </div>
            </div>

            <div className={styles.grid}>
              {items.map((item) => (
                <div key={item.id} className={`${styles.card} ${styles[`card_${rarity}`]} ${styles[rarity]}`}>
                  <div className={styles.iconBox}>
                    <ArtifactIcon id={item.id} />
                  </div>
                  <div className={styles.content}>
                    <div className={styles.itemName}>{item.name}</div>
                    
                    <div className={styles.itemMeta}>
                      <span className={styles.metaBadge}>
                        {item.type === 'consumable' ? 'Расходник' : 'Полка'}
                      </span>
                      <span className={styles.metaBadge}>Ур. {item.req_level}</span>
                      {item.max_charges && (
                        <span className={styles.metaBadge}>Зарядов: {item.max_charges}</span>
                      )}
                      {item.duration_hours && (
                        <span className={styles.metaBadge}>Время: {item.duration_hours}ч</span>
                      )}
                    </div>
                    
                    <div className={styles.itemEffect}>
                      {getEffectDescription(item.effect_code)}
                    </div>

                    {item.rarity === 'royal' && (
                      <div className={styles.royalText}>
                        Объедини 5 частей, чтобы получить Официальный Выходной!
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <div style={{ height: '40px' }} />
    </div>
  );
}
