'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Modal } from '@/components/ui/Modal';
import {
  buildSeasonPassTiers,
  getBPProgress,
  getRewardIcon,
  getRewardLabel,
  SEASON_ELEMENTS,
  MAX_BP_TIER,
  TOTAL_BP_XP,
  type SeasonElement,
} from '@/lib/game/seasonPassConfig';

/* ── Styles (inline for now) ── */
const RARITY_GLOW: Record<string, string> = {
  gold: '#f59e0b',
  lootbox: '#a855f7',
  artifact: '#60a5fa',
  collectible: '#22c55e',
};

interface BattlePassWidgetProps {
  seasonXp: number;
  heroId: string;
  /** Current season element — defaults to 'fire' */
  element?: SeasonElement;
  onClaim?: () => void;
}

export function BattlePassWidget({ seasonXp, heroId, element = 'fire', onClaim }: BattlePassWidgetProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [claimedTiers, setClaimedTiers] = useState<Set<number>>(new Set());
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimResult, setClaimResult] = useState<{ tier: number; granted: string[] } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const el = SEASON_ELEMENTS[element];
  const tiers = buildSeasonPassTiers(element);
  const progress = getBPProgress(seasonXp);

  // Load claimed tiers
  const loadClaimed = useCallback(async () => {
    if (!heroId) return;
    const { data } = await supabase
      .from('hero_season_rewards')
      .select('tier')
      .eq('hero_id', heroId);
    if (data) setClaimedTiers(new Set((data as { tier: number }[]).map((r) => r.tier)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroId]);

  useEffect(() => { loadClaimed(); }, [loadClaimed]);

  const handleClaim = async (tier: number) => {
    if (!user) return;
    setClaiming(tier);
    setClaimResult(null);
    setClaimError(null);
    try {
      const res = await fetch('/api/game/claim-pass-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tier, element }),
      });
      const data = await res.json();
      if (data.success) {
        setClaimedTiers(prev => new Set([...prev, tier]));
        setClaimResult({ tier, granted: data.granted });
        onClaim?.();
      } else {
        setClaimError(data.error ?? 'Не удалось забрать награду');
      }
    } catch {
      setClaimError('Ошибка сети. Попробуй ещё раз.');
    } finally {
      setClaiming(null);
    }
  };

  const unclaimedCount = tiers.filter(t => t.xpRequired <= seasonXp && !claimedTiers.has(t.tier)).length;

  return (
    <>
      {/* ── Compact Widget ── */}
      <div
        onClick={() => { setShowModal(true); loadClaimed(); }}
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer bg on unclaimed */}
        {unclaimedCount > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(245,158,11,0.08))',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Image src={`/assets/artifacts/chest_v3_${element}.png`} alt="chest" width={44} height={44} style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))', zIndex: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                {el.label} · Уровень {progress.currentTier}/{MAX_BP_TIER}
              </span>
              {unclaimedCount > 0 && (
                <span style={{
                  background: 'linear-gradient(135deg, #a855f7, #f59e0b)',
                  color: '#fff', fontWeight: 900, fontSize: '0.7rem',
                  padding: '2px 8px', borderRadius: '999px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  🎁 {unclaimedCount}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${el.emoji === '🔥' ? '#ef4444' : el.emoji === '❄️' ? '#3b82f6' : el.emoji === '🌿' ? '#22c55e' : '#6366f1'}, #a855f7)`,
                width: `${progress.currentTier >= MAX_BP_TIER ? 100 : Math.max(2, (seasonXp / TOTAL_BP_XP) * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {progress.currentTier < MAX_BP_TIER
                  ? `${progress.xpInTier}/${progress.xpForTier} XP до следующего`
                  : '✅ Пропуск пройден!'
                }
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {seasonXp.toLocaleString()} / {TOTAL_BP_XP.toLocaleString()} XP
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Modal ── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setClaimResult(null); }} title={<span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Image src={`/assets/artifacts/chest_v3_${element}.png`} width={24} height={24} alt="" /> {el.label} • Боевой Пропуск</span>} size="md">
        <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '0.25rem' }}>
          {/* Claim error toast */}
          {claimError && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem 1rem', marginBottom: '0.75rem',
              textAlign: 'center', animation: 'slideDown 0.3s ease',
            }}>
              <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '1rem' }}>Ошибка</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {claimError}
              </div>
            </div>
          )}

          {/* Claim result toast */}
          {claimResult && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem 1rem', marginBottom: '0.75rem',
              textAlign: 'center', animation: 'slideDown 0.3s ease',
            }}>
              <div style={{ fontWeight: 900, color: '#22c55e', fontSize: '1rem' }}>🎉 Награда получена!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {claimResult.granted.join(' · ')}
              </div>
            </div>
          )}

          {tiers.map((tier) => {
            const isUnlocked = seasonXp >= tier.xpRequired;
            const isClaimed = claimedTiers.has(tier.tier);
            const canClaim = isUnlocked && !isClaimed;
            const isClaiming = claiming === tier.tier;

            return (
              <div
                key={tier.tier}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: tier.isMilestone ? '0.7rem 0.6rem' : '0.5rem 0.6rem',
                  marginBottom: '4px',
                  background: isClaimed ? 'rgba(34,197,94,0.06)' : canClaim ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${canClaim ? '#a855f788' : isClaimed ? '#22c55e33' : 'transparent'}`,
                  borderRadius: 'var(--radius-lg)',
                  opacity: isUnlocked ? 1 : 0.45,
                  transition: 'all 0.2s',
                }}
              >
                {/* Tier number */}
                <div style={{
                  width: tier.isMilestone ? 36 : 28, height: tier.isMilestone ? 36 : 28,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: tier.isMilestone ? '0.85rem' : '0.75rem',
                  background: isClaimed ? '#22c55e33' : tier.isMilestone ? '#a855f733' : 'rgba(255,255,255,0.06)',
                  color: isClaimed ? '#22c55e' : tier.isMilestone ? '#a855f7' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}>
                  {isClaimed ? '✓' : tier.tier}
                </div>

                {/* Reward info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {tier.rewards.map((r, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: tier.isMilestone ? '0.85rem' : '0.8rem',
                        fontWeight: tier.isMilestone ? 800 : 600,
                        color: isClaimed ? 'var(--text-secondary)' : (RARITY_GLOW[r.type] ?? 'var(--text-primary)'),
                      }}>
                        {r.type === 'lootbox' ? (
                          <Image src={`/assets/artifacts/chest_v3_${element}.png`} width={18} height={18} style={{ objectFit: 'contain' }} alt="Chest" />
                        ) : (
                          getRewardIcon(r, element)
                        )}
                        <span>{getRewardLabel(r, element)}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {tier.xpRequired.toLocaleString()} XP
                  </div>
                </div>

                {/* Claim button */}
                <div style={{ flexShrink: 0 }}>
                  {isClaimed ? (
                    <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 700 }}>✅</span>
                  ) : canClaim ? (
                    <button
                      disabled={isClaiming}
                      onClick={(e) => { e.stopPropagation(); handleClaim(tier.tier); }}
                      style={{
                        background: 'linear-gradient(135deg, #a855f7cc, #8b5cf6)',
                        border: 'none', borderRadius: 'var(--radius-lg)',
                        color: '#fff', fontWeight: 800, fontSize: '0.75rem',
                        padding: '6px 14px', cursor: 'pointer',
                        animation: 'pulse 2s ease-in-out infinite',
                      }}
                    >
                      {isClaiming ? '⏳' : '🎁 Забрать'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>🔒</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
