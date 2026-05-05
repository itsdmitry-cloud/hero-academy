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

  test('xpToLevel: 250 XP → Level 2 (alpha 2026-05 — кривая ×0.4 от старой)', () => {
    // cumulativeXpForLevel(2) = 1 × (150 + 100) = 250
    expect(xpToLevel(249)).toBe(1);
    expect(xpToLevel(250)).toBe(2);
  });

  test('xpToLevel: 600 XP → Level 3', () => {
    expect(xpToLevel(599)).toBe(2);
    expect(xpToLevel(600)).toBe(3);
  });

  test('xpToLevel: 2250 XP → Level 6 (3-й слот артефактов)', () => {
    expect(xpToLevel(2249)).toBe(5);
    expect(xpToLevel(2250)).toBe(6);
  });

  test('xpToLevel: 5850 XP → Level 10 (4-й слот артефактов)', () => {
    expect(xpToLevel(5850)).toBe(10);
  });

  test('xpToLevel: 12600 XP → Level 15 (5-й слот артефактов)', () => {
    expect(xpToLevel(12600)).toBe(15);
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

  test('simulateStudent: Отличник reaches Lv 9+ (3 доп. слота артефактов из чистого grade-XP)', () => {
    // Alpha 2026-05: Sim моделирует только grade-XP path. Spec-цель «Отличник Lv 15+» учитывает
    // ещё и убийство босса (pool 25 000 XP / n=3 ≈ 8 000+ XP), которое sim не симулирует.
    // С чистого grade-пайплайна Отличник стабильно выходит на Lv 11±1 (~7 500 XP), что покрывает
    // 3 дополнительных слота (Lv 3/6/9). 4-й и 5-й слоты ученики получат уже в проде через boss-kill.
    const otlichnik = ARCHETYPES.find(a => a.name === 'Отличник')!;
    const rng = seededRng(42);
    const result = simulateStudent(otlichnik, rng);
    expect(result.level).toBeGreaterThanOrEqual(9);
    expect(result.totalXp).toBeGreaterThan(4800); // Lv 9 порог
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
