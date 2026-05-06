'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { ARTIFACT_CATALOG, ArtifactDef, Rarity } from '@/lib/utils/artifacts';
import styles from './LootBoxModal.module.css';

export type LootBoxTier = 'bronze' | 'silver' | 'gold' | 'legendary';

export type LootBoxApiArtifact = { id: string; name: string; icon: string; rarity: string; description?: string };

interface LootBoxModalProps {
  tier: LootBoxTier;
  heroArtifactId: string;
  boxRarity: string;
  openLootbox: (heroArtifactId: string, boxRarity: string) => Promise<{
    success: boolean;
    artifact?: LootBoxApiArtifact | null;
    error?: string;
  }>;
  onClose: () => void;
  onClaim: (artifact: LootBoxApiArtifact | null) => void;
}

const TIER_CONFIG: Record<LootBoxTier, { name: string; icon: React.ReactNode; rarityPool: Rarity[]; color: string }> = {
  bronze: {
    name: 'Обычный Сундук',
    icon: <Image src="/assets/lootboxes/common.png" alt="Common" width={80} height={80} style={{width:'100%', height:'100%', objectFit:'contain'}}/>,
    rarityPool: ['common', 'common', 'common', 'common', 'rare'],
    color: '#a8a29e',
  },
  silver: {
    name: 'Редкий Сундук',
    icon: <Image src="/assets/lootboxes/rare.png" alt="Silver" width={80} height={80} style={{width:'100%', height:'100%', objectFit:'contain'}}/>,
    rarityPool: ['common', 'common', 'common', 'rare', 'rare'],
    color: '#94a3b8',
  },
  gold: {
    name: 'Эпический Сундук',
    icon: <Image src="/assets/lootboxes/epic.png" alt="Gold" width={80} height={80} style={{width:'100%', height:'100%', objectFit:'contain'}}/>,
    rarityPool: ['rare', 'rare', 'epic', 'epic', 'legendary'],
    color: '#eab308',
  },
  legendary: {
    name: 'Легендарный Сундук',
    icon: <Image src="/assets/lootboxes/legendary.png" alt="Legendary" width={80} height={80} style={{width:'100%', height:'100%', objectFit:'contain'}}/>,
    rarityPool: ['epic', 'epic', 'legendary', 'legendary', 'legendary'],
    color: '#f97316',
  },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
  royal: '#f43f5e',
};

import { ARTIFACT_IMAGES } from '@/lib/utils/artifactImages';

function getItemIcon(id: string) {
  const src = ARTIFACT_IMAGES[id as keyof typeof ARTIFACT_IMAGES];
  if (!src) return '✨';
  
  return (
    <Image
      src={src}
      alt={id}
      width={80}
      height={80}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

function ApiIcon({ icon, name }: { icon: string; name: string }) {
  if (icon && (icon.startsWith('/') || icon.startsWith('http'))) {
    return <Image src={icon} alt={name} width={128} height={128} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
  }
  return <span style={{ fontSize: '72px' }}>{icon || '✨'}</span>;
}

export function LootBoxModal({ tier, heroArtifactId, boxRarity, openLootbox, onClose, onClaim }: LootBoxModalProps) {
  const config = TIER_CONFIG[tier];

  const [phase, setPhase] = useState<'intro' | 'spinning' | 'reveal'>('intro');
  const [rouletteItems, setRouletteItems] = useState<ArtifactDef[]>([]);
  const [apiResult, setApiResult] = useState<LootBoxApiArtifact | null>(null);
  const [spinOffset, setSpinOffset] = useState(0);
  const [winnerHighlight, setWinnerHighlight] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const buildStrip = useCallback((): ArtifactDef[] => {
    const seasonTag = boxRarity.startsWith('seasonal_') ? boxRarity.replace('seasonal_', '') : null;
    const allItems = Object.values(ARTIFACT_CATALOG).filter(a =>
      a.rarity !== 'royal' &&
      !a.id.startsWith('lootbox') &&
      !!ARTIFACT_IMAGES[a.id as keyof typeof ARTIFACT_IMAGES] &&
      (seasonTag ? a.season_tag === seasonTag : !a.season_tag)
    );
    const strip: ArtifactDef[] = [];
    for (let i = 0; i < 30; i++) {
      const randomRarity = config.rarityPool[Math.floor(Math.random() * config.rarityPool.length)];
      const pool = allItems.filter(a => a.rarity === randomRarity);
      const src = pool.length > 0 ? pool : allItems;
      strip.push(src[Math.floor(Math.random() * src.length)]);
    }
    return strip;
  }, [config.rarityPool, boxRarity]);

  const handleOpen = () => {
    setIsExiting(true);

    // Fire API immediately so it resolves during the 5s spin
    const apiPromise = openLootbox(heroArtifactId, boxRarity);

    setTimeout(() => {
      const strip = buildStrip();
      setRouletteItems(strip);
      const targetOffset = (24 * 112) - 150 + Math.random() * 40;
      setSpinOffset(targetOffset);
      setPhase('spinning');
      setIsExiting(false);

      // When API resolves, store the winner — position 24 renders it directly
      apiPromise.then(result => {
        if (result.success && result.artifact) {
          setApiResult(result.artifact);
        }
      });

      setTimeout(() => setWinnerHighlight(true), 5000);
      setTimeout(() => setIsExiting(true), 5200);
      setTimeout(() => {
        setPhase('reveal');
        setIsExiting(false);
      }, 5450);
    }, 250);
  };

  const handleClaim = () => {
    onClaim(apiResult);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && phase !== 'spinning' && onClose()}>
      <div className={styles.modal}>

        {/* === INTRO PHASE === */}
        {phase === 'intro' && (
          <div className={`${styles.introPhase} ${isExiting ? styles.phaseExit : styles.phaseEnter}`}>
            <div className={styles.boxIcon} style={{ '--box-color': config.color } as React.CSSProperties}>
              <span className={styles.boxEmoji}>{config.icon}</span>
            </div>
            <h2 className={styles.boxName}>{config.name}</h2>
            <p className={styles.boxDesc}>
              Содержит случайный артефакт от{' '}
              {[...new Set(config.rarityPool)].map((r, i, arr) => (
                <span key={r} style={{ color: RARITY_COLORS[r], fontWeight: 700 }}>
                  {r === 'common' ? 'Обычного' : r === 'rare' ? 'Редкого' : r === 'epic' ? 'Эпического' : 'Легендарного'}
                  {i < arr.length - 1 ? ' до ' : ''}
                </span>
              ))}
            </p>
            <button className={styles.openBtn} style={{ '--btn-color': config.color } as React.CSSProperties} onClick={handleOpen}>
              Открыть сундук
            </button>
          </div>
        )}

        {/* === SPINNING PHASE === */}
        {phase === 'spinning' && (
          <div className={`${styles.spinPhase} ${isExiting ? styles.phaseExit : styles.phaseEnter}`}>
            <div className={styles.rouletteViewport}>
              <div className={styles.pointer} />
              <div
                className={styles.rouletteStrip}
                style={{ '--spin-target': `${spinOffset}px` } as React.CSSProperties}
              >
                {rouletteItems.map((item, i) => {
                  const isWinner = i === 24 && apiResult;
                  const rarity = isWinner ? apiResult.rarity : item.rarity;
                  return (
                    <div
                      key={i}
                      className={`${styles.rouletteItem}${winnerHighlight && i === 24 ? ` ${styles.rouletteItemWinner}` : ''}`}
                      style={{ borderColor: RARITY_COLORS[rarity], color: RARITY_COLORS[rarity] }}
                    >
                      <span className={styles.rouletteIcon}>
                        {isWinner
                          ? (apiResult.icon && (apiResult.icon.startsWith('/') || apiResult.icon.startsWith('http'))
                              ? <Image src={apiResult.icon} alt={apiResult.name} width={48} height={48} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              : <span style={{ fontSize: '32px' }}>{apiResult.icon || '✨'}</span>)
                          : getItemIcon(item.id)}
                      </span>
                      <span className={styles.rouletteName}>
                        {isWinner ? apiResult.name.split(' ')[0] : item.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className={styles.spinText}>Вращаем...</p>
          </div>
        )}

        {/* === REVEAL PHASE === */}
        {phase === 'reveal' && apiResult && (
          <div className={`${styles.revealPhase} ${styles.phaseEnter}`}>
            <div className={styles.revealCard} style={{ borderColor: RARITY_COLORS[apiResult.rarity] }}>
              <div className={styles.revealRarity} style={{ color: RARITY_COLORS[apiResult.rarity] }}>
                {apiResult.rarity === 'common' ? '🟢 Обычный' : apiResult.rarity === 'rare' ? '🔵 Редкий' : apiResult.rarity === 'epic' ? '🟣 Эпический' : '🟡 Легендарный'}
              </div>
              <div className={styles.revealIcon}>
                <ApiIcon icon={apiResult.icon} name={apiResult.name} />
              </div>
              <h2 className={styles.revealName}>{apiResult.name}</h2>
              {apiResult.description && (
                <p className={styles.revealType}>{apiResult.description}</p>
              )}
            </div>
            <button className={styles.claimBtn} onClick={handleClaim}>
              Забрать в инвентарь →
            </button>
          </div>
        )}
        {phase === 'reveal' && !apiResult && (
          <div className={`${styles.revealPhase} ${styles.phaseEnter}`}>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Что-то пошло не так 😞</p>
            <button className={styles.claimBtn} onClick={() => { onClaim(null); onClose(); }}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  );
}
