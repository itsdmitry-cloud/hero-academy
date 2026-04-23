/**
 * Alpha-Test Balance Simulation — pure logic module.
 *
 * Imported by `scripts/simulate-alpha-test.ts`.
 * Extracted into `src/` so Vitest can cover the deterministic math
 * (level curve, grade sampling, single-student simulation).
 *
 * Conventions:
 *   — MAX HP = 100 fixed (see CLAUDE.md «MAX HP = 100»)
 *   — Boss Damage = Final XP (see CLAUDE.md «Boss Damage = Final XP»)
 *   — xpPerLevel(L) = 1000 + L × 500 (см. src/lib/game/math.ts)
 *   — Economy multipliers expressed as absolute fractions (3.0 = 300%).
 *
 * Archetypes (CLAUDE.md):
 *   — Отличник: топ ~10%, максимум активности
 *   — Середняк: ~50%, средняя вовлечённость
 *   — Лентяй:   нижние ~20%, минимум активности
 *   — Кит:      скупает всё в магазине (моделируется через выше средний доход и
 *               бонус-поглощение 1 урона/день за счёт щитов, имитирующих покупки)
 */

import { cumulativeXpForLevel } from './math';

// ── Game constants ─────────────────────────────────────────────
export const MAX_HP = 100;
export const HP_REGEN_PER_DAY = 5;
export const SCHOOL_DAYS = 14;

// ── Alpha-test economy_config (spec 2026-04-22 §5) ─────────────
export const ECONOMY = {
  xp_multiplier:        3.0,   // 300%
  gold_multiplier:      2.5,   // 250%
  dmg_multiplier:       0.40,  // 40%
  drop_rate_multiplier: 1.20,  // 120%
  boss_hp_multiplier:   2.40,  // 240%
} as const;

export const BOSS_BASE_HP_PER_CLASS = 15_000;
export const BOSS_MAX_HP_PER_CLASS = Math.round(BOSS_BASE_HP_PER_CLASS * ECONOMY.boss_hp_multiplier); // 36_000

// ── Grade → base reward multipliers (spec §2) ──────────────────
export type Grade = 5 | 4 | 3 | 2 | 1;

export const GRADE_MULT: Record<Grade, number> = { 5: 1.0, 4: 0.8, 3: 0.5, 2: 0.2, 1: 0.0 };
export const GRADE_DMG:  Record<Grade, number> = { 5: 0,   4: 0,   3: 10,  2: 20,  1: 30 };

// ── Weighted mix of quest-template base values (spec §4.1) ─────
//  Домашка 60% (avg 125 XP) — смесь базовой (100) и сложной (200) ДЗ, ~(100+200)/2×bias
//  Проверочная 25% (150 XP)
//  Диктант 10% (200 XP)
//  Контрольная 5% (350 XP × 0.4 coefficient for harder grades)
export const AVG_BASE_XP   = 0.60 * 125 + 0.25 * 150 + 0.10 * 200 + 0.05 * 350 * 0.4;  // ≈ 135
export const AVG_BASE_GOLD = 0.60 * 65  + 0.25 * 60  + 0.10 * 80  + 0.05 * 130;        // ≈ 68.5

// Lootbox drop estimate per grade (spec §4.5 ≈ 3.4 drops per student per 14d)
export const LOOTBOX_DROP_CHANCE_PER_GRADE = 3.4 / 18; // ~0.19 chance per grade event

// ── Archetype definitions ──────────────────────────────────────
export interface Archetype {
  name: string;
  gradesPerDay: number;                  // expected grades per school day
  distribution: Record<Grade, number>;   // probability mass (sums to 1)
  shieldsPerDay?: number;                // optional: HP-damage absorbed/day (e.g. Кит buys shields)
  goldBonusPerDay?: number;              // optional: extra gold/day from shop use / gifts
}

export const ARCHETYPES: Archetype[] = [
  {
    name: 'Лентяй',
    gradesPerDay: 1.0,
    distribution: { 5: 0.05, 4: 0.10, 3: 0.35, 2: 0.35, 1: 0.15 },
  },
  {
    name: 'Середняк',
    gradesPerDay: 1.3,
    distribution: { 5: 0.10, 4: 0.20, 3: 0.55, 2: 0.12, 1: 0.03 },
  },
  {
    name: 'Отличник',
    gradesPerDay: 1.5,
    distribution: { 5: 0.55, 4: 0.30, 3: 0.12, 2: 0.02, 1: 0.01 },
  },
  {
    // Кит: средняя учёба, но много магазинной активности.
    // Моделируем закупку щитов (абсорб 5 HP/день) + получение золота извне
    // (донат/обмен), что изменит экономику в будущих балансах.
    name: 'Кит',
    gradesPerDay: 1.3,
    distribution: { 5: 0.15, 4: 0.25, 3: 0.50, 2: 0.08, 1: 0.02 },
    shieldsPerDay: 5,
    goldBonusPerDay: 100,
  },
];

// ── Level calculation ──────────────────────────────────────────
/**
 * Convert total XP to level using the canonical curve.
 * xpPerLevel(L) = 1000 + L × 500  =>  cumulativeXpForLevel(L) = (L-1) × (1000 + 250 × L)
 */
export function xpToLevel(totalXp: number): number {
  if (totalXp <= 0) return 1;
  for (let level = 1; level <= 100; level++) {
    if (totalXp < cumulativeXpForLevel(level + 1)) return level;
  }
  return 100;
}

// ── Grade sampler ──────────────────────────────────────────────
export function pickGrade(dist: Record<Grade, number>, rng: () => number): Grade {
  const r = rng();
  let cum = 0;
  // Iterate in fixed key order (5→1) so seeded rng is stable
  const keys: Grade[] = [5, 4, 3, 2, 1];
  for (const k of keys) {
    cum += dist[k];
    if (r < cum) return k;
  }
  return 1;
}

// ── Per-day grade count sampler (uses fractional expectation) ──
export function pickDailyGradeCount(expected: number, rng: () => number): number {
  const whole = Math.floor(expected);
  const frac  = expected - whole;
  return rng() < frac ? whole + 1 : whole;
}

// ── Single-student simulation ──────────────────────────────────
export interface SimResult {
  archetype: string;
  totalXp: number;
  level: number;
  seasonXp: number;            // capped at TOTAL_BP_XP in reporting, raw here
  goldEarned: number;
  finalHp: number;
  deaths: number;
  gradesReceived: number;
  lootboxesDropped: number;
  bossDamageContributed: number; // equals totalXp by design
}

export function simulateStudent(arch: Archetype, rng: () => number): SimResult {
  let totalXp = 0;
  let seasonXp = 0;
  let gold = 0;
  let hp = MAX_HP;
  let deaths = 0;
  let grades = 0;
  let lootboxes = 0;

  for (let day = 0; day < SCHOOL_DAYS; day++) {
    const n = pickDailyGradeCount(arch.gradesPerDay, rng);
    const shieldHpPerDay = arch.shieldsPerDay ?? 0;
    let shieldRemaining = shieldHpPerDay;

    for (let i = 0; i < n; i++) {
      const g = pickGrade(arch.distribution, rng);

      const baseXp   = AVG_BASE_XP   * GRADE_MULT[g];
      const baseGold = AVG_BASE_GOLD * GRADE_MULT[g];
      const rawDmg   = GRADE_DMG[g];

      const xpGained   = Math.round(baseXp   * ECONOMY.xp_multiplier);
      const goldGained = Math.round(baseGold * ECONOMY.gold_multiplier);
      let hpLost       = Math.round(rawDmg   * ECONOMY.dmg_multiplier);

      // Shield absorption (Кит-archetype-only)
      if (shieldRemaining > 0 && hpLost > 0) {
        const absorbed = Math.min(shieldRemaining, hpLost);
        hpLost -= absorbed;
        shieldRemaining -= absorbed;
      }

      totalXp += xpGained;
      seasonXp += xpGained;
      gold += goldGained;
      hp -= hpLost;

      // Lootbox drop chance (spec §4.5)
      if (rng() < LOOTBOX_DROP_CHANCE_PER_GRADE) lootboxes++;

      if (hp <= 0) {
        deaths++;
        hp = MAX_HP;
        // Death penalty: lose last XP gain (spec §3.4 «standard death mode»)
        seasonXp = Math.max(0, seasonXp - xpGained);
        totalXp  = Math.max(0, totalXp  - xpGained);
      }

      grades++;
    }

    // Extra gold from shop/external sources (Кит)
    gold += arch.goldBonusPerDay ?? 0;

    // Daily HP regeneration
    hp = Math.min(MAX_HP, hp + HP_REGEN_PER_DAY);
  }

  return {
    archetype: arch.name,
    totalXp,
    level: xpToLevel(totalXp),
    seasonXp,
    goldEarned: gold,
    finalHp: hp,
    deaths,
    gradesReceived: grades,
    lootboxesDropped: lootboxes,
    bossDamageContributed: totalXp, // Boss Damage = Final XP
  };
}

// ── Simple seeded RNG for reproducibility ──────────────────────
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
