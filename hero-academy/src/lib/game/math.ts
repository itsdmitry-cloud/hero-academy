/**
 * Pure game math — no Supabase, no network.
 * Imported by API routes AND unit tests alike.
 *
 * Source of truth for all level / XP / avatar calculations.
 */

// ─── Game Invariants ─────────────────────────────────────────

/**
 * MAX HP = 100 fixed for all levels (see CLAUDE.md «MAX HP = 100»).
 * Potions do NOT scale with level. Shared invariant for runtime code,
 * simulations and tests.
 */
export const MAX_HP = 100;

// ─── Level / XP ──────────────────────────────────────────────

/** XP cost for ONE level (e.g. level 1→2 costs 1500) */
export function xpPerLevel(level: number): number {
  return 1000 + level * 500;
}

/** Total cumulative XP needed to REACH a given level.
 *  cumulativeXpForLevel(1) = 0, cumulativeXpForLevel(2) = 1500, etc. */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (1000 + 250 * level);
}

/** Backward-compat alias: XP threshold to reach level+1 */
export function xpToNext(level: number): number {
  return cumulativeXpForLevel(level + 1);
}

/** UI helper: compute progress bar values from total XP and level */
export function xpProgress(totalXp: number, level: number) {
  const floorXp = cumulativeXpForLevel(level);
  const ceilXp  = cumulativeXpForLevel(level + 1);
  const current = totalXp - floorXp;
  const needed  = ceilXp - floorXp;
  return {
    current,
    needed,
    percent: needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 0,
  };
}

/**
 * Apply XP gain (cumulative — never resets).
 * Returns { xp, level, xpNext, levelUps }
 */
export function applyXpGain(
  currentXp: number,
  currentLevel: number,
  _currentXpNext: number | null,
  xpGain: number,
) {
  const xp = currentXp + xpGain;
  let level = currentLevel;
  const levelUps: number[] = [];

  while (xp >= cumulativeXpForLevel(level + 1)) {
    level++;
    levelUps.push(level);
  }

  const xpNext = cumulativeXpForLevel(level + 1);
  return { xp, level, xpNext, levelUps };
}

// ─── Avatar evolution ────────────────────────────────────────

/**
 * Compute avatar tier from hero level.
 * Tier changes at levels 5, 10, 15, 20, ...
 * tier = clamp(floor(level / 5) + 1, 1, 20)
 */
export function avatarTier(level: number): number {
  return Math.min(20, Math.max(1, Math.floor(level / 5) + 1));
}

/** Build the avatar image path from level + gender */
export function avatarPath(level: number, gender: 'male' | 'female'): string {
  const tier = avatarTier(level);
  const prefix = gender === 'female' ? 'f' : 'm';
  return `/assets/avatars/${prefix}_${String(tier).padStart(2, '0')}.png`;
}

// ─── Difficulty → drop system ────────────────────────────────

export const DIFFICULTY_MAP: Record<string, number> = {
  easy:   1,
  medium: 3,
  hard:   5,
};

export const QUEST_TYPE_DROP_MULT: Record<string, number> = {
  quest:   0.5,
  dungeon: 1.0,
  boss:    2.0,
};

const RARITY_WEIGHTS: Record<number, number[]> = {
  1: [85, 14, 1,   0],
  2: [70, 25, 4.5, 0.5],
  3: [55, 33, 10,  2],
  4: [40, 35, 19,  6],
  5: [25, 35, 28,  12],
};
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

/**
 * Pick a rarity tier weighted by difficulty.
 * Pure / deterministic-compatible: accepts pre-rolled value in [0, 1).
 */
export function pickRarity(difficulty: number, roll: number): string {
  const clampedDiff = Math.min(5, Math.max(1, Math.round(difficulty)));
  const weights = RARITY_WEIGHTS[clampedDiff] ?? RARITY_WEIGHTS[1];
  const totalW = weights.reduce((s, w) => s + w, 0);
  let remaining = roll * totalW;
  for (let i = 0; i < RARITIES.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) return RARITIES[i];
  }
  return 'common';
}

/**
 * Compute the raw drop chance for a quest.
 * (Actual random roll handled by caller / rollArtifactDrop in constants.ts)
 */
export function computeDropChance(
  questType: string,
  difficulty: number,
  heroLevel: number,
  dropRateMultiplier: number,
): number {
  const typeMult  = QUEST_TYPE_DROP_MULT[questType] ?? 1.0;
  const levelBonus = 1 + Math.min(heroLevel * 0.01, 0.5);
  const base = (0.08 + (difficulty - 1) * 0.02) * (dropRateMultiplier / 100);
  return base * typeMult * levelBonus;
}
