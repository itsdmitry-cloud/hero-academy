/**
 * Season Pass Configuration — 30 tiers
 *
 * XP thresholds are calculated so an active student (2 grades/day, avg ~120 XP each)
 * completes the full pass by the end of a 9-week season (~14,300 XP).
 *
 * Total BP requirement: 15,000 XP
 *
 * Reward types:
 *   gold        — hero.gold += amount
 *   lootbox     — inserts seasonal lootbox artifact (no rarity — loot based on hero level)
 *   artifact    — inserts specific artifact by name
 *   collectible — inserts into hero_collectibles (emoji badge / relic)
 */

/* ── Season element configuration ── */
export type SeasonElement = 'fire' | 'ice' | 'earth' | 'water';

export const SEASON_ELEMENTS: Record<SeasonElement, { label: string; emoji: string; chestName: string }> = {
  fire:  { label: 'Огненный Сезон',  emoji: '🔥', chestName: 'Огненный Сундук' },
  ice:   { label: 'Ледяной Сезон',   emoji: '❄️', chestName: 'Ледяной Сундук' },
  earth: { label: 'Земляной Сезон',  emoji: '🌿', chestName: 'Земляной Сундук' },
  water: { label: 'Водяной Сезон',   emoji: '💧', chestName: 'Водяной Сундук' },
};

/* ── Reward type definitions ── */
export interface BPReward {
  type: 'gold' | 'lootbox' | 'artifact' | 'collectible';
  /** For gold: amount */
  amount?: number;
  /** For artifact: name in artifacts table */
  artifactName?: string;
  /** For collectible: unique code */
  collectibleCode?: string;
  /** For collectible: display name */
  collectibleName?: string;
  /** For collectible: emoji icon */
  collectibleIcon?: string;
}

export interface BPTier {
  tier: number;
  /** Cumulative XP required to reach this tier */
  xpRequired: number;
  rewards: BPReward[];
  /** Milestone tier — shown bigger in UI */
  isMilestone?: boolean;
}

/* ── 30-tier XP thresholds ──
 *   Tiers  1-5:   250 each (total: 1,250)
 *   Tiers  6-10:  400 each (total: 3,250)
 *   Tiers 11-15:  500 each (total: 5,750)
 *   Tiers 16-20:  600 each (total: 8,750)
 *   Tiers 21-25:  700 each (total: 12,250)
 *   Tiers 26-30:  550 each (total: 15,000)
 */
function buildCumulativeXp(): number[] {
  const xpPerTier: number[] = [];
  for (let i = 1; i <= 30; i++) {
    if (i <= 5)       xpPerTier.push(250);
    else if (i <= 10) xpPerTier.push(400);
    else if (i <= 15) xpPerTier.push(500);
    else if (i <= 20) xpPerTier.push(600);
    else if (i <= 25) xpPerTier.push(700);
    else              xpPerTier.push(550);
  }
  const cumulative: number[] = [];
  let total = 0;
  for (const xp of xpPerTier) {
    total += xp;
    cumulative.push(total);
  }
  return cumulative;
}

const CUMULATIVE_XP = buildCumulativeXp();

/**
 * Generates the reward track for a given season element.
 * Seasonal chests have NO rarity — loot quality is based on hero level.
 */
export function buildSeasonPassTiers(element: SeasonElement): BPTier[] {
  const el = SEASON_ELEMENTS[element];

  return [
    // ── Tiers 1-5 (Starter) ──
    { tier: 1,  xpRequired: CUMULATIVE_XP[0],  rewards: [{ type: 'gold', amount: 50 }] },
    { tier: 2,  xpRequired: CUMULATIVE_XP[1],  rewards: [{ type: 'artifact', artifactName: 'Малое Зелье Жизни' }] },
    { tier: 3,  xpRequired: CUMULATIVE_XP[2],  rewards: [{ type: 'gold', amount: 100 }] },
    { tier: 4,  xpRequired: CUMULATIVE_XP[3],  rewards: [{ type: 'gold', amount: 75 }] },
    { tier: 5,  xpRequired: CUMULATIVE_XP[4],  rewards: [{ type: 'lootbox' }], isMilestone: true },

    // ── Tiers 6-10 ──
    { tier: 6,  xpRequired: CUMULATIVE_XP[5],  rewards: [{ type: 'gold', amount: 100 }] },
    { tier: 7,  xpRequired: CUMULATIVE_XP[6],  rewards: [{ type: 'artifact', artifactName: 'Деревянный Щит' }] },
    { tier: 8,  xpRequired: CUMULATIVE_XP[7],  rewards: [{ type: 'gold', amount: 150 }] },
    { tier: 9,  xpRequired: CUMULATIVE_XP[8],  rewards: [{ type: 'gold', amount: 100 }] },
    { tier: 10, xpRequired: CUMULATIVE_XP[9],  rewards: [
      { type: 'lootbox' },
      { type: 'collectible', collectibleCode: `${element}_spark`, collectibleName: `${el.emoji} Искра`, collectibleIcon: el.emoji },
    ], isMilestone: true },

    // ── Tiers 11-15 ──
    { tier: 11, xpRequired: CUMULATIVE_XP[10], rewards: [{ type: 'gold', amount: 150 }] },
    { tier: 12, xpRequired: CUMULATIVE_XP[11], rewards: [{ type: 'artifact', artifactName: 'Свиток Концентрации' }] },
    { tier: 13, xpRequired: CUMULATIVE_XP[12], rewards: [{ type: 'gold', amount: 200 }] },
    { tier: 14, xpRequired: CUMULATIVE_XP[13], rewards: [{ type: 'gold', amount: 150 }] },
    { tier: 15, xpRequired: CUMULATIVE_XP[14], rewards: [{ type: 'lootbox' }], isMilestone: true },

    // ── Tiers 16-20 ──
    { tier: 16, xpRequired: CUMULATIVE_XP[15], rewards: [{ type: 'gold', amount: 200 }] },
    { tier: 17, xpRequired: CUMULATIVE_XP[16], rewards: [{ type: 'artifact', artifactName: 'Ночная Свеча' }] },
    { tier: 18, xpRequired: CUMULATIVE_XP[17], rewards: [{ type: 'gold', amount: 250 }] },
    { tier: 19, xpRequired: CUMULATIVE_XP[18], rewards: [{ type: 'gold', amount: 200 }] },
    { tier: 20, xpRequired: CUMULATIVE_XP[19], rewards: [
      { type: 'gold', amount: 500 },
      { type: 'collectible', collectibleCode: `${element}_flame`, collectibleName: `${el.emoji} Пламя Ученика`, collectibleIcon: '🔱' },
    ], isMilestone: true },

    // ── Tiers 21-25 ──
    { tier: 21, xpRequired: CUMULATIVE_XP[20], rewards: [{ type: 'gold', amount: 300 }] },
    { tier: 22, xpRequired: CUMULATIVE_XP[21], rewards: [{ type: 'artifact', artifactName: 'Зелье Жизни' }] },
    { tier: 23, xpRequired: CUMULATIVE_XP[22], rewards: [{ type: 'gold', amount: 500 }] },
    { tier: 24, xpRequired: CUMULATIVE_XP[23], rewards: [{ type: 'gold', amount: 300 }] },
    { tier: 25, xpRequired: CUMULATIVE_XP[24], rewards: [{ type: 'lootbox' }], isMilestone: true },

    // ── Tiers 26-30 (Victory lap) ──
    { tier: 26, xpRequired: CUMULATIVE_XP[25], rewards: [{ type: 'gold', amount: 500 }] },
    { tier: 27, xpRequired: CUMULATIVE_XP[26], rewards: [{ type: 'gold', amount: 750 }] },
    { tier: 28, xpRequired: CUMULATIVE_XP[27], rewards: [{ type: 'gold', amount: 500 }] },
    { tier: 29, xpRequired: CUMULATIVE_XP[28], rewards: [{ type: 'gold', amount: 750 }] },
    { tier: 30, xpRequired: CUMULATIVE_XP[29], rewards: [{
      type: 'collectible',
      collectibleCode: `${element}_relic`,
      collectibleName: element === 'fire'  ? '🐉 Сердце Огненного Дракона'
                     : element === 'ice'   ? '❄️ Кристалл Вечной Мерзлоты'
                     : element === 'earth' ? '🌿 Камень Жизни'
                     : '💧 Трезубец Посейдона',
      collectibleIcon: element === 'fire' ? '🐉' : element === 'ice' ? '❄️' : element === 'earth' ? '🌿' : '🔱',
    }], isMilestone: true },
  ];
}

/** Get reward icon for display */
export function getRewardIcon(reward: BPReward, element: SeasonElement): string {
  switch (reward.type) {
    case 'gold': return '💰';
    case 'lootbox': return SEASON_ELEMENTS[element].emoji;
    case 'artifact': return '💎';
    case 'collectible': return reward.collectibleIcon ?? '🏆';
  }
}

/** Get reward label for display */
export function getRewardLabel(reward: BPReward, element: SeasonElement): string {
  switch (reward.type) {
    case 'gold': return `+${reward.amount} Gold`;
    case 'lootbox': return `${SEASON_ELEMENTS[element].emoji} ${SEASON_ELEMENTS[element].chestName}`;
    case 'artifact': return reward.artifactName ?? 'Артефакт';
    case 'collectible': return reward.collectibleName ?? 'Коллекционка';
  }
}

/** Calculate current BP tier from season_xp */
export function getCurrentBPTier(seasonXp: number): number {
  for (let i = CUMULATIVE_XP.length - 1; i >= 0; i--) {
    if (seasonXp >= CUMULATIVE_XP[i]) return i + 1;
  }
  return 0;
}

/** Get XP progress within the current tier */
export function getBPProgress(seasonXp: number): { currentTier: number; xpInTier: number; xpForTier: number; totalXp: number } {
  const currentTier = getCurrentBPTier(seasonXp);
  if (currentTier >= 30) return { currentTier: 30, xpInTier: 0, xpForTier: 0, totalXp: seasonXp };
  const prevThreshold = currentTier > 0 ? CUMULATIVE_XP[currentTier - 1] : 0;
  const nextThreshold = CUMULATIVE_XP[currentTier]; // next tier
  return {
    currentTier,
    xpInTier: seasonXp - prevThreshold,
    xpForTier: nextThreshold - prevThreshold,
    totalXp: seasonXp,
  };
}

/** Max BP tier */
export const MAX_BP_TIER = 30;

/** Total XP to complete the Battle Pass */
export const TOTAL_BP_XP = CUMULATIVE_XP[CUMULATIVE_XP.length - 1]; // 15,000
