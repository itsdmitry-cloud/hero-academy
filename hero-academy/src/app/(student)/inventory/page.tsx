'use client';

import React, { useState } from 'react';
import { useArtifacts, type HeroArtifact, type ArtifactCatalog } from '@/lib/hooks/use-artifacts';
import { useHero } from '@/lib/hooks/use-hero';
import { LootBoxModal, type LootBoxTier } from '@/components/ui/LootBoxModal';
import styles from './page.module.css';

type TabId = 'all' | 'artifacts' | 'potions' | 'lootbox';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'all', label: 'Все', icon: '📋' },
  { id: 'artifacts', label: 'Артефакты', icon: '💎' },
  { id: 'potions', label: 'Зелья', icon: '⚗️' },
  { id: 'lootbox', label: 'Сундуки', icon: '🎁' },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

const RARITY_NAMES: Record<string, string> = {
  common: '🟢 Обычный',
  rare: '🔵 Редкий',
  epic: '🟣 Эпический',
  legendary: '🟡 Легендарный',
};

function ArtifactIcon({ icon, name, size = '100%' }: { icon: string; name: string; size?: string }) {
  if (icon && icon.includes('/')) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={icon}
        alt={name}
        style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return <span style={{ fontSize: '2rem' }}>{icon || '💎'}</span>;
}

type ArtifactCatalogExt = ArtifactCatalog & {
  effect_type?: string;
  season_pool?: string | null;
};

function isLootbox(art: ArtifactCatalog) {
  return art.name?.startsWith('📦') || art.effect === 'lootbox' || (art as ArtifactCatalogExt).effect_type === 'lootbox';
}

/** Maps seasonal chest names to boxRarity param for the API */
const SEASONAL_CHEST_MAP: Record<string, string> = {
  '🔥 Огненный Сундук': 'seasonal_fire',
  '❄️ Ледяной Сундук':  'seasonal_ice',
  '🌿 Земляной Сундук': 'seasonal_earth',
  '💧 Водяной Сундук':  'seasonal_water',
};

const SEASON_COLORS: Record<string, string> = {
  seasonal_fire:  '#f97316',
  seasonal_ice:   '#38bdf8',
  seasonal_earth: '#84cc16',
  seasonal_water: '#06b6d4',
};

function getSeasonalTag(art: ArtifactCatalog): string | null {
  return SEASONAL_CHEST_MAP[art.name] ?? null;
}

function isConsumable(art: ArtifactCatalog) {
  const eff = art.effect || (art as ArtifactCatalogExt).effect_type || '';
  return !isLootbox(art) && (
    eff.startsWith('hp_restore') || eff.startsWith('xp_instant') || eff === 'level_up' ||
    eff.startsWith('consumable_') || eff === 'gold_bonus' || eff === 'extra_gold'
  );
}

function rarityToTier(boxRarity: string): LootBoxTier {
  if (boxRarity === 'legendary') return 'legendary';
  if (boxRarity === 'epic') return 'gold';
  if (boxRarity === 'rare') return 'silver';
  return 'bronze';
}

export default function InventoryPage() {
  const { inventory, loading, equipArtifact, consumeArtifact, refetch } = useArtifacts();
  const { hero, openLootbox } = useHero();
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [selectedItem, setSelectedItem] = useState<HeroArtifact | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lootboxModal, setLootboxModal] = useState<{ id: string; tier: LootBoxTier; boxRarity: string } | null>(null);

  const lootboxItems = inventory.filter(i => i.artifact && isLootbox(i.artifact));

  const filterItem = (item: HeroArtifact) => {
    const art = item.artifact;
    if (!art || isLootbox(art)) return false;
    switch (activeTab) {
      case 'artifacts': return !isConsumable(art);
      case 'potions': return isConsumable(art);
      case 'lootbox': return false;
      default: return true;
    }
  };

  const showLootboxes = activeTab === 'all' || activeTab === 'lootbox';
  const filteredItems = inventory.filter(filterItem);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={`${styles.title} text-display`}>🎒 Рюкзак</h1>
        <p className={styles.subtitle}>{loading ? 'Загрузка...' : `${inventory.length} предметов`}</p>
      </header>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
            {tab.id === 'lootbox' && lootboxItems.length > 0 && (
              <span className={styles.badge}>{lootboxItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lootboxes - displayed bigger at top */}
      {showLootboxes && lootboxItems.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Сундуки</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {lootboxItems.map(item => {
              const art = item.artifact!;
              const seasonal = getSeasonalTag(art);
              const boxColor = seasonal ? (SEASON_COLORS[seasonal] ?? '#f97316') : RARITY_COLORS[art.rarity];
              const boxLabel = seasonal ? '🔥 СЕЗОННЫЙ' : 'СУНДУК';
              return (
                <div
                  key={item.id}
                  onClick={() => { setSelectedItem(item); setActionMsg(null); setActionError(null); }}
                  style={{
                    background: seasonal
                      ? `linear-gradient(135deg, ${boxColor}33, ${boxColor}11)`
                      : `linear-gradient(135deg, ${boxColor}22, ${boxColor}11)`,
                    border: `2px ${seasonal ? 'solid' : 'dashed'} ${boxColor}`,
                    borderRadius: '1rem',
                    padding: '1rem 0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: '130px',
                    boxShadow: seasonal ? `0 0 20px ${boxColor}22` : 'none',
                  }}
                >
                  <div style={{ width: 72, height: 72 }}>
                    <ArtifactIcon icon={art.icon} name={art.name} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', color: boxColor }}>{art.name}</span>
                  <span style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '0.65rem', background: boxColor + '33', color: boxColor, borderRadius: '4px', padding: '1px 5px', fontWeight: 800 }}>{boxLabel}</span>
                  {item.quantity > 1 && <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '0.7rem', fontWeight: 900, color: '#fff' }}>×{item.quantity}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular items grid */}
      {loading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⏳</div>
          <div className={styles.emptyText}>Загружаем инвентарь...</div>
        </div>
      ) : activeTab !== 'lootbox' && filteredItems.length > 0 ? (
        <div className={styles.grid}>
          {filteredItems.map(item => {
            const art = item.artifact;
            if (!art) return null;
            return (
              <div
                key={item.id}
                className={`${styles.itemCard} ${styles[`itemCard_${art.rarity}`]}`}
                onClick={() => { setSelectedItem(item); setActionMsg(null); setActionError(null); }}
              >
                <span className={styles.itemIcon}>
                  <ArtifactIcon icon={art.icon} name={art.name} />
                </span>
                <span className={styles.itemName}>{art.name}</span>
                {item.quantity > 1 && <div className={styles.itemCharges}>×{item.quantity}</div>}
                {item.is_equipped && <div className={styles.equippedBadge}>{art.artifact_type === 'consumable' ? '✨ АКТИВНО' : '⚡ НА ПОЛКЕ'}</div>}
                {hero && hero.level < (art.min_level || 1) && !item.is_equipped && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)' }}></div>
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab !== 'lootbox' && !loading && filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyText}>Пусто! Выполняй квесты и открывай сундуки.</div>
        </div>
      ) : null}

      {/* Item Detail Modal */}
      {selectedItem && selectedItem.artifact && (
        <div
          className={styles.detailOverlay}
          onClick={(e) => e.target === e.currentTarget && setSelectedItem(null)}
        >
          <div className={styles.detailSheet}>
            <>
                <div className={styles.detailIcon} style={{ transition: 'all 0.3s ease' }}>
                  <ArtifactIcon icon={selectedItem.artifact.icon} name={selectedItem.artifact.name} />
                </div>
                <div className={styles.detailName}>{selectedItem.artifact.name}</div>
                {(() => {
                  const art = selectedItem.artifact!;
                  const seasonPool = (art as ArtifactCatalogExt).season_pool;
                  const seasonalChest = getSeasonalTag(art);
                  if (seasonPool || seasonalChest) {
                    const sColor = seasonalChest
                      ? (SEASON_COLORS[seasonalChest] ?? '#f97316')
                      : seasonPool === 'fire' ? '#f97316'
                      : seasonPool === 'ice' ? '#38bdf8'
                      : seasonPool === 'earth' ? '#84cc16'
                      : seasonPool === 'water' ? '#06b6d4'
                      : '#f97316';
                    const label = seasonalChest ? '🔥 Сезонный Сундук' : '🔥 Сезонный';
                    return <div className={styles.detailRarity} style={{ color: sColor }}>{label}</div>;
                  }
                  return (
                    <div className={styles.detailRarity} style={{ color: RARITY_COLORS[art.rarity] }}>
                      {RARITY_NAMES[art.rarity]}
                    </div>
                  );
                })()}
                <div className={styles.detailEffect}>{selectedItem.artifact.description}</div>
                
                {selectedItem.artifact.min_level && selectedItem.artifact.min_level > 1 && !isLootbox(selectedItem.artifact) && (
                  <div style={{
                    color: hero && hero.level >= selectedItem.artifact.min_level ? 'var(--text-muted)' : '#f87171',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    padding: '0.5rem',
                    fontWeight: 700
                  }}>
                    {hero && hero.level >= selectedItem.artifact.min_level 
                      ? `✅ Требуемый уровень: ${selectedItem.artifact.min_level} (Доступно)` 
                      : `🔒 Доступно с ${selectedItem.artifact.min_level} уровня`}
                  </div>
                )}

                {actionMsg && <div style={{ color: '#4ade80', textAlign: 'center', padding: '0.5rem', fontWeight: 700 }}>{actionMsg}</div>}
                {actionError && <div style={{ color: '#f87171', textAlign: 'center', padding: '0.5rem' }}>{actionError}</div>}

                <div className={styles.detailActions}>
                  {isLootbox(selectedItem.artifact) ? (
                    <button
                      className={styles.btnEquip}
                      style={{ background: `linear-gradient(135deg, ${RARITY_COLORS[selectedItem.artifact.rarity]}cc, ${RARITY_COLORS[selectedItem.artifact.rarity]}66)`, fontSize: '1rem', fontWeight: 900 }}
                      onClick={() => {
                        const seasonalTag = getSeasonalTag(selectedItem.artifact!);
                        const boxRarity = seasonalTag ?? selectedItem.artifact!.rarity;
                        const tier = rarityToTier(boxRarity);
                        setSelectedItem(null);
                        setLootboxModal({ id: selectedItem.id, tier, boxRarity });
                      }}
                    >
                      🎁 Открыть сундук
                    </button>
                  ) : isConsumable(selectedItem.artifact) ? (
                    <button
                      className={styles.btnEquip}
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true); setActionError(null); setActionMsg(null);
                        const result = await consumeArtifact(selectedItem.id);
                        setActionLoading(false);
                        if (result.error) { setActionError(result.error); }
                        else {
                          const msgs: Record<string, string> = {
                            hp_restore: `❤️ +${result.value} HP!`,
                            xp_instant: `⚡ +${result.value} XP!`,
                            level_up: `🌟 Уровень ${result.value}!`,
                          };
                          setActionMsg(result.message || msgs[result.effect ?? ''] || '✅ Применено!');
                          setTimeout(() => setSelectedItem(null), 2000);
                        }
                      }}
                    >
                      {actionLoading ? '⏳' : '🧪 Применить'}
                    </button>
                  ) : selectedItem.is_equipped ? (
                    selectedItem.artifact.artifact_type === 'consumable' ? (
                      <div style={{ color: '#f59e0b', textAlign: 'center', padding: '0.5rem', fontWeight: 700 }}>
                        Эликсир выпит. Эффект активен до завершения задания.
                      </div>
                    ) : (
                      <button
                        className={styles.btnEquip}
                        style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                        disabled={actionLoading}
                        onClick={async () => {
                          setActionLoading(true);
                          const result = await equipArtifact(selectedItem.id, false);
                          setActionLoading(false);
                          if (result.error) setActionError(result.error);
                          else setSelectedItem(null);
                        }}
                      >
                        {actionLoading ? '⏳' : '🔄 Снять с полки'}
                      </button>
                    )
                  ) : (
                    <button
                      className={styles.btnEquip}
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true); setActionError(null);
                        const result = await equipArtifact(selectedItem.id, true);
                        setActionLoading(false);
                        if (result.error) setActionError(result.error);
                        else setSelectedItem(null);
                      }}
                    >
                      {actionLoading ? '⏳' : selectedItem.artifact.artifact_type === 'consumable' ? '✨ Выпить эликсир' : '⚡ Надеть на полку'}
                    </button>
                  )}
                  <button className={styles.btnClose} onClick={() => setSelectedItem(null)}>Закрыть</button>
                </div>
              </>
          </div>
        </div>
      )}

      {lootboxModal && (
        <LootBoxModal
          tier={lootboxModal.tier}
          heroArtifactId={lootboxModal.id}
          boxRarity={lootboxModal.boxRarity}
          openLootbox={openLootbox}
          onClose={() => setLootboxModal(null)}
          onClaim={() => { refetch(); }}
        />
      )}
    </div>
  );
}
