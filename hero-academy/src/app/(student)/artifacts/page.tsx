'use client';

import { useState, useCallback, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useArtifacts, type HeroArtifact, type ArtifactCatalog } from '@/lib/hooks/use-artifacts';
import { useHero } from '@/lib/hooks/use-hero';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './page.module.css';

const ROULETTE_ICONS = ['💎', '💰', '🛡️', '💊', '📜', '✨', '🔥', '❄️', '🐉', '🔮', '🌿', '💧'];

const rarityLabels: Record<string, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};
const rarityColors: Record<string, string> = {
  common: '#94a3b8', rare: '#60a5fa', epic: '#a855f7', legendary: '#f59e0b',
};

/* ── View model ── */
interface ArtifactView {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  effectLabel: string;
  effectType: string;
  duration: string;
  quantity: number;
  equipped: boolean;
  source: string;
  isLootbox: boolean;
  isConsumable: boolean;
  charges: number;
  expiresAt: string | null;
  seasonPool: string | null;
}

const EFFECT_LABELS: Record<string, (v: number) => string> = {
  xp_boost:       v => `+${v}% к XP`,
  damage_shield:  v => `−${v}% к урону ошибок`,
  damage_reduce:  v => `−${v}% к урону`,
  dmg_reduce:     v => `−${v}% к урону`,
  hp_restore:     v => `+${v} HP`,
  xp_instant:     v => `+${v} XP`,
  gold_boost:     v => `+${v}% к золоту`,
  gold_bonus:     v => `+${v}% к золоту`,
  gold_instant:   v => `+${v} золота`,
  extra_gold:     v => `+${v} золота`,
  death_save:     v => `Выживание при смерти (${v} HP)`,
  undo_crit:      () => 'Отмена смертельного удара',
  streak_protect: () => 'Иммунитет к потере стрика',
  skip_quest:     () => 'Пропуск ДЗ без потери HP и стрика',
  level_up:       () => '+1 уровень мгновенно',
  lootbox:        () => 'Случайный артефакт',
};
function getEffectLabel(effectStr: string, value: number): string {
  // Match first known key in the effect string (handles 'xp_boost,gold_boost')
  for (const [key, fn] of Object.entries(EFFECT_LABELS)) {
    if (effectStr.includes(key)) return fn(value);
  }
  return effectStr ? `${effectStr}: ${value}` : '—';
}
function formatTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Истёк';
  const totalMins = Math.floor(diff / 60_000);
  if (totalMins < 60) return `${totalMins}мин осталось`;
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}ч осталось`;
  return `${Math.floor(h / 24)}д ${h % 24}ч осталось`;
}
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

function toView(ha: any): ArtifactView {
  const rawRow = ha.dbRow || ha;
  const art = rawRow.artifact as (ArtifactCatalog & { artifact_type?: string }) | undefined;
  const eff = art?.effect || (art as any)?.effect_type || '';
  const isLootbox = art?.name?.startsWith('📦') || eff === 'lootbox' || (art as any)?.effect_type === 'lootbox';
  const isConsumable = !isLootbox && (
    art?.artifact_type === 'consumable' ||
    eff.startsWith('hp_restore') || eff.startsWith('xp_instant') || eff === 'level_up' ||
    eff.startsWith('consumable_') || eff === 'gold_bonus' || eff === 'extra_gold' || eff === 'gold_instant'
  );
  return {
    id: ha.id,
    name: art?.name ?? 'Unknown',
    description: art?.description ?? '',
    rarity: (art?.rarity ?? 'common') as ArtifactView['rarity'],
    icon: art?.icon ?? '💎',
    effectLabel: isLootbox ? 'Случайный артефакт' : getEffectLabel(eff, art?.effect_value ?? 0),
    effectType: eff,
    duration: art?.duration_hours
      ? `${art.duration_hours >= 24 ? `${Math.floor(art.duration_hours / 24)}д` : `${art.duration_hours}ч`}`
      : (isLootbox ? '1 открытие' : isConsumable ? 'Мгновенный' : 'Постоянный'),
    quantity: rawRow.quantity ?? 1,
    equipped: ha.is_equipped ?? rawRow.is_equipped,
    source: rawRow.source ?? 'none',
    isLootbox,
    isConsumable,
    charges: ha.charges_left ?? rawRow.charges_remaining ?? 0,
    expiresAt: rawRow.expires_at ?? null,
    seasonPool: (art as any)?.season_pool ?? null,
  };
}

const TOTAL_SLOTS = 12;

/* ── Loot box result ── */
interface LootResult {
  won: boolean;
  seasonal?: boolean;
  artifact?: { name: string; icon: string; rarity: string; description?: string } | null;
}

export default function ArtifactsPage() {
  const { user } = useAuth();
  const { catalog, inventory, loading, equipArtifact, useConsumable, sellArtifact, refetch, getMaxSlots } = useArtifacts();
  const { hero, openLootbox } = useHero();
  const [selected, setSelected] = useState<ArtifactView | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lootResult, setLootResult] = useState<LootResult | null>(null);
  const [rouletteItem, setRouletteItem] = useState('✨');
  const [opening, setOpening] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setTick] = useState(0); // for live countdown re-render

  // Live countdown — refresh every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const maxSlots = getMaxSlots(hero?.level ?? 1);
  const equippedCount = inventory.filter(i => i.is_equipped).length;

  const liveItems: (ArtifactView | null)[] = [
    ...inventory.map(toView),
    ...Array(Math.max(0, TOTAL_SLOTS - inventory.length)).fill(null),
  ].slice(0, TOTAL_SLOTS);

  const filledCount = liveItems.filter(Boolean).length;

  /** Maps seasonal chest names to API boxRarity param */
  const SEASONAL_TAG_MAP: Record<string, string> = {
    '🔥 Огненный Сундук': 'seasonal_fire',
    '❄️ Ледяной Сундук':  'seasonal_ice',
    '🌿 Земляной Сундук': 'seasonal_earth',
    '💧 Водяной Сундук':  'seasonal_water',
  };

  const handleOpenLootbox = async () => {
    if (!selected || !user) return;
    setOpening(true);
    setActionLoading(true);
    
    const seasonalTag = SEASONAL_TAG_MAP[selected.name];
    const boxRarity = seasonalTag ?? selected.rarity;
    
    let possible: string[] = [];
    if (seasonalTag) {
      const element = seasonalTag.replace('seasonal_', '');
      possible = catalog.filter((a: any) => a.season_pool === element).map(a => a.icon);
    } else {
      const validRarities = boxRarity === 'common' ? ['common', 'rare']
        : boxRarity === 'rare' ? ['common', 'rare', 'epic']
        : boxRarity === 'epic' ? ['rare', 'epic', 'legendary']
        : ['epic', 'legendary'];
      possible = catalog.filter(a => validRarities.includes(a.rarity) && !(a as any).season_pool).map(a => a.icon);
    }
    if (possible.length === 0) possible = ROULETTE_ICONS;
    
    // Roulette effect
    let tick = 0;
    const interval = setInterval(() => {
      setRouletteItem(possible[tick % possible.length]);
      tick++;
    }, 130); // fast swap

    await new Promise(r => setTimeout(r, 1800));

    // Pass seasonal tag instead of rarity for seasonal chests
    const result = await openLootbox(selected.id, boxRarity);
    
    clearInterval(interval);
    setOpening(false);
    setActionLoading(false);
    
    if (result.success && result.artifact) {
      setRouletteItem(result.artifact.icon || '🎁');
    }
    
    setLootResult({ won: result.success, seasonal: !!seasonalTag, artifact: result.artifact });
    await refetch();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className="text-display">Артефакты</h1>
        <div className={styles.count}>
          💎 {filledCount} предметов · ⚡ {equippedCount}/{maxSlots} слотов
        </div>
      </div>

      {/* Rarity Legend */}
      <div className={styles.legend}>
        <span className={`${styles.legendDot} ${styles.dotCommon}`} /> Обычный
        <span className={`${styles.legendDot} ${styles.dotRare}`} /> Редкий
        <span className={`${styles.legendDot} ${styles.dotEpic}`} /> Эпический
        <span className={`${styles.legendDot} ${styles.dotLegendary}`} /> Легендарный
        <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', opacity: 0.5 }}>📦 = Сундук</span>
      </div>

      {/* Artifact Grid */}
      <div className={styles.grid}>
        {liveItems.map((item, i) => (
          <div
            key={i}
            className={`${styles.slot} ${item ? styles[`rarity_${item.rarity}`] : styles.empty} ${item?.equipped ? styles.equipped : ''}`}
            onClick={() => item && setSelected(item)}
            style={item?.isLootbox
              ? { border: `2px dashed ${rarityColors[item.rarity]}`, position: 'relative' }
              : item?.seasonPool
                ? { border: '2px solid #f9731644', boxShadow: '0 0 12px #f9731622', position: 'relative' }
                : {}
            }
          >
            {item ? (
              <>
                <span className={styles.icon}>
                  {item.icon?.includes('/') ? <img src={item.icon} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : item.icon}
                </span>
                <span className={styles.name}>{item.name}</span>
                {item.quantity > 1 && <span className={styles.qty}>x{item.quantity}</span>}
                {item.equipped && !item.isLootbox && <span className={styles.equippedBadge}>⚡</span>}
                {item.isLootbox && (
                  <span style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '0.6rem', background: rarityColors[item.rarity] + '33', color: rarityColors[item.rarity], borderRadius: '4px', padding: '1px 4px', fontWeight: 800 }}>
                    СУНДУК
                  </span>
                )}
              </>
            ) : (
              <span className={styles.emptyIcon}>﹢</span>
            )}
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => { setSelected(null); setLootResult(null); }} title={selected?.isLootbox ? '🎁 Лут бокс' : 'Артефакт'} size="sm">
        {selected && (
          <div className={styles.detail}>
            {lootResult && lootResult.won && lootResult.artifact ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '0.5rem', width: 80, height: 80, margin: '0 auto' }}>
                  {lootResult.artifact.icon?.includes('/') ? <img src={lootResult.artifact.icon} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : lootResult.artifact.icon}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: lootResult.seasonal ? '#f97316' : rarityColors[lootResult.artifact.rarity], marginBottom: '0.25rem' }}>
                  🎉 Выпал артефакт!
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{lootResult.artifact.name}</div>
                {lootResult.seasonal ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 0.5rem', maxWidth: 300, margin: '0 auto' }}>
                    {lootResult.artifact.description || '🔥 Сезонный артефакт Огня'}
                  </div>
                ) : (
                  <span style={{ padding: '0.2rem 0.75rem', borderRadius: '999px', background: rarityColors[lootResult.artifact.rarity] + '22', border: `1px solid ${rarityColors[lootResult.artifact.rarity]}`, color: rarityColors[lootResult.artifact.rarity], fontWeight: 700, fontSize: '0.85rem' }}>
                    {rarityLabels[lootResult.artifact.rarity]}
                  </span>
                )}
                <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.5 }}>Добавлен в твой инвентарь</div>
                <button
                  onClick={() => { setLootResult(null); setSelected(null); }}
                  style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', background: 'var(--bg-glass-border)', border: 'none', borderRadius: 'var(--radius-lg)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Отлично!
                </button>
              </div>
            ) : (
             <>
              <div className={`${styles.detailIcon} ${styles[`rarity_${selected.rarity}`]}`}
              style={opening ? { transform: 'scale(1.7)', filter: 'drop-shadow(0 0 25px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 10px var(--accent-xp))', transition: 'all 0.1s ease', zIndex: 10 } : { transition: 'all 0.3s ease' }}>
              {opening ? <span style={{ display: 'inline-block', fontSize: '4.5rem', filter: 'none' }}>{rouletteItem?.includes('/') ? <img src={rouletteItem} alt="spin" style={{ width: '4.5rem', height: '4.5rem', objectFit: 'contain' }} /> : rouletteItem}</span> : (
                selected.icon?.includes('/') ? <img src={selected.icon} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : selected.icon
              )}
            </div>
            <h2 className={styles.detailName}>{selected.name}</h2>
            {(() => {
              const isSeasonal = selected.seasonPool || !!SEASONAL_TAG_MAP[selected.name];
              if (isSeasonal) {
                return <span className={`${styles.rarityBadge}`} style={{ background: '#f9731622', color: '#f97316', border: '1px solid #f97316' }}>🔥 Сезонный</span>;
              }
              return <span className={`${styles.rarityBadge} ${styles[`badge_${selected.rarity}`]}`}>✨ {rarityLabels[selected.rarity]}</span>;
            })()}
            <p className={styles.detailDesc}>{selected.description}</p>

            {selected.isLootbox ? (
              /* ── Lootbox UI ── */
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                  Открой сундук и испытай удачу.<br />
                  <strong style={{ color: rarityColors[selected.rarity] }}>Шанс артефакта: {selected.rarity === 'common' ? '~15%' : selected.rarity === 'rare' ? '~20%' : selected.rarity === 'epic' ? '~25%' : '~30%'}</strong>
                </div>
              {(() => {
                const isSeasonal = !!SEASONAL_TAG_MAP[selected.name];
                if (isSeasonal) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>🔥 Сезонный сундук с уникальными предметами:</div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['Зелья', 'Пассивки', 'Щиты', 'Коллекционки'].map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: '999px', background: '#f9731611', fontSize: '0.75rem', color: '#f97316' }}>{r}</span>)}
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Возможные редкости:</div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {selected.rarity === 'common' && ['Обычный', 'Редкий'].map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: '999px', background: '#ffffff11', fontSize: '0.75rem' }}>{r}</span>)}
                      {selected.rarity === 'rare' && ['Обычный', 'Редкий', 'Эпический'].map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: '999px', background: '#ffffff11', fontSize: '0.75rem' }}>{r}</span>)}
                      {selected.rarity === 'epic' && ['Редкий', 'Эпический', 'Легендарный'].map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: '999px', background: '#ffffff11', fontSize: '0.75rem' }}>{r}</span>)}
                      {selected.rarity === 'legendary' && ['Эпический', 'Легендарный'].map(r => <span key={r} style={{ padding: '2px 8px', borderRadius: '999px', background: '#ffffff11', fontSize: '0.75rem' }}>{r}</span>)}
                    </div>
                  </div>
                );
              })()}
                <button
                  disabled={actionLoading}
                  onClick={handleOpenLootbox}
                  style={{ marginTop: '1.25rem', width: '100%', padding: '0.75rem', background: `linear-gradient(135deg, ${rarityColors[selected.rarity]}cc, ${rarityColors[selected.rarity]}66)`, border: `1px solid ${rarityColors[selected.rarity]}`, borderRadius: 'var(--radius-lg)', color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.05em' }}
                >
                  {opening ? '✨ Открываем...' : '🎁 Открыть сундук'}
                </button>
              </div>
            ) : (
              /* ── Normal artifact UI ── */
              <>
                <div className={styles.detailStats}>
                  <div className={styles.detailRow}><span>Эффект</span><strong>{selected.effectLabel}</strong></div>
                  {selected.duration !== 'Постоянный' && <div className={styles.detailRow}><span>Длительность</span><strong>{selected.duration}</strong></div>}
                  {selected.expiresAt && <div className={styles.detailRow}><span>Осталось</span><strong style={{ color: new Date(selected.expiresAt) < new Date() ? 'var(--accent-hp)' : 'var(--accent-xp)' }}>{formatTimeLeft(selected.expiresAt)}</strong></div>}
                  {selected.charges > 0 && <div className={styles.detailRow}><span>Заряды</span><strong>{'⚡'.repeat(Math.min(selected.charges, 5))} {selected.charges}</strong></div>}
                  <div className={styles.detailRow}><span>Количество</span><strong>{selected.quantity}</strong></div>
                  <div className={styles.detailRow}><span>Источник</span><strong>{selected.source === 'drop' ? '🎲 Дроп' : selected.source === 'shop' ? '🛒 Магазин' : selected.source === 'reward' ? '🏆 Награда' : selected.source === 'teacher_gift' ? '🎁 Учитель' : selected.source}</strong></div>
                </div>

                {/* Action messages */}
                {actionMsg && <div style={{ color: '#4ade80', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem', fontWeight: 700 }}>{actionMsg}</div>}
                {actionError && <div style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem' }}>{actionError}</div>}

                <div className={styles.detailActions}>
                  {/* Consumable: "Apply" button */}
                  {selected.isConsumable && (
                    <button
                      className={styles.useBtn}
                      style={{ background: 'linear-gradient(135deg, #22c55ecc, #16a34a)' }}
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!selected || !user) return;
                        setActionLoading(true);
                        setActionError(null);
                        setActionMsg(null);
                        const result = await useConsumable(selected.id);
                        setActionLoading(false);
                        if (result.error) {
                          setActionError(result.error);
                        } else {
                          const msgs: Record<string, string> = {
                            hp_restore: `❤️ +${result.value} HP восстановлено!`,
                            xp_instant: `⚡ +${result.value} XP получено!`,
                            level_up: `🌟 Уровень повышен до ${result.value}!`,
                          };
                          setActionMsg(result.message || msgs[result.effect ?? ''] || '✅ Применено!');
                          setTimeout(() => { setSelected(null); setActionMsg(null); }, 2000);
                        }
                      }}
                    >
                      {actionLoading ? '⏳' : '🧪 Применить'}
                    </button>
                  )}

                  {/* Passive: Equip/Unequip button — locked if time-based and active */}
                  {!selected.isConsumable && (() => {
                    const timeLocked = selected.equipped && selected.expiresAt && !isExpired(selected.expiresAt);
                    if (timeLocked) {
                      return (
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                          padding: '0.6rem 1rem', borderRadius: 'var(--radius-lg)',
                          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                        }}>
                          <span style={{ fontSize: '1.1rem' }}>🔒</span>
                          <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 700 }}>
                            Активно — {formatTimeLeft(selected.expiresAt)}
                          </span>
                          <span style={{ fontSize: '0.68rem', opacity: 0.5, textAlign: 'center' }}>
                            Нельзя снять до истечения срока
                          </span>
                        </div>
                      );
                    }
                    return (
                      <button
                        className={styles.useBtn}
                        disabled={actionLoading}
                        onClick={async () => {
                          if (!selected || !user) return;
                          setActionLoading(true);
                          setActionError(null);
                          setActionMsg(null);
                          const result = await equipArtifact(selected.id, !selected.equipped);
                          setActionLoading(false);
                          if (result.error) {
                            setActionError(result.error);
                          } else {
                            setSelected(null);
                          }
                        }}
                      >
                        {actionLoading ? '⏳' : selected.equipped ? '🔄 Снять' : '⚡ Экипировать'}
                      </button>
                    );
                  })()}

                  <button
                    className={styles.sellBtn}
                    disabled={actionLoading}
                    onClick={async () => {
                      if (!selected || !user) return;
                      if (!window.confirm('Продать артефакт?')) return;
                      setActionLoading(true);
                      await sellArtifact(selected.id);
                      setActionLoading(false);
                      setSelected(null);
                    }}
                  >
                    💰 Продать
                  </button>
                </div>
              </>
            )}
            </>
          )}
          </div>
        )}
      </Modal>
    </div>
  );
}
