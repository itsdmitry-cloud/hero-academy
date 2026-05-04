'use client';

import React from 'react';
import Image from 'next/image';
import { ARTIFACT_REGISTRY, type ArtifactEntry } from '@/lib/game/artifact-registry';
import { ARTIFACT_IMAGES } from '@/lib/utils/artifactImages';
import styles from './page.module.css';

type SectionKey = 'lootbox' | 'common' | 'rare' | 'epic' | 'legendary' | 'royal' | 'fire' | 'cosmetic';

const SECTION_INFO: Record<SectionKey, { title: string; emoji: string; chance: string; source: string }> = {
  lootbox:   { title: 'Сундуки',           emoji: '📦', chance: '—',                  source: 'Магазин, дроп с боссов' },
  common:    { title: 'Обычные',           emoji: '🟢', chance: '~70% из лутбокса',   source: 'Обычный сундук, ежедневная награда' },
  rare:      { title: 'Редкие',            emoji: '🔵', chance: '~20% из лутбокса',   source: 'Редкий сундук, проверочные' },
  epic:      { title: 'Эпические',         emoji: '🟣', chance: '~9% из лутбокса',    source: 'Эпический сундук, рядовые боссы' },
  legendary: { title: 'Легендарные',       emoji: '🟡', chance: '~1% из лутбокса',    source: 'Легендарный сундук, финальный босс' },
  royal:     { title: 'Королевский Сет',   emoji: '👑', chance: 'секрет',             source: 'Скрытое условие' },
  fire:      { title: 'Огненный Сезон',    emoji: '🔥', chance: 'сезонно',            source: 'Огненный сундук (доступен в сезон)' },
  cosmetic:  { title: 'Украшения профиля', emoji: '🎨', chance: 'дроп из 🔥 сундука', source: 'Огненный сундук' },
};

const SECTION_ORDER: SectionKey[] = ['lootbox', 'common', 'rare', 'epic', 'legendary', 'royal', 'fire', 'cosmetic'];

function categorize(a: ArtifactEntry): SectionKey {
  if (a.effect_code.startsWith('LOOTBOX_')) return 'lootbox';
  if (a.effect_code === 'COSMETIC')         return 'cosmetic';
  if (a.season_tag === 'fire')              return 'fire';
  return a.rarity;
}

const EFFECT_DESCRIPTIONS: Record<string, string> = {
  // Healing
  'HEAL_30':  'Восстанавливает 30 HP',
  'HEAL_60':  'Восстанавливает 60 HP',
  'HEAL_100': 'Полностью восстанавливает HP',
  // XP boosts
  'XP_BOOST_10': '+10% к получаемому XP',
  'XP_BOOST_20': '+20% к получаемому XP',
  'XP_BOOST_50': '+50% к получаемому XP',
  // Gold boosts
  'GOLD_BOOST_5':       '+5% к золоту',
  'GOLD_BOOST_10':      '+10% к золоту',
  'GOLD_BOOST_20':      '+20% к золоту',
  'GOLD_BOOST_30':      '+30% к золоту',
  'GOLD_BOOST_100':     '+100% к золоту',
  'GOLD_MULTIPLIER_3X': 'Умножает добытое золото в ×3',
  // Combos
  'XP_GOLD_5':       '+5% XP и +5% Gold',
  'XP_GOLD_15':      '+15% XP и +15% Gold',
  'XP_GOLD_50':      '+50% XP и +50% Gold',
  'XP_GOLD_MASSIVE': '+100% XP и +50% Gold',
  // Flat XP/Gold
  'FLAT_GOLD_5': '+5 фиксированного Gold за квест',
  'FLAT_XP_100': 'Мгновенно даёт +100 XP',
  // Damage reduction
  'DMG_REDUCE_10':     'Снижает урон от ошибки на 10%',
  'DMG_REDUCE_20':     'Снижает урон от ошибки на 20%',
  'DMG_REDUCE_30':     'Снижает урон от ошибки на 30%',
  'DMG_REDUCE_50':     'Снижает урон от ошибки на 50%',
  'DMG_REDUCE_70':     'Снижает урон от ошибки на 70%',
  'FLAT_DMG_REDUCE_5': 'Блокирует ровно −5 HP урона',
  // Shields
  'BLOCK_ONE_MISTAKE':  '100% уклонение от одной ошибки',
  'BLOCK_ALL_MISTAKES': '100% иммунитет ко всем ошибкам',
  'BLOCK_CRITICAL_DMG': '100% иммунитет от двойки (крит. урон)',
  // Boss-targeted
  'FLAT_BOSS_XP_200':   '+200 XP бонус за победу над боссом',
  'BOSS_MULTIPLIER_3X': 'Умножает весь XP с босса в ×3',
  // Classwork
  'CLASSWORK_XP_50':  '+50% XP за работу у доски',
  'CLASSWORK_XP_200': '+200% XP за работу у доски',
  // Streak / Skip
  'PROTECT_STREAK':  'Защищает стрик от потери при пропуске 1 дня',
  'INFINITE_STREAK': 'Иммунитет к потере стрика (пока надет)',
  'SKIP_HOMEWORK':   'Легальный пропуск 1 ДЗ без штрафа',
  // Death save
  'PREVENT_DEATH_30': 'Спасает от смерти, оставляя 30 HP',
  'PREVENT_DEATH_50': 'Спасает от смерти, оставляя 50 HP',
  'FORCE_LEVEL_UP':   'Мгновенно повышает уровень на +1',
  // Team
  'TEAM_XP_10':         'Пассивно +10% XP всему классу',
  'TEAM_XP_GOLD_10':    '+10% XP и Gold всему классу',
  'TEAM_DMG_REDUCE_20': '−20% урона всему классу',
  'TEAM_BOSS_20':       '+20% к опыту всему классу',
  // Royal set
  'ROYAL_PIECE': 'Часть древнего сета Директора. Собери все 5 штук.',
  // Lootboxes
  'LOOTBOX_COMMON':    'Содержит обычный артефакт',
  'LOOTBOX_RARE':      'Содержит редкий артефакт',
  'LOOTBOX_EPIC':      'Содержит эпический артефакт',
  'LOOTBOX_LEGENDARY': 'Содержит легендарный артефакт',
  'LOOTBOX_FIRE':      'Содержит артефакт Огненного Сезона',
  // Fire Season — личные расходники
  'FIRE_HP_10':        'Восстанавливает 10 HP',
  'FIRE_XP_50':        'Мгновенно даёт +50 XP',
  'FIRE_FULL_HP':      'Полностью восстанавливает HP',
  'FIRE_GOLD_100':     'Мгновенно даёт +100 Gold',
  'FIRE_XP_200':       'Мгновенно даёт +200 XP',
  'FIRE_SEASON_XP_50': '+50 к сезонному XP',
  'FIRE_RANDOM_GOLD':  'Мгновенно даёт +50 Gold',
  'FIRE_COMBO':        '+100 XP, +50 Gold, +25 HP',
  // Fire Season — удар по боссу
  'FIRE_BOSS_500':        'Наносит 500 урона боссу',
  'FIRE_BOSS_RANDOM':     'Наносит 100 урона боссу',
  'FIRE_CLASS_BOSS_3000': 'Наносит 3000 урона боссу (от всего класса)',
  'FIRE_BOSS_MULT_20':    '+20% к опыту с боссов (на время сезона)',
  // Fire Season — командные
  'FIRE_CLASS_HP_20':    '+20 HP каждому ученику в классе',
  'FIRE_CLASS_XP_100':   '+100 XP каждому ученику в классе',
  'FIRE_CLASS_GOLD_50':  '+50 Gold каждому ученику в классе',
  'FIRE_RANDOM_STUDENT': '+50 XP и Gold случайному однокласснику',
  // Fire Season — пассивки
  'FIRE_GOLD_MULT_10':   '+10% к золоту постоянно (на время сезона)',
  'FIRE_REGEN_2':        '+2 HP каждый день автоматически',
  'FIRE_STREAK_SHIELD':  'Защищает стрик от сброса (1 заряд)',
  'FIRE_AUTO_RESURRECT': 'Авто-воскрешение с 50 HP (1 заряд)',
  // Cosmetic
  'COSMETIC': 'Украшение профиля героя',
};

function getEffectDescription(code: string): string {
  return EFFECT_DESCRIPTIONS[code] || 'Секретный эффект';
}

const BOSS_CODES   = new Set(['FLAT_BOSS_XP_200', 'BOSS_MULTIPLIER_3X', 'FIRE_BOSS_500', 'FIRE_BOSS_RANDOM', 'FIRE_CLASS_BOSS_3000', 'FIRE_BOSS_MULT_20']);
const STREAK_CODES = new Set(['PROTECT_STREAK', 'INFINITE_STREAK', 'FIRE_STREAK_SHIELD']);

function isTeamCode(code: string): boolean {
  return code.startsWith('TEAM_') || code.startsWith('FIRE_CLASS_') || code === 'FIRE_RANDOM_STUDENT';
}

function ArtifactIcon({ id }: { id: string }) {
  const imgSrc = ARTIFACT_IMAGES[id];
  if (imgSrc) {
    return <Image src={imgSrc} alt="" width={48} height={48} style={{ objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />;
  }
  return <span style={{ fontSize: 32 }}>✨</span>;
}

function ArtifactCard({ a }: { a: ArtifactEntry }) {
  const isConsumable = a.artifact_type === 'consumable';
  const isCosmetic   = a.effect_code === 'COSMETIC';
  const isBoss       = BOSS_CODES.has(a.effect_code);
  const isTeam       = isTeamCode(a.effect_code);
  const isStreak     = STREAK_CODES.has(a.effect_code);

  return (
    <div className={`${styles.card} ${styles[`card_${a.rarity}`]} ${styles[a.rarity]}`}>
      <div className={styles.iconBox}>
        <ArtifactIcon id={a.key} />
      </div>
      <div className={styles.content}>
        <div className={styles.itemName}>{a.name}</div>

        <div className={styles.itemMeta}>
          <span className={styles.metaBadge}>{isConsumable ? 'Расходник' : 'Полка'}</span>
          <span className={styles.metaBadge}>Ур. {a.req_level}</span>
          {a.max_charges > 0   && <span className={styles.metaBadge}>Зарядов: {a.max_charges}</span>}
          {a.duration_hours > 0 && <span className={styles.metaBadge}>Время: {a.duration_hours}ч</span>}
          {a.is_shopable && <span className={`${styles.metaBadge} ${styles.metaBadge_shop}`}>🛒 Магазин</span>}
          {isBoss        && <span className={`${styles.metaBadge} ${styles.metaBadge_boss}`}>💥 По боссу</span>}
          {isTeam        && <span className={`${styles.metaBadge} ${styles.metaBadge_team}`}>👥 Команде</span>}
          {isStreak      && <span className={`${styles.metaBadge} ${styles.metaBadge_streak}`}>🛡️ Стрик</span>}
          {isCosmetic    && <span className={`${styles.metaBadge} ${styles.metaBadge_cosmetic}`}>🎨 Косметика</span>}
        </div>

        <div className={styles.itemEffect}>
          {getEffectDescription(a.effect_code)}
        </div>

        {a.rarity === 'royal' && (
          <div className={styles.royalText}>
            Объедини 5 частей, чтобы получить Официальный Выходной!
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArtifactsTab() {
  const grouped: Record<SectionKey, ArtifactEntry[]> = {
    lootbox: [], common: [], rare: [], epic: [], legendary: [], royal: [], fire: [], cosmetic: [],
  };
  for (const a of ARTIFACT_REGISTRY) {
    grouped[categorize(a)].push(a);
  }

  return (
    <div className={styles.artifactsTab}>
      <div className={styles.introBlock}>
        <h2 className={styles.introTitle}>Каталог древних предметов</h2>
        <p className={styles.introText}>
          Здесь хранятся знания о {ARTIFACT_REGISTRY.length} артефактах Hero Academy. Собери правильный билд на своей Полке,
          комбинируй расходники и стань настоящей Легендой!
        </p>
      </div>

      {SECTION_ORDER.map((key, index) => {
        const items = grouped[key];
        if (items.length === 0) return null;
        const info = SECTION_INFO[key];

        return (
          <section key={key} className={styles.raritySection} style={{ animationDelay: `${index * 0.1}s` }}>
            <div className={styles.rarityHeader}>
              <h2 className={`${styles.rarityTitle} ${styles[`title_${key}`]}`}>
                {info.emoji} {info.title} <span>({items.length} шт)</span>
              </h2>
              <div className={styles.rarityInfo}>
                <div className={styles.chance}>{info.chance}</div>
                <div className={styles.source}>{info.source}</div>
              </div>
            </div>

            <div className={styles.grid}>
              {items.map((a) => <ArtifactCard key={a.key} a={a} />)}
            </div>
          </section>
        );
      })}
      <div style={{ height: '40px' }} />
    </div>
  );
}
