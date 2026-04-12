'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StreakProgressBar } from '@/components/ui/StreakProgressBar';
import { useHeroStore } from '@/lib/store/heroStore';
import { xpProgress } from '@/lib/game/math';
import { useSupabaseSync } from '@/lib/hooks/use-supabase-sync';
import { useRealtimeHero } from '@/lib/hooks/use-realtime-hero';
import { useStreak } from '@/lib/hooks/use-streak';
import { useArtifacts, type ArtifactCatalog } from '@/lib/hooks/use-artifacts';
import { BattlePassWidget } from '@/components/game/BattlePassWidget';
import { AchievementsPanel } from '@/components/game/AchievementsPanel';
import { ClassAuraBanner } from '@/components/game/ClassAuraBanner';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

// ───────── Local types ─────────
// Only the fields we actually read in this file.

interface NewsItem {
  id: string;
  title: string;
  body: string;
  type: string;
  image_url: string | null;
  pinned: boolean;
  created_at: string;
  is_read: boolean;
}

// The artifact catalog shape in this file can also carry a seasonal pool
// tag (column exists in DB but not on ArtifactCatalog interface).
type ShelfArtifact = ArtifactCatalog & { season_pool?: string | null };

// Activity entries may carry a `category` discriminator attached by the
// sync layer (not part of the base ActivityEntry interface).
type ActivityItemView = {
  id: string;
  date: string;
  quest: string;
  result: string;
  xp: string;
  gold: string;
  messages?: string[];
  category?: 'quest' | 'boss' | string;
};

// Discriminated union describing one slot on the artifact shelf.
type ShelfSlot =
  | { kind: 'locked'; id: string; name: 'locked'; rarity: null; icon: string;
      equipped: false; defId: null; unlockLevel: number }
  | { kind: 'empty'; id: string; name: null; rarity: null; icon: null;
      equipped: false; defId: null }
  | { kind: 'equipped'; id: string; name: string; rarity: string; icon: string;
      equipped: true; defId: string; charges: number;
      artifact: ShelfArtifact; expiresAt: string | null };


function getArtifactIcon(defId: string) {
  if (defId.includes('shield')) return '🛡️';
  if (defId.includes('potion')) return '⚗️';
  if (defId.includes('pen')) return '✒️';
  if (defId.includes('pouch')) return '💰';
  if (defId.includes('orb')) return '🔮';
  if (defId.includes('candle')) return '🕯️';
  if (defId.includes('crown')) return '👑';
  if (defId.includes('cross')) return '✝️';
  return '💎';
}

const SHELF_EFFECT_LABELS: Record<string, (v: number) => string> = {
  xp_boost:       v => `+${v}% к XP`,
  damage_shield:  v => `−${v}% к урону ошибок`,
  damage_reduce:  v => `−${v}% к урону`,
  dmg_reduce:     v => `−${v}% к урону`,
  hp_restore:     v => `+${v} HP`,
  xp_instant:     v => `+${v} XP`,
  gold_boost:     v => `+${v}% к золоту`,
  gold_bonus:     v => `+${v}% к золоту`,
  extra_gold:     v => `+${v} золота`,
  death_save:     v => `Выживание при смерти (${v} HP)`,
  undo_crit:      () => 'Отмена смертельного удара',
  streak_protect: () => 'Иммунитет к потере стрика',
  skip_quest:     () => 'Пропуск ДЗ без потери HP',
  level_up:       () => '+1 уровень',
  passive_boss_dmg_multiplier: v => `Опыт +${v}%`,
  passive_damage_resist:       v => `Сопротивление урону ${v}%`,
  passive_gold_multiplier:     v => `Золото +${v}%`,
  auto_resurrect:              v => `Воскрешение (на ${v} HP)`,
  passive_hp_regen:            v => `+${v} HP в день`,
  passive_damage_reduction:    v => `−${v} к урону`,
  cosmetic:                    () => 'Украшение',
  skip_day:                    () => 'Пропуск ДЗ без потери HP',
  team_dmg_reduce:             v => `−${v}% урона классу`,
  team_xp:                     v => `+${v}% XP всему классу`,
  royal_set_piece:             () => 'Часть Королевского набора',
};
function shelfEffectLabel(effectStr: string, effectTypeStr: string, value: number): string {
  const combined = `${effectStr} ${effectTypeStr}`;
  for (const [key, fn] of Object.entries(SHELF_EFFECT_LABELS)) {
    if (combined.includes(key)) return fn(value);
  }
  return effectStr || effectTypeStr || '—';
}
function shelfTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'истёк';
  const h = Math.floor(diff / 3_600_000);
  return h < 24 ? `${h}ч` : `${Math.floor(h / 24)}д ${h % 24}ч`;
}

function formatStat(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString('ru-RU');
}

export default function HeroPage() {
  const { hero, activity, synced } = useHeroStore();
  const { equipArtifact, inventory: dbInventory, refetch: refetchArtifacts } = useArtifacts();
  const { profile } = useAuth();
  useSupabaseSync();
  useRealtimeHero();
  const { result: streakResult, showMilestone } = useStreak();

  // Hydration guard via useSyncExternalStore (avoids setState-in-effect).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Pin "now" at mount — React Compiler flags raw Date.now() during render as impure.
  const [nowMs] = useState(() => Date.now());
  const [selectedShelfItem, setSelectedShelfItem] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<Set<string>>(new Set());
  const [activityFilter, setActivityFilter] = useState<'all' | 'quest' | 'boss'>('all');

  // Active season name
  const [seasonName, setSeasonName] = useState<string | null>(null);

  // Live News State
  const [studentNews, setStudentNews] = useState<NewsItem[]>([]);
  const [showNews, setShowNews] = useState(false);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.from('seasons').select('name').eq('school_id', profile.school_id).eq('status', 'active').limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setSeasonName(data.name); });
    return () => { cancelled = true; };
  }, [profile?.school_id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/news');
        const d = await r.json();
        if (cancelled) return;
        if (d.success) setStudentNews(d.news || []);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const markNewsAsRead = async (newsId: string) => {
    setStudentNews(prev => prev.map(n => n.id === newsId ? { ...n, is_read: true } : n));
    try {
      await fetch('/api/news/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news_id: newsId })
      });
    } catch(e) { console.error('Failed to mark read', e) }
  };

  const toggleActivity = (id: string) => setExpandedActivity(prev => {
    const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next;
  });

  const setFilter = (f: 'all' | 'quest' | 'boss') => {
    setActivityFilter(f);
    setExpandedActivity(new Set());
  };

  const activityView = activity as ActivityItemView[];
  const filteredActivity = activityFilter === 'all' ? activityView
    : activityView.filter(item => item.category === activityFilter);

  if (!mounted) return null;

  if (!synced) {
    return (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
        <div style={{ height: 80, borderRadius: 16, background: 'var(--bg-glass)' }} />
        <div style={{ height: 120, borderRadius: 16, background: 'var(--bg-glass)' }} />
        <div style={{ height: 200, borderRadius: 16, background: 'var(--bg-glass)' }} />
      </div>
    );
  }

  const activeSlotsCount = hero.level >= 50 ? 6 : hero.level >= 40 ? 5 : hero.level >= 30 ? 4 : hero.level >= 20 ? 3 : hero.level >= 10 ? 2 : 1;
  const totalSlots = 6;
  const equippedItems = dbInventory.filter(i => i.is_equipped);
  
  const slotUnlockLevels = [1, 10, 20, 30, 40, 50];
  const shelfSlots: ShelfSlot[] = Array.from({ length: totalSlots }).map((_, i): ShelfSlot => {
    if (i >= activeSlotsCount) {
      return { kind: 'locked', id: `locked_${i}`, name: 'locked', rarity: null, icon: '🔒', equipped: false, defId: null, unlockLevel: slotUnlockLevels[i] };
    }
    const item = equippedItems[i];
    if (!item) {
      return { kind: 'empty', id: `empty_${i}`, name: null, rarity: null, icon: null, equipped: false, defId: null };
    }
    const artDef = item.artifact as ShelfArtifact | undefined;
    const icon = artDef?.icon || '💎';
    return {
      kind: 'equipped',
      id: item.id,
      name: artDef?.name || 'Unknown',
      rarity: artDef?.rarity || 'common',
      icon,
      equipped: true,
      charges: item.charges_remaining ?? 0,
      defId: item.artifact_id,
      // `artDef` may be undefined at runtime but the slot is still rendered;
      // downstream code guards via `selectedShelfObj.kind === 'equipped'`.
      artifact: (artDef ?? ({} as ShelfArtifact)),
      expiresAt: item.expires_at ?? null,
    };
  });

  const selectedShelfObj = selectedShelfItem ? shelfSlots.find(s => s.id === selectedShelfItem) : null;
  const unreadNewsCount = studentNews.filter(n => !n.is_read).length;

  return (
    <div className={styles.page}>
      {/* === CLASS ARTIFACT NOTIFICATION BANNERS === */}

      {showMilestone && streakResult?.bonus && (
        <div style={{
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: 'linear-gradient(135deg, #8b5cf6, #f59e0b)',
          borderRadius: 'var(--radius-xl)', padding: '1rem 2rem',
          boxShadow: '0 0 40px #8b5cf680', animation: 'slideDown 0.5s ease',
          textAlign: 'center', color: 'white', minWidth: '280px',
        }}>
          <div style={{ fontSize: '2rem' }}>🔥</div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{streakResult.bonus.milestone}-дневный стрик!</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            +{streakResult.bonus.xp} XP · +{streakResult.bonus.gold} 💰
          </div>
        </div>
      )}

      {/* === CLASS AURA BANNER === */}
      {hero.heroId && <ClassAuraBanner heroId={hero.heroId} />}

      {/* === HERO SECTION === */}
      <section className={styles.heroSection}>
        <div className={styles.avatarSide}>
          <div className={styles.frameWrapper}>
            <Image src="/assets/ui/avatar-frame.png" alt="" className={styles.frameImg} aria-hidden="true" width={200} height={200} />
            <div className={styles.avatarInner}>
              <Image
                src={`/assets/avatars/${hero.gender === 'female' ? 'f' : 'm'}_${Math.min(20, Math.max(1, Math.floor(hero.level / 5) + 1)).toString().padStart(2, '0')}.png`}
                alt="Hero Avatar"
                className={styles.heroAvatarImage}
                width={160}
                height={160}
              />
            </div>
          </div>
        </div>
        <div className={styles.statsSide}>
          <div className={styles.heroHeader}>
            <h1 className={`${styles.heroName} text-display`}>{hero.name}</h1>
            <div className={styles.heroClass}>
              <span>🏰</span> Класс 5-А · Гильдия «Драконы»
            </div>
          </div>
          <div className={styles.statCards}>
            <StatCard icon="⚡" label="XP" value={formatStat(hero.xp)} color="xp" />
            <StatCard icon="💛" label="Gold" value={formatStat(hero.gold)} color="gold" />
            <StatCard icon="❤️" label="HP" value={`${hero.hp}`} color="hp" trend={hero.hp < 30 ? 'LOW' : undefined} />
          </div>
          <div className={styles.bars}>
            <ProgressBar value={xpProgress(hero.xp, hero.level).current} max={xpProgress(hero.xp, hero.level).needed} color="xp" label={`Опыт (Ур. ${hero.level})`} showValue size="md" />
            <ProgressBar value={hero.hp} max={hero.hp_max} color="hp" label="Здоровье" showValue size="md" />
          </div>
          <div className={styles.infoTiles}>
            <div className={styles.infoTile}>
              <span className={styles.tileLabel}>Streak</span>
              <span className={styles.tileValue}>{hero.streak} 🔥</span>
            </div>
            <div className={styles.infoTile}>
              <span className={styles.tileLabel}>Ранг в классе</span>
              <span className={styles.tileValue}>#3</span>
            </div>
            <div className={styles.infoTile}>
              <span className={styles.tileLabel}>Уровень</span>
              <span className={styles.tileValue}>{hero.level} ⚡</span>
            </div>
            <div className={styles.infoTile}>
              <span className={styles.tileLabel}>Сезон</span>
              <span className={styles.tileValue}>{seasonName ?? '—'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* === STREAK PROGRESS === */}
      <StreakProgressBar currentStreak={hero.streak} bestStreak={hero.streak_best} />

      {/* === BATTLE PASS WIDGET === */}
      <section className={styles.section}>
        <BattlePassWidget
          seasonXp={hero.season_xp}
          heroId={hero.heroId}
          element="fire"
          onClaim={refetchArtifacts}
        />
      </section>

      {/* === ARTIFACT SHELF === */}
      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} text-display`}>Полка артефактов</h2>
        <div className={styles.artifactShelf}>
          {shelfSlots.map((artifact) => (
            <div
              key={artifact.id}
              className={`${styles.artifactSlot} ${artifact.equipped && artifact.rarity ? styles[`rarity_${artifact.rarity}`] : ''} ${artifact.name === 'locked' ? styles.lockedSlot : ''} ${!artifact.name ? styles.emptySlot : ''}`}
              onClick={() => artifact.equipped && setSelectedShelfItem(artifact.id)}
            >
              {artifact.icon ? (
                <span className={styles.artifactIcon}>
                  {artifact.icon.includes('/') ? <Image src={artifact.icon} alt="icon" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : artifact.icon}
                </span>
              ) : null}
              {artifact.kind === 'locked' && artifact.unlockLevel && (
                <span className={styles.artifactName} style={{ fontSize: '0.6rem', opacity: 0.5 }}>Лвл {artifact.unlockLevel}</span>
              )}
              {artifact.kind === 'equipped' && artifact.name && (
                <span className={styles.artifactName}>{artifact.name}</span>
              )}
              {artifact.kind === 'equipped' && artifact.charges > 0 && !String(artifact.artifact.effect ?? artifact.artifact.effect_type ?? '').includes('passive') && (
                <div className={styles.chargesBadge}>{artifact.charges}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {selectedShelfObj && selectedShelfObj.kind === 'equipped' && (
        <div className={styles.shelfOverlay} onClick={(e) => e.target === e.currentTarget && setSelectedShelfItem(null)}>
          <div className={styles.shelfDetail}>
            <div className={styles.shelfDetailIcon} style={{ fontSize: 56, width: 80, height: 80, margin: '0 auto' }}>
              {selectedShelfObj.icon?.includes('/') ? (
                <Image src={selectedShelfObj.icon} alt="icon" width={80} height={80} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                getArtifactIcon(selectedShelfObj.artifact.id) !== '💎' ? getArtifactIcon(selectedShelfObj.artifact.id) : (selectedShelfObj.artifact.icon || '💎')
              )}
            </div>
            <div className={styles.shelfDetailName}>{selectedShelfObj.artifact.name}</div>
            <div className={styles.shelfDetailRarity} style={{ color: selectedShelfObj.artifact.season_pool ? '#f97316' : selectedShelfObj.rarity === 'epic' ? '#a855f7' : selectedShelfObj.rarity === 'legendary' ? '#eab308' : selectedShelfObj.rarity === 'rare' ? '#3b82f6' : '#6b7280' }}>
              {selectedShelfObj.artifact.season_pool ? '🔥 Сезонный' : selectedShelfObj.rarity === 'common' ? '🟢 Обычный' : selectedShelfObj.rarity === 'rare' ? '🔵 Редкий' : selectedShelfObj.rarity === 'epic' ? '🟣 Эпический' : '🟡 Легендарный'}
            </div>
            <div className={styles.shelfDetailMeta}>
              {(selectedShelfObj.artifact.effect || selectedShelfObj.artifact.effect_type) && (
                <span style={{ color: 'var(--accent-xp)', fontWeight: 700 }}>
                  {shelfEffectLabel(selectedShelfObj.artifact.effect || '', selectedShelfObj.artifact.effect_type || '', selectedShelfObj.artifact.effect_value ?? 0)}
                </span>
              )}
              {/* Заряды ИЛИ время — не оба */}
              {selectedShelfObj.expiresAt ? (
                <span style={{ color: new Date(selectedShelfObj.expiresAt) < new Date() ? 'var(--accent-hp)' : 'var(--accent-gold)' }}>
                  ⏳ {shelfTimeLeft(selectedShelfObj.expiresAt)}
                </span>
              ) : ((selectedShelfObj.charges ?? 0) > 0) && !String(selectedShelfObj.artifact.effect ?? selectedShelfObj.artifact.effect_type ?? '').includes('passive') ? (
                <span>⚡ {selectedShelfObj.charges} зар{'.'}</span>
              ) : null}
              {!selectedShelfObj.artifact.effect && !selectedShelfObj.charges && !selectedShelfObj.expiresAt && <span>Ур. {selectedShelfObj.artifact.min_level || 1}</span>}
            </div>
            <div className={styles.shelfDetailActions}>
              {(() => {
                const expiresAt = selectedShelfObj.expiresAt;
                const isTimeLocked = expiresAt && new Date(expiresAt).getTime() > nowMs;
                if (isTimeLocked) {
                  return (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                      padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)',
                      background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                      width: '100%', textAlign: 'center',
                    }}>
                      <span style={{ fontSize: '1rem' }}>🔒 Активно</span>
                      <span style={{ fontSize: '0.76rem', color: '#fbbf24', fontWeight: 700 }}>{shelfTimeLeft(expiresAt)}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Нельзя снять до конца действия</span>
                    </div>
                  );
                }
                return (
                  <button
                    className={styles.shelfBtnUnequip}
                    onClick={async () => {
                      const result = await equipArtifact(selectedShelfItem!, false);
                      if (result?.error) alert(result.error);
                      else setSelectedShelfItem(null);
                    }}>
                    Снять с полки
                  </button>
                );
              })()}
              <button className={styles.shelfBtnClose} onClick={() => setSelectedShelfItem(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* === ACHIEVEMENTS === */}
      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} text-display`} style={{ marginBottom: '0.5rem' }}>Достижения</h2>
        <AchievementsPanel heroId={hero.heroId} />
      </section>

      {/* === ACTIVITY LOG === */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={`${styles.sectionTitle} text-display`}>Активность</h2>
          <div className={styles.filters}>
            {(['all', 'quest', 'boss'] as const).map(f => (
              <button key={f} className={`${styles.filterBtn} ${activityFilter === f ? styles.filterActive : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Все' : f === 'quest' ? 'Квесты' : 'Боссы'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredActivity.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.4 }}>Нет событий в этой категории</div>
          )}
          {filteredActivity.map((item) => {
            const isOpen = expandedActivity.has(item.id);
            const hasPipeline = item.messages && item.messages.length > 0;
            const isBoss = item.result?.includes('⚔️') || item.quest?.includes('🐉');
            const isDamage = item.result?.includes('⚠️');
            const isArtifact = item.quest?.includes('🎁');
            const accentColor = isBoss ? '#a78bfa' : isDamage ? '#f87171' : isArtifact ? '#60a5fa' : 'var(--accent-xp)';
            return (
              <div key={item.id} style={{ background: 'var(--bg-glass)', border: `1px solid ${isOpen ? accentColor : 'var(--bg-glass-border)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <div onClick={() => hasPipeline && toggleActivity(item.id)} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto auto', alignItems: 'center', gap: '8px', padding: '0.6rem 0.75rem', cursor: hasPipeline ? 'pointer' : 'default' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.date}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.quest}</span>
                  <span style={{ fontSize: '0.75rem', background: `${accentColor}22`, color: accentColor, padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.result}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-xp)', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>{item.xp !== '-' ? item.xp : ''}</span>
                  {hasPipeline && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>}
                </div>
                {isOpen && hasPipeline && (() => {
                  // Check for structured breakdown (quest_graded from grade-batch)
                  const bdMsg = item.messages!.find(m => m.startsWith('__breakdown:'));
                  if (bdMsg) {
                    let bd: Record<string, unknown>;
                    try { bd = JSON.parse(bdMsg.slice('__breakdown:'.length)); } catch { bd = {}; }
                    const xp   = bd.xp   as Record<string, unknown> | null;
                    const hp   = bd.hp   as Record<string, unknown> | null;
                    const gold = bd.gold as Record<string, unknown> | null;

                    const Row = ({ label, value, dim }: { label: string; value: string | number; dim?: boolean }) => (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', opacity: dim ? 0.6 : 1 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{label}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{value}</span>
                      </div>
                    );
                    const Divider = () => <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 0' }} />;
                    const colStyle: React.CSSProperties = {
                      flex: 1, display: 'flex', flexDirection: 'column', gap: '3px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px',
                    };

                    return (
                      <div style={{ borderTop: `1px solid ${accentColor}44`, padding: '0.7rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Row 1: XP | HP */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* XP Column */}
                          {xp && (
                            <div style={colStyle}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-xp)', marginBottom: '2px' }}>⭐ Опыт</span>
                              <Row label="Базовое" value={Number(xp.base)} />
                              <Row label={`Баланс ×${xp.balancePct}%`} value={`→ ${xp.afterBalance}`} dim />
                              {Boolean(xp.artBoost) && <Row label={`Арт. +${String(xp.artBoost)}%${Array.isArray(xp.artNames) && xp.artNames.length > 0 ? ` (${xp.artNames.map((n: string) => n.split(' (')[0]).join(', ')})` : ''}`} value={`→ ${String(xp.afterArt)}`} dim />}
                              <Row label={`Рандом ${Number(xp.randomPct) >= 0 ? '+' : ''}${xp.randomPct}%`} value={`→ ${xp.final}`} dim />
                              <Divider />
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-xp)' }}>Итого</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-xp)' }}>+{String(xp.final)} XP = ⚔️ Урон</span>
                              </div>
                            </div>
                          )}

                          {/* HP Column */}
                          {hp && (
                            <div style={colStyle}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f87171', marginBottom: '2px' }}>❤️ Урон</span>
                              {Number(hp.base) === 0 ? (
                                <>
                                  <Row label="Базовое" value={0} />
                                  <Divider />
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4ade80' }}>Итого</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4ade80' }}>-0 HP</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Row label="Базовое" value={Number(hp.base)} />
                                  <Row label={`Баланс ×${hp.balancePct}%`} value={`→ ${hp.afterBalance}`} dim />
                                  {hp.shield
                                    ? <><Row label="🛡️ Щит" value={String(hp.shield)} /><Row label="Заряд -1" value="Заблокировано" /></>
                                    : hp.passivePct
                                      ? <Row label={`Защита -${hp.passivePct}%`} value={`→ ${Math.round(Number(hp.afterBalance) * (1 - Number(hp.passivePct)/100))}`} dim />
                                      : null
                                  }
                                  {!hp.shield && <Row label={`Рандом ${Number(hp.randomPct) >= 0 ? '+' : ''}${hp.randomPct}%`} value={`→ ${hp.final}`} dim />}
                                  {Boolean(hp.undoCrit) && <><Row label="⏪ Отмена смерти" value={String(hp.undoCrit)} /><Row label="Заряд -1" value="Обнулён" /></>}
                                  {Boolean(hp.deathSaved) && <><Row label="🔥 Выживание" value={String(hp.deathSaved)} /><Row label="Заряд -1" value="Спасён" /></>}
                                  <Divider />
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f87171' }}>Итого</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: hp.shield || hp.undoCrit ? '#4ade80' : (hp.deathSaved ? '#fbbf24' : '#f87171') }}>
                                      {hp.shield ? '0 HP 🛡️' : (hp.undoCrit ? '0 HP ⏪' : (hp.deathSaved ? `Спасён 🔥` : `-${hp.final} HP`))}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Row 2: Gold */}
                        {gold && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {/* Gold Column */}
                            <div style={colStyle}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '2px' }}>💰 Золото</span>
                              <Row label="Базовое" value={Number(gold.base)} />
                              <Row label={`Баланс ×${gold.balancePct}%`} value={`→ ${gold.afterBalance}`} dim />
                              {Boolean(gold.artBoost) && <Row label={`Арт. +${String(gold.artBoost)}%${Array.isArray(gold.artNames) && gold.artNames.length > 0 ? ` (${gold.artNames.map((n: string) => n.split(' (')[0]).join(', ')})` : ''}`} value={`→ ${String(gold.final)}`} dim />}
                              <Divider />
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-gold)' }}>Итого</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-gold)' }}>+{String(gold.final)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Fallback: plain messages list (for old logs / other action types)
                  const statEmojis = ['⭐', '💰', '⚔️', '👑', '🗡️', '🆙', '🔥', '🏅', '✨', '⚗️', '🎁'];
                  const statLines = item.messages!.filter(m => statEmojis.some(e => m.startsWith(e)));
                  const pipeLines = item.messages!.filter(m => !statEmojis.some(e => m.startsWith(e)));
                  return (
                    <div style={{ borderTop: `1px solid ${accentColor}44`, padding: '0.6rem 0.75rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {statLines.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {statLines.map((m, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: '10px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, color: accentColor }}>{m}</span>)}
                        </div>
                      )}
                      {pipeLines.length > 0 && (
                        <>
                          {statLines.length > 0 && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {pipeLines.map((m, i) => {
                              const isTotal = m.startsWith('Итого') || m.includes('Финальный') || m.includes('Рандом');
                              return <span key={i} style={{ fontSize: isTotal ? '0.78rem' : '0.72rem', color: isTotal ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isTotal ? 700 : 400, lineHeight: 1.6, paddingLeft: '4px', borderLeft: isTotal ? `2px solid ${accentColor}` : '2px solid transparent' }}>{m}</span>;
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </section>

      {/* === NEWS === */}
      <section className={styles.section} style={{ marginBottom: '80px' }}>
        <div className={styles.sectionHeader} style={{ cursor: 'pointer' }} onClick={() => setShowNews(!showNews)}>
          <h2 className={`${styles.sectionTitle} text-display`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadNewsCount > 0 ? '🔔' : '📰'} Новости
            {unreadNewsCount > 0 && <span className={styles.newsBadge}>{unreadNewsCount}</span>}
          </h2>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{showNews ? '▲ Свернуть' : '▼ Развернуть'}</span>
        </div>
        
        {showNews && (
          <div className={styles.newsCards} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {studentNews.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Новостей пока нет</div>}
            
            {studentNews.map(n => {
              const isUnread = !n.is_read;
              const truncated = n.body.length > 100 ? n.body.slice(0, 100) + '…' : n.body;
              
              return (
                <div
                  key={n.id}
                  className={`${styles.newsItem} ${styles[`newsType_${n.type}`]} ${isUnread ? styles.newsUnread : ''}`}
                  onClick={() => {
                    setSelectedNewsId(n.id);
                    if (isUnread) markNewsAsRead(n.id);
                  }}
                  style={{
                    background: 'var(--bg-glass)', border: `1px solid ${isUnread ? 'var(--accent-xp)' : 'var(--bg-glass-border)'}`,
                    borderRadius: 'var(--radius-lg)', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    {n.image_url && (
                      <div style={{ flexShrink: 0, width: '60px', height: '60px', transition: 'all 0.3s', position: 'relative' }}>
                        <Image src={n.image_url} alt="" fill style={{ objectFit: 'cover', borderRadius: '8px' }} unoptimized />
                      </div>
                    )}
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-xp)' }} />}
                          {n.title}
                          {n.pinned && <span style={{ fontSize: '0.8rem' }}>📌</span>}
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {truncated}
                      </p>
                      
                      {n.body.length > 100 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-xp)', fontWeight: 600, marginTop: '4px' }}>Читать далее</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* News Modal Overlay */}
      {selectedNewsId && studentNews.find(n => n.id === selectedNewsId) && (() => {
        const modalNews = studentNews.find(n => n.id === selectedNewsId)!;
        return (
          <div className={styles.shelfOverlay} onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedNewsId(null);
          }}>
            <div className={styles.shelfDetail} style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'auto', maxHeight: '80vh' }}>
              {modalNews.image_url && (
                <div style={{ width: '100%', height: '200px', backgroundColor: '#000', position: 'relative' }}>
                  <Image src={modalNews.image_url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
                </div>
              )}
              <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.4rem' }}>{modalNews.title}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {new Date(modalNews.created_at).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {modalNews.body}
                </div>
              </div>
              <div style={{ padding: '1rem', borderTop: '1px solid var(--bg-glass-border)' }}>
                <button
                  onClick={() => setSelectedNewsId(null)}
                  style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add bottom padding buffer for the bottom tab bar */}
      <div style={{ height: '20px' }} />
    </div>
  );
}

