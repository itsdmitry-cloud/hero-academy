'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ARTIFACT_CATALOG } from '@/lib/utils/artifacts';
import { ARTIFACT_IMAGES } from '@/lib/utils/artifactImages';
import styles from './page.module.css';

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', rare: '#3b82f6', epic: '#a855f7', legendary: '#eab308', royal: '#f43f5e',
};
const RARITY_NAMES: Record<string, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный', royal: 'Королевский',
};

const EFFECT_LABELS: Record<string, string> = {
  'HEAL_30': '❤️ +30 HP',
  'HEAL_60': '❤️ +60 HP',
  'HEAL_100': '💚 +100 HP',
  'XP_BOOST_10': '⭐ +10% XP',
  'XP_BOOST_20': '⭐ +20% XP',
  'XP_BOOST_50': '⭐ +50% XP',
  'GOLD_BOOST_5': '💰 +5% Gold',
  'GOLD_BOOST_10': '💰 +10% Gold',
  'GOLD_BOOST_20': '💰 +20% Gold',
  'GOLD_BOOST_30': '💰 +30% Gold',
  'GOLD_BOOST_100': '💰 +100% Gold',
  'DMG_REDUCE_10': '🛡️ −10% урона',
  'DMG_REDUCE_30': '🛡️ −30% урона',
  'DMG_REDUCE_50': '🛡️ −50% урона',
  'DMG_REDUCE_70': '🛡️ −70% урона',
  'FLAT_DMG_REDUCE_5': '🛡️ −5 ед. урона',
  'FLAT_XP_100': '⭐ +100 XP мгнов.',
  'FLAT_GOLD_5': '💰 +5 Gold/квест',
  'FLAT_BOSS_XP_200': '⭐ +200 XP за босса',
  'XP_GOLD_5': '✨ +5% XP и Gold',
  'XP_GOLD_15': '✨ +15% XP и Gold',
  'XP_GOLD_50': '✨ +50% XP и Gold',
  'XP_GOLD_MASSIVE': '✨ +100% XP и Gold',
  'CLASSWORK_XP_50': '📚 +50 XP за урок',
  'CLASSWORK_XP_200': '📚 +200 XP за урок',
  'PROTECT_STREAK': '🔥 Защита стрика ×1',
  'SKIP_HOMEWORK': '📜 Пропуск 1 ДЗ',
  'TEAM_DMG_REDUCE_20': '🛡️ −20% урона классу',
  'TEAM_XP_GOLD_10': '✨ +10% XP и Gold классу',
  'FORCE_LEVEL_UP': '🌟 Уровень +1',
  'BLOCK_ONE_MISTAKE': '🛡️ Блок 1 ошибки',
  'BLOCK_CRITICAL_DMG': '🛡️ Блок крит. урона',
  'BLOCK_ALL_MISTAKES': '🛡️ Блок всех ошибок',
  'PREVENT_DEATH_30': '💖 Спасение (30 HP)',
  'PREVENT_DEATH_50': '💖 Спасение (50 HP)',
  'GOLD_MULTIPLIER_3X': '💰 Gold ×3',
  'BOSS_MULTIPLIER_3X': '🐉 XP за босса ×3',
  'TEAM_XP_10': '👥 +10% XP гильдии',
  'INFINITE_STREAK': '🔥 Бессмертный стрик',
  'ROYAL_PIECE': '👑 Часть сета Прогульщика',
};

type EditableArtifact = {
  id: string;
  effect_code: string;
  charges?: number;
  drop_rate?: number;
  req_level: number;
  stackable: boolean;
};

export default function ArtifactsAdminPage() {
  const allArtifacts = Object.values(ARTIFACT_CATALOG);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<EditableArtifact>>>({});

  const filtered = allArtifacts.filter(a => {
    if (filter !== 'all' && a.rarity !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getEdit = (id: string) => edits[id] || {};

  const updateEdit = <K extends keyof EditableArtifact>(id: string, field: K, value: EditableArtifact[K]) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-display">💎 Каталог артефактов</h1>
          <p className={styles.subtitle}>Глобальное редактирование — изменения для всех школ и классов</p>
        </div>
        <span className={styles.counter}>{allArtifacts.length} артефактов</span>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="🔍 Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.rarityFilters}>
          {['all', 'common', 'rare', 'epic', 'legendary', 'royal'].map(r => (
            <button
              key={r}
              className={`${styles.filterBtn} ${filter === r ? styles.filterActive : ''}`}
              style={r !== 'all' ? { '--filter-color': RARITY_COLORS[r] } as React.CSSProperties : {}}
              onClick={() => setFilter(r)}
            >
              {r === 'all' ? 'Все' : RARITY_NAMES[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Artifacts table */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span>Артефакт</span>
          <span>Редкость</span>
          <span>Тип</span>
          <span>Эффект</span>
          <span>Ур.</span>
          <span></span>
        </div>
        {filtered.map(art => {
          const isEditing = editing === art.id;
          const edit = getEdit(art.id);
          const imgSrc = ARTIFACT_IMAGES[art.id];

          return (
            <div key={art.id} className={`${styles.tableRow} ${isEditing ? styles.tableRowEditing : ''}`}>
              <div className={styles.artName}>
                {imgSrc ? (
                  <Image src={imgSrc} alt="" width={32} height={32} style={{ objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }} />
                ) : (
                  <span className={styles.artEmoji}>{art.type === 'consumable' ? '⚗️' : '💎'}</span>
                )}
                <span>{art.name}</span>
              </div>
              <span className={styles.rarityBadge} style={{ color: RARITY_COLORS[art.rarity], borderColor: RARITY_COLORS[art.rarity] }}>
                {RARITY_NAMES[art.rarity]}
              </span>
              <span className={styles.typeBadge}>{art.type === 'consumable' ? '⚗️ Расход' : '🛡️ Пассив'}</span>
              <span className={styles.effectCell}>
                {isEditing ? (
                  <select
                    className={styles.editSelect}
                    value={edit.effect_code || art.effect_code}
                    onChange={(e) => updateEdit(art.id, 'effect_code', e.target.value)}
                  >
                    {Object.entries(EFFECT_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                ) : (
                  EFFECT_LABELS[art.effect_code] || art.effect_code
                )}
              </span>
              <span className={styles.levelCell}>
                {isEditing ? (
                  <input
                    type="number"
                    className={styles.editInput}
                    value={edit.req_level ?? art.req_level}
                    onChange={(e) => updateEdit(art.id, 'req_level', parseInt(e.target.value))}
                    min={1} max={100}
                  />
                ) : (
                  art.req_level
                )}
              </span>
              <div className={styles.actions}>
                {isEditing ? (
                  <>
                    <button className={styles.saveRowBtn} onClick={() => setEditing(null)}>✅</button>
                    <button className={styles.cancelBtn} onClick={() => { setEditing(null); const newEdits = { ...edits }; delete newEdits[art.id]; setEdits(newEdits); }}>❌</button>
                  </>
                ) : (
                  <button className={styles.editBtn} onClick={() => setEditing(art.id)}>✏️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(edits).length > 0 && (
        <div className={styles.globalSave}>
          <span>⚠️ {Object.keys(edits).length} артефакт(ов) изменено</span>
          <button className={styles.globalSaveBtn}>💾 Сохранить все изменения глобально</button>
        </div>
      )}
    </div>
  );
}
