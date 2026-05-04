import { describe, expect, test } from 'vitest';
import {
  buildSeasonPassTiers,
  getCurrentBPTier,
  getBPProgress,
  MAX_BP_TIER,
  TOTAL_BP_XP,
} from '../seasonPassConfig';

describe('Alpha-test Battle Pass (15 tiers)', () => {
  test('has exactly 15 tiers', () => {
    const tiers = buildSeasonPassTiers('fire');
    expect(tiers).toHaveLength(15);
    expect(MAX_BP_TIER).toBe(15);
  });

  test('total XP is 25000 (alpha-test v2 май 2026 — пороги ×5)', () => {
    expect(TOTAL_BP_XP).toBe(25000);
  });

  test('cumulative XP thresholds (alpha-test v2 — base ×5)', () => {
    const tiers = buildSeasonPassTiers('fire');
    const expected = [1000, 2000, 3000, 4000, 5000, 6750, 8500, 10250, 12000, 13750, 16000, 18250, 20500, 22750, 25000];
    expect(tiers.map(t => t.xpRequired)).toEqual(expected);
  });

  test('milestones at tiers 5, 10, 15', () => {
    const tiers = buildSeasonPassTiers('fire');
    expect(tiers[4].isMilestone).toBe(true);
    expect(tiers[9].isMilestone).toBe(true);
    expect(tiers[14].isMilestone).toBe(true);
    expect(tiers[0].isMilestone).toBeFalsy();
  });

  test('tier 5 has seasonal chest + 200 gold', () => {
    const tier5 = buildSeasonPassTiers('fire')[4];
    expect(tier5.rewards).toEqual(expect.arrayContaining([
      { type: 'lootbox' },
      { type: 'gold', amount: 200 },
    ]));
  });

  test('tier 10 has chest + 500 gold + emblem collectible', () => {
    const tier10 = buildSeasonPassTiers('fire')[9];
    const types = tier10.rewards.map(r => r.type);
    expect(types).toContain('lootbox');
    expect(types).toContain('gold');
    expect(types).toContain('collectible');
    expect(tier10.rewards.find(r => r.type === 'gold')?.amount).toBe(500);
  });

  test('tier 15 has relic + 1000 gold + chest', () => {
    const tier15 = buildSeasonPassTiers('fire')[14];
    const types = tier15.rewards.map(r => r.type);
    expect(types).toContain('collectible');
    expect(types).toContain('lootbox');
    expect(types).toContain('gold');
    expect(tier15.rewards.find(r => r.type === 'gold')?.amount).toBe(1000);
  });

  test('getCurrentBPTier returns correct tier (alpha v2 thresholds)', () => {
    expect(getCurrentBPTier(0)).toBe(0);
    expect(getCurrentBPTier(999)).toBe(0);
    expect(getCurrentBPTier(1000)).toBe(1);
    expect(getCurrentBPTier(5000)).toBe(5);
    expect(getCurrentBPTier(25000)).toBe(15);
    expect(getCurrentBPTier(50000)).toBe(15);
  });

  test('getBPProgress caps at tier 15', () => {
    const progress = getBPProgress(50000);
    expect(progress.currentTier).toBe(15);
  });

  test('fire element name rendering', () => {
    const tier10 = buildSeasonPassTiers('fire')[9];
    const collectible = tier10.rewards.find(r => r.type === 'collectible');
    expect(collectible?.collectibleName).toContain('🔥');
  });
});
