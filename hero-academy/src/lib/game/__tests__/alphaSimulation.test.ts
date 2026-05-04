import { describe, expect, test } from 'vitest';
import {
  xpToLevel,
  pickGrade,
  simulateStudent,
  seededRng,
  ARCHETYPES,
  type Grade,
} from '../alphaSimulation';

describe('alphaSimulation — pure functions', () => {
  test('xpToLevel: 0 XP → Level 1', () => {
    expect(xpToLevel(0)).toBe(1);
  });

  test('xpToLevel: exactly 750 XP → Level 2 (alpha v2 — кривая урезана вдвое)', () => {
    // cumulativeXpForLevel(2) = 1 × (500 + 250) = 750
    expect(xpToLevel(749)).toBe(1);
    expect(xpToLevel(750)).toBe(2);
  });

  test('xpToLevel: 1750 XP → Level 3 (750 + 1000)', () => {
    expect(xpToLevel(1749)).toBe(2);
    expect(xpToLevel(1750)).toBe(3);
  });

  test('xpToLevel: 3000 XP → Level 4 (750 + 1000 + 1250)', () => {
    expect(xpToLevel(2999)).toBe(3);
    expect(xpToLevel(3000)).toBe(4);
  });

  test('xpToLevel: 4500 XP → Level 5', () => {
    expect(xpToLevel(4500)).toBe(5);
  });

  test('xpToLevel: caps at reasonable upper bound (huge XP)', () => {
    const lvl = xpToLevel(10_000_000);
    expect(lvl).toBeGreaterThanOrEqual(20);
    expect(lvl).toBeLessThanOrEqual(100);
  });

  test('pickGrade: distribution sums to 1 is respected (deterministic edges)', () => {
    const dist: Record<Grade, number> = { 5: 0.2, 4: 0.2, 3: 0.2, 2: 0.2, 1: 0.2 };
    // rng returning 0 → first key (5)
    expect(pickGrade(dist, () => 0)).toBe(5);
    // rng returning 0.99 → last key (1)
    expect(pickGrade(dist, () => 0.99)).toBe(1);
  });

  test('pickGrade: mid-range rng hits middle bucket', () => {
    const dist: Record<Grade, number> = { 5: 0.1, 4: 0.1, 3: 0.6, 2: 0.1, 1: 0.1 };
    // 0.5 falls inside the "3" bucket (cumulative 0.1+0.1+0.6=0.8)
    expect(pickGrade(dist, () => 0.5)).toBe(3);
  });

  test('ARCHETYPES: all 4 archetypes defined (Лентяй/Середняк/Отличник/Кит)', () => {
    expect(ARCHETYPES).toHaveLength(4);
    const names = ARCHETYPES.map(a => a.name);
    expect(names).toContain('Лентяй');
    expect(names).toContain('Середняк');
    expect(names).toContain('Отличник');
    expect(names).toContain('Кит');
  });

  test('ARCHETYPES: distributions sum to ~1.0', () => {
    for (const arch of ARCHETYPES) {
      const sum = Object.values(arch.distribution).reduce((s, p) => s + p, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  test('simulateStudent: Отличник reaches at least Level 3 with top XP', () => {
    const otlichnik = ARCHETYPES.find(a => a.name === 'Отличник')!;
    // Seeded rng for reproducibility — shared LCG from alphaSimulation
    const rng = seededRng(42);
    const result = simulateStudent(otlichnik, rng);
    expect(result.level).toBeGreaterThanOrEqual(3);
    expect(result.totalXp).toBeGreaterThan(1750); // alpha v2 — Lv 3 порог снижен
    expect(result.gradesReceived).toBeGreaterThan(10);
  });

  test('simulateStudent: Лентяй has more HP damage / deaths than Отличник (on average)', () => {
    const lentyai = ARCHETYPES.find(a => a.name === 'Лентяй')!;
    const otlichnik = ARCHETYPES.find(a => a.name === 'Отличник')!;

    let lentyaiDeaths = 0;
    let otlichnikDeaths = 0;
    for (let seed = 1; seed <= 20; seed++) {
      lentyaiDeaths += simulateStudent(lentyai, seededRng(seed)).deaths;
      otlichnikDeaths += simulateStudent(otlichnik, seededRng(seed + 1000)).deaths;
    }
    // Лентяй must die more often than Отличник across a sample of 20 runs
    expect(lentyaiDeaths).toBeGreaterThanOrEqual(otlichnikDeaths);
  });

  test('simulateStudent: bossDamageContributed equals totalXp', () => {
    const arch = ARCHETYPES[0];
    const rng = seededRng(7);
    const result = simulateStudent(arch, rng);
    expect(result.bossDamageContributed).toBe(result.totalXp);
  });
});
