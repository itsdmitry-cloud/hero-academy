import { describe, it, expect } from 'vitest';
import { calculateBossHp, weeksBetween } from '../boss-hp';

describe('calculateBossHp', () => {
  it('computes hp from students × 3 × weeks × 20', () => {
    // 20 students * 3 lessons/week * 10 weeks * 20 dmg = 12 000
    expect(calculateBossHp({ studentCount: 20, seasonWeeks: 10 })).toBe(12_000);
  });

  it('uses default class size (10) when student count is 0', () => {
    // 10 * 3 * 15 * 20 = 9 000
    expect(calculateBossHp({ studentCount: 0, seasonWeeks: 15 })).toBe(9_000);
  });

  it('uses default class size when student count is null/undefined', () => {
    expect(calculateBossHp({ studentCount: null, seasonWeeks: 15 })).toBe(9_000);
    expect(calculateBossHp({ studentCount: undefined, seasonWeeks: 15 })).toBe(9_000);
  });

  it('uses default season length (15 weeks) when weeks is 0/null', () => {
    // 20 * 3 * 15 * 20 = 18 000
    expect(calculateBossHp({ studentCount: 20, seasonWeeks: 0 })).toBe(18_000);
    expect(calculateBossHp({ studentCount: 20, seasonWeeks: null })).toBe(18_000);
  });

  it('enforces minimum hp of 1000 to avoid trivially-killable bosses', () => {
    // 1 * 3 * 1 * 20 = 60, clamped to 1000
    expect(calculateBossHp({ studentCount: 1, seasonWeeks: 1 })).toBe(1_000);
  });

  it('full fallback (both inputs missing) gives the reference ~9000 hp boss', () => {
    expect(calculateBossHp({ studentCount: null, seasonWeeks: null })).toBe(9_000);
  });
});

describe('weeksBetween', () => {
  it('counts full weeks between two ISO dates', () => {
    expect(weeksBetween('2026-01-01T00:00:00Z', '2026-04-02T00:00:00Z')).toBe(13);
  });

  it('accepts Date instances directly', () => {
    const starts = new Date('2026-01-01T00:00:00Z');
    const ends = new Date('2026-01-15T00:00:00Z');
    expect(weeksBetween(starts, ends)).toBe(2);
  });

  it('returns at least 1 for same-day or reversed ranges', () => {
    expect(weeksBetween('2026-01-01', '2026-01-01')).toBe(1);
    expect(weeksBetween('2026-02-01', '2026-01-01')).toBe(1);
  });
});
