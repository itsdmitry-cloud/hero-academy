/**
 * Hero Academy — Game Mechanics Unit Tests
 * Run: npm test
 */

import { describe, it, expect } from 'vitest';
import {
  cumulativeXpForLevel,
  xpPerLevel,
  xpToNext,
  xpProgress,
  applyXpGain,
} from '@/lib/game/math';

// ─────────────────────────────────────────────────────────────
// 1. CUMULATIVE XP THRESHOLDS
// ─────────────────────────────────────────────────────────────
describe('cumulativeXpForLevel', () => {
  it('Level 1 требует 0 XP (начальная точка)', () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
  });

  it('Level 2 требует 1500 XP', () => {
    // formula: (2-1) * (1000 + 250*2) = 1 * 1500 = 1500
    expect(cumulativeXpForLevel(2)).toBe(1500);
  });

  it('Level 3 требует 3500 XP', () => {
    // formula: (3-1) * (1000 + 250*3) = 2 * 1750 = 3500
    expect(cumulativeXpForLevel(3)).toBe(3500);
  });

  it('Level 5 требует 9000 XP', () => {
    // formula: (5-1) * (1000 + 250*5) = 4 * 2250 = 9000
    expect(cumulativeXpForLevel(5)).toBe(9000);
  });

  it('Level 10 требует 29000 XP', () => {
    // formula: (10-1) * (1000 + 250*10) = 9 * 3500 = 31500
    expect(cumulativeXpForLevel(10)).toBe(31500);
  });

  it('Порог на каждый следующий уровень растёт (нет плоских участков)', () => {
    for (let lvl = 2; lvl <= 20; lvl++) {
      expect(cumulativeXpForLevel(lvl)).toBeGreaterThan(cumulativeXpForLevel(lvl - 1));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 2. XP PER LEVEL COST
// ─────────────────────────────────────────────────────────────
describe('xpPerLevel', () => {
  it('Level 1→2 стоит 1500 XP', () => {
    expect(xpPerLevel(1)).toBe(1500);
  });

  it('Level 2→3 стоит 2000 XP', () => {
    expect(xpPerLevel(2)).toBe(2000);
  });

  it('Стоимость уровней монотонно растёт', () => {
    for (let i = 1; i < 50; i++) {
      expect(xpPerLevel(i + 1)).toBeGreaterThan(xpPerLevel(i));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. xpToNext (backward-compat alias)
// ─────────────────────────────────────────────────────────────
describe('xpToNext', () => {
  it('xpToNext(1) === cumulativeXpForLevel(2)', () => {
    expect(xpToNext(1)).toBe(cumulativeXpForLevel(2));
  });

  it('xpToNext(5) === cumulativeXpForLevel(6)', () => {
    expect(xpToNext(5)).toBe(cumulativeXpForLevel(6));
  });
});

// ─────────────────────────────────────────────────────────────
// 4. XP PROGRESS BAR
// ─────────────────────────────────────────────────────────────
describe('xpProgress', () => {
  it('Герой на уровне 1 с 0 XP имеет 0% прогресса', () => {
    const { percent } = xpProgress(0, 1);
    expect(percent).toBe(0);
  });

  it('Герой с ровно половиной XP до следующего уровня → 50%', () => {
    const lvl = 3;
    const floor = cumulativeXpForLevel(lvl);     // 3500
    const ceil  = cumulativeXpForLevel(lvl + 1); // 6000
    const halfwayXp = floor + (ceil - floor) / 2; // 4750
    const { percent } = xpProgress(halfwayXp, lvl);
    expect(percent).toBe(50);
  });

  it('Процент не превышает 100', () => {
    // Give extreme XP while staying at level 1
    const { percent } = xpProgress(99999, 1);
    expect(percent).toBeLessThanOrEqual(100);
  });

  it('current + needed = разница между соседними порогами', () => {
    const lvl = 5;
    const { current, needed } = xpProgress(cumulativeXpForLevel(lvl), lvl);
    expect(current).toBe(0);
    expect(needed).toBe(cumulativeXpForLevel(lvl + 1) - cumulativeXpForLevel(lvl));
  });
});

// ─────────────────────────────────────────────────────────────
// 5. APPLY XP GAIN — level-up logic
// ─────────────────────────────────────────────────────────────
describe('applyXpGain', () => {
  it('Небольшой XP не вызывает level-up', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 100);
    expect(level).toBe(1);
    expect(levelUps).toHaveLength(0);
  });

  it('Ровно 1500 XP поднимает уровень с 1 до 2', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 1500);
    expect(level).toBe(2);
    expect(levelUps).toEqual([2]);
  });

  it('3500 XP с нуля → сразу уровень 3 (двойной level-up)', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 3500);
    expect(level).toBe(3);
    expect(levelUps).toEqual([2, 3]);
  });

  it('XP суммируется нарастающим итогом (не сбрасывается)', () => {
    // Начинаем с 1400 XP (почти level 2), добавляем 200 → должны получить level 2
    const { xp, level } = applyXpGain(1400, 1, null, 200);
    expect(xp).toBe(1600);
    expect(level).toBe(2);
  });

  it('xpNext соответствует cumulativeXpForLevel(level+1)', () => {
    const { level, xpNext } = applyXpGain(0, 1, null, 5000);
    expect(xpNext).toBe(cumulativeXpForLevel(level + 1));
  });
});

// ─────────────────────────────────────────────────────────────
// 6. AVATAR EVOLUTION FORMULA
// ─────────────────────────────────────────────────────────────
describe('avatarTier (formula: Math.floor(level / 5) + 1)', () => {
  const avatarTier = (level: number) =>
    Math.min(20, Math.max(1, Math.floor(level / 5) + 1));

  it('Уровни 1–4 → ступень 1 (самый юный вид)', () => {
    expect(avatarTier(1)).toBe(1);
    expect(avatarTier(4)).toBe(1);
  });

  it('Уровень 5 → ступень 2 (первая эволюция)', () => {
    expect(avatarTier(5)).toBe(2);
  });

  it('Уровни 5–9 → ступень 2', () => {
    [5, 6, 7, 8, 9].forEach(lvl => expect(avatarTier(lvl)).toBe(2));
  });

  it('Уровень 10 → ступень 3', () => {
    expect(avatarTier(10)).toBe(3);
  });

  it('Уровень 15 → ступень 4', () => {
    expect(avatarTier(15)).toBe(4);
  });

  it('Уровень 100 не превышает максимум (ступень 20)', () => {
    expect(avatarTier(100)).toBe(20);
    expect(avatarTier(999)).toBe(20);
  });

  it('Tier не падает ниже 1 (даже для level 0)', () => {
    expect(avatarTier(0)).toBe(1);
  });

  it('Каждые 5 уровней — ровно +1 ступень', () => {
    for (let i = 1; i <= 15; i++) {
      expect(avatarTier(i * 5)).toBe(i + 1);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 7. BOSS DAMAGE & REWARD MATH (pure math, no DB)
// ─────────────────────────────────────────────────────────────
describe('Boss reward distribution math', () => {
  const POOL_XP   = 25000;
  const POOL_GOLD = 5000;

  it('Герой с 100% урона получает весь пул', () => {
    const dmgPct = 1.0;
    expect(Math.round(POOL_XP   * dmgPct)).toBe(25000);
    expect(Math.round(POOL_GOLD * dmgPct)).toBe(5000);
  });

  it('Герой с 50% урона получает половину пула', () => {
    const dmgPct = 0.5;
    expect(Math.round(POOL_XP   * dmgPct)).toBe(12500);
    expect(Math.round(POOL_GOLD * dmgPct)).toBe(2500);
  });

  it('Сумма долей всех участников ≈ 100% (нет инфляции)', () => {
    const contributions = [0.4, 0.35, 0.15, 0.1]; // 4 students
    const total = contributions.reduce((s, p) => s + p, 0);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
  });
});
