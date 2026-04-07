'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useShop, type ShopItem } from '@/lib/hooks/use-shop';
import { useHero } from '@/lib/hooks/use-hero';
import { useArtifacts, type ArtifactCatalog } from '@/lib/hooks/use-artifacts';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './page.module.css';

const rarityColors: Record<string, string> = {
  common: '#94a3b8', rare: '#60a5fa', epic: '#a855f7', legendary: '#f59e0b',
};
const rarityLabels: Record<string, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};

/** Which artifact rarities can drop from each box tier */
/** Each box tier contains ONLY artifacts of its own rarity */
const BOX_POOLS: Record<string, string[]> = {
  'common':    ['common'],
  'rare':      ['rare'],
  'epic':      ['epic'],
  'legendary': ['legendary'],
};

/** Render icon: file path → <img>, otherwise emoji */
function ArtIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  if (icon.startsWith('/') || icon.startsWith('http')) {
    return <img src={icon} alt="" width={size} height={size} style={{ objectFit: 'contain' }} />;
  }
  return <span style={{ fontSize: Math.max(28, size * 0.7) }}>{icon}</span>;
}

type ShopCategory = 'all' | 'hp_potion' | 'xp_boost' | 'artifact' | 'cosmetic' | 'lootbox';

/* ── mock items for demo mode ── */
interface ShopItemView {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number;
  effect: string;
  rarity?: string;
  popular?: boolean;
  limited?: boolean;
}



const categoryLabels: Record<string, string> = {
  all: '🏪 Все', hp_potion: '❤️ HP Зелья', xp_boost: '⚡ XP Буст', artifact: '💎 Артефакты', cosmetic: '🎨 Косметика', lootbox: '🎁 Сундуки',
};

/* ── category → emoji icon ── */
const CATEGORY_ICON: Record<string, string> = {
  hp_potion: '❤️', xp_boost: '⭐', artifact: '💎', cosmetic: '🎨',
  potions: '🧪', boosts: '⚡', scrolls: '📜', lootbox: '🎁',
};

/* ── convert Supabase items to view model ── */
function toView(item: ShopItem): ShopItemView {
  const effectNum = typeof item.effect_value === 'number' ? `+${item.effect_value}` : '';
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    icon: item.icon || (CATEGORY_ICON[item.category] ?? '🛒'),
    category: item.category,
    price: item.price_gold,
    effect: effectNum || item.description || item.category,
  };
}

export default function ShopPage() {
  const { user } = useAuth();
  const { items: supaItems, loading: shopLoading, buyItem } = useShop();
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero();
  const { catalog: artifactCatalog } = useArtifacts();

  const [category, setCategory] = useState<ShopCategory>('all');
  const [selectedItem, setSelectedItem] = useState<ShopItemView | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [showLootPreview, setShowLootPreview] = useState(false);

  const displayItems: ShopItemView[] = supaItems.map(toView);
  const heroGold = hero?.gold ?? 0;

  const filtered = category === 'all' ? displayItems : displayItems.filter((i) => i.category === category);

  // Possible drops for selected lootbox
  const lootPoolArtifacts = useMemo(() => {
    if (!selectedItem || selectedItem.category !== 'lootbox') return [];
    // Determine box rarity from name
    const boxRarity = selectedItem.name.includes('Легенд') ? 'legendary'
      : selectedItem.name.includes('Эпич') ? 'epic'
      : selectedItem.name.includes('Редк') ? 'rare'
      : 'common';
    const pool = BOX_POOLS[boxRarity] ?? ['common', 'rare'];
    // Filter catalog: only artifacts in the pool rarities, exclude lootboxes
    return artifactCatalog.filter(a => pool.includes(a.rarity) && a.effect !== 'lootbox' && !a.name.startsWith('📦'));
  }, [selectedItem, artifactCatalog]);

  const handlePurchase = async () => {
    if (!selectedItem) return;

    setBuying(true);
    setPurchaseError(null);
    const { error } = await buyItem(selectedItem.id);
    if (error) {
      setPurchaseError(error);
      setBuying(false);
      return;
    }
    setBuying(false);

    // Refetch hero data (gold balance) after successful purchase
    void refetchHero();

    setPurchased(true);
    setTimeout(() => {
      setPurchased(false);
      setSelectedItem(null);
      setPurchaseError(null);
    }, 1500);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className="text-display">Магазин</h1>
        <div className={styles.balance}>
          <span className={styles.balanceIcon}>💰</span>
          <span className={`${styles.balanceValue} text-mono`}>{heroGold.toLocaleString()}</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className={styles.categories}>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.catBtn} ${category === key ? styles.catActive : ''}`}
            onClick={() => setCategory(key as ShopCategory)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Shop Grid */}
      <div className={styles.grid}>
        {filtered.map((item, i) => (
          <div
            key={item.id}
            className={`${styles.itemCard} ${item.rarity ? styles[`rarity_${item.rarity}`] : ''}`}
            onClick={() => setSelectedItem(item)}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            {item.popular && <span className={styles.popularBadge}>🔥 Популярное</span>}
            {item.limited && <span className={styles.limitedBadge}>⏰ Лимитед</span>}
            <span className={styles.itemIcon}><ArtIcon icon={item.icon} size={80} /></span>
            <span className={styles.itemName}>{item.name}</span>
            <span className={styles.itemEffect}>{item.effect}</span>
            <div className={styles.itemPrice}>
              <span className={styles.goldIcon}>💰</span>
              <span className={`${styles.priceValue} text-mono`}>{item.price}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      <Modal isOpen={!!selectedItem} onClose={() => { setSelectedItem(null); setPurchased(false); setPurchaseError(null); setShowLootPreview(false); }} title={selectedItem?.category === 'lootbox' ? '🎁 Сундук' : 'Купить предмет'} size={showLootPreview ? 'md' : 'sm'}>
        {selectedItem && (
          <div className={styles.purchaseModal}>
            {purchased ? (
              <div className={styles.purchaseSuccess}>
                <span className={styles.successIcon}>✅</span>
                <h3>Куплено!</h3>
                <p>{selectedItem.name} добавлен в инвентарь</p>
              </div>
            ) : showLootPreview ? (
              /* ── Loot box content preview ── */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Возможные предметы ({lootPoolArtifacts.length})</h3>
                  <button onClick={() => setShowLootPreview(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'var(--text-secondary)', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>← Назад</button>
                </div>
                <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(['legendary', 'epic', 'rare', 'common'] as const).map(r => {
                    const arts = lootPoolArtifacts.filter(a => a.rarity === r);
                    if (arts.length === 0) return null;
                    return (
                      <div key={r}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: rarityColors[r], textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.4rem 0 0.2rem', borderBottom: `1px solid ${rarityColors[r]}22` }}>
                          {rarityLabels[r]} ({arts.length})
                        </div>
                        {arts.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ width: '2rem', textAlign: 'center', flexShrink: 0 }}><ArtIcon icon={a.icon} size={28} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: rarityColors[a.rarity] }}>{a.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{a.description}</div>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: rarityColors[a.rarity], fontWeight: 700, flexShrink: 0, textAlign: 'right' }}>
                              {a.effect_value > 0 ? `+${a.effect_value}%` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <span className={styles.modalIcon}><ArtIcon icon={selectedItem.icon} size={48} /></span>
                <h3 className={styles.modalName}>{selectedItem.name}</h3>
                <p className={styles.modalDesc}>{selectedItem.description}</p>
                {selectedItem.category !== 'lootbox' && (
                  <div className={styles.modalEffect}>Эффект: <strong>{selectedItem.effect}</strong></div>
                )}

                {/* Loot box: show "Preview contents" button */}
                {selectedItem.category === 'lootbox' && (
                  <button
                    onClick={() => setShowLootPreview(true)}
                    style={{ width: '100%', padding: '0.6rem', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  >
                    👀 Посмотреть содержимое ({lootPoolArtifacts.length} предметов)
                  </button>
                )}

                <div className={styles.priceSection}>
                  <div className={styles.priceRow}>
                    <span>Цена</span>
                    <span className="text-mono">💰 {selectedItem.price}</span>
                  </div>
                  <div className={styles.priceRow}>
                    <span>Ваш баланс</span>
                    <span className="text-mono">💰 {heroGold}</span>
                  </div>
                  <div className={`${styles.priceRow} ${styles.priceAfter}`}>
                    <span>После покупки</span>
                    <span className={`text-mono ${heroGold < selectedItem.price ? styles.insufficient : ''}`}>
                      💰 {heroGold - selectedItem.price}
                    </span>
                  </div>
                </div>

                {purchaseError && (
                  <div style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem' }}>
                    {purchaseError}
                  </div>
                )}

                <Button
                  variant="primary"
                  fullWidth
                  disabled={heroGold < selectedItem.price || buying}
                  onClick={handlePurchase}
                >
                  {buying ? 'Покупка...' : heroGold < selectedItem.price ? 'Недостаточно золота' : `Купить за ${selectedItem.price} 💰`}
                </Button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
