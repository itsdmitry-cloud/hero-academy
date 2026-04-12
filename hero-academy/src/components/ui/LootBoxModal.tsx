'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ARTIFACT_CATALOG, ArtifactDef, Rarity } from '@/lib/utils/artifacts';
import { useHeroStore } from '@/lib/store/heroStore';
import { useToastStore } from '@/lib/store/toastStore';
import styles from './LootBoxModal.module.css';

export type LootBoxTier = 'silver' | 'gold' | 'legendary';

interface LootBoxModalProps {
  tier: LootBoxTier;
  onClose: () => void;
}

const TIER_CONFIG: Record<LootBoxTier, { name: string; icon: React.ReactNode; rarityPool: Rarity[]; color: string }> = {
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

export function LootBoxModal({ tier, onClose }: LootBoxModalProps) {
  const config = TIER_CONFIG[tier];
  const addArtifact = useHeroStore((s) => s.addArtifact);
  const addToast = useToastStore((s) => s.addToast);

  const [phase, setPhase] = useState<'intro' | 'spinning' | 'reveal'>('intro');
  const [rouletteItems, setRouletteItems] = useState<ArtifactDef[]>([]);
  const [winnerItem, setWinnerItem] = useState<ArtifactDef | null>(null);
  const [spinOffset, setSpinOffset] = useState(0);

  // Build a roulette strip of ~30 items, with the winner at a known position
  const buildRoulette = useCallback(() => {
    const allItems = Object.values(ARTIFACT_CATALOG).filter(a => a.rarity !== 'royal');
    
    // Pick the winning rarity from the pool
    const winningRarity = config.rarityPool[Math.floor(Math.random() * config.rarityPool.length)];
    const candidates = allItems.filter(a => a.rarity === winningRarity);
    const winner = candidates[Math.floor(Math.random() * candidates.length)];

    // Build 30 random items for the strip
    const strip: ArtifactDef[] = [];
    for (let i = 0; i < 30; i++) {
      const randomRarity = config.rarityPool[Math.floor(Math.random() * config.rarityPool.length)];
      const pool = allItems.filter(a => a.rarity === randomRarity);
      strip.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    // Place winner at position 24 (near the end, so the spin feels long)
    strip[24] = winner;

    setRouletteItems(strip);
    setWinnerItem(winner);
  }, [config.rarityPool]);

  const handleOpen = () => {
    buildRoulette();
    setPhase('spinning');

    // Item width = 100px + 12px gap = 112px per item
    // We want to land on item 24, center of the viewport
    // Viewport ~350px wide, so center = 175px
    // Target offset = (24 * 112) - 175 + random jitter
    const targetOffset = (24 * 112) - 150 + Math.random() * 40;
    
    // Small delay to let the DOM paint the strip first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinOffset(targetOffset);
      });
    });

    // After the spin animation (~4s), reveal
    setTimeout(() => {
      setPhase('reveal');
    }, 4200);
  };

  const handleClaim = () => {
    if (winnerItem) {
      addArtifact(winnerItem.id);
      addToast({
        type: 'artifact',
        title: `${winnerItem.name}!`,
        message: `Новый артефакт добавлен в инвентарь!`,
        icon: getItemIcon(winnerItem.id),
        duration: 5000,
      });
    }
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && phase !== 'spinning' && onClose()}>
      <div className={styles.modal}>

        {/* === INTRO PHASE === */}
        {phase === 'intro' && (
          <div className={styles.introPhase}>
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
          <div className={styles.spinPhase}>
            <div className={styles.rouletteViewport}>
              <div className={styles.pointer} />
              <div
                className={styles.rouletteStrip}
                style={{ transform: `translateX(-${spinOffset}px)` }}
              >
                {rouletteItems.map((item, i) => (
                  <div
                    key={i}
                    className={styles.rouletteItem}
                    style={{ borderColor: RARITY_COLORS[item.rarity] }}
                  >
                    <span className={styles.rouletteIcon}>{getItemIcon(item.id)}</span>
                    <span className={styles.rouletteName}>{item.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className={styles.spinText}>Вращаем...</p>
          </div>
        )}

        {/* === REVEAL PHASE === */}
        {phase === 'reveal' && winnerItem && (
          <div className={styles.revealPhase}>
            <div className={styles.revealGlow} style={{ '--glow-color': RARITY_COLORS[winnerItem.rarity] } as React.CSSProperties} />
            <div className={styles.revealCard} style={{ borderColor: RARITY_COLORS[winnerItem.rarity] }}>
              <div className={styles.revealRarity} style={{ color: RARITY_COLORS[winnerItem.rarity] }}>
                {winnerItem.rarity === 'common' ? '🟢 Обычный' : winnerItem.rarity === 'rare' ? '🔵 Редкий' : winnerItem.rarity === 'epic' ? '🟣 Эпический' : '🟡 Легендарный'}
              </div>
              <div className={styles.revealIcon}>{getItemIcon(winnerItem.id)}</div>
              <h2 className={styles.revealName}>{winnerItem.name}</h2>
              <p className={styles.revealType}>
                {winnerItem.type === 'consumable' ? 'Расходник' : 'Пассивный'} · Ур. {winnerItem.req_level}
                {winnerItem.max_charges ? ` · ${winnerItem.max_charges} зар.` : ''}
                {winnerItem.duration_hours ? ` · ${winnerItem.duration_hours}ч` : ''}
              </p>
            </div>
            <button className={styles.claimBtn} onClick={handleClaim}>
              Забрать в инвентарь →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
