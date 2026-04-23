/**
 * Season Pass Configuration — 15 tiers (alpha-test May 2026)
 *
 * XP thresholds match spec section 6.1:
 *   Tiers  1-5:   200 each (cumulative 200→1000)
 *   Tiers  6-10:  350 each (cumulative 1350→2750)
 *   Tiers 11-15:  450 each (cumulative 3200→5000)
 *
 * Total BP requirement: 5,000 XP (was 15,000 for 30-tier version).
 * Will be restored to 30 tiers after alpha-test ends.
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
  amount?: number;
  artifactName?: string;
  collectibleCode?: string;
  collectibleName?: string;
  collectibleIcon?: string;
}

export interface BPTier {
  tier: number;
  xpRequired: number;
  rewards: BPReward[];
  isMilestone?: boolean;
}

/* ── 15-tier cumulative XP thresholds ── */
function buildCumulativeXp(): number[] {
  const xpPerTier: number[] = [];
  for (let i = 1; i <= 15; i++) {
    if (i <= 5)       xpPerTier.push(200);
    else if (i <= 10) xpPerTier.push(350);
    else              xpPerTier.push(450);
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
 * Generates the 15-tier reward track for a given season element.
 * Seasonal chests have NO rarity — loot quality is based on hero level.
 *
 * Artifact names map to existing artifact-registry entries.
 */
export function buildSeasonPassTiers(element: SeasonElement): BPTier[] {
  const el = SEASON_ELEMENTS[element];

  return [
    { tier: 1,  xpRequired: CUMULATIVE_XP[0],  rewards: [{ type: 'gold', amount: 100 }] },
    { tier: 2,  xpRequired: CUMULATIVE_XP[1],  rewards: [{ type: 'artifact', artifactName: 'Малое Снадобье Памяти' }] },
    { tier: 3,  xpRequired: CUMULATIVE_XP[2],  rewards: [{ type: 'gold', amount: 150 }] },
    { tier: 4,  xpRequired: CUMULATIVE_XP[3],  rewards: [{ type: 'artifact', artifactName: 'Ученическое Перо' }] },
    { tier: 5,  xpRequired: CUMULATIVE_XP[4],  rewards: [
      { type: 'lootbox' },
      { type: 'gold', amount: 200 },
    ], isMilestone: true },

    { tier: 6,  xpRequired: CUMULATIVE_XP[5],  rewards: [{ type: 'gold', amount: 250 }] },
    { tier: 7,  xpRequired: CUMULATIVE_XP[6],  rewards: [{ type: 'artifact', artifactName: 'Деревянный Щит' }] },
    { tier: 8,  xpRequired: CUMULATIVE_XP[7],  rewards: [{ type: 'gold', amount: 300 }] },
    { tier: 9,  xpRequired: CUMULATIVE_XP[8],  rewards: [{ type: 'artifact', artifactName: 'Среднее Зелье Бодрости' }] },
    { tier: 10, xpRequired: CUMULATIVE_XP[9],  rewards: [
      { type: 'lootbox' },
      { type: 'gold', amount: 500 },
      { type: 'collectible', collectibleCode: `${element}_spark`, collectibleName: `${el.emoji} Искра Сезона`, collectibleIcon: el.emoji },
    ], isMilestone: true },

    { tier: 11, xpRequired: CUMULATIVE_XP[10], rewards: [{ type: 'gold', amount: 500 }] },
    { tier: 12, xpRequired: CUMULATIVE_XP[11], rewards: [{ type: 'artifact', artifactName: 'Эликсир Озарения' }] },
    { tier: 13, xpRequired: CUMULATIVE_XP[12], rewards: [{ type: 'gold', amount: 750 }] },
    { tier: 14, xpRequired: CUMULATIVE_XP[13], rewards: [{ type: 'artifact', artifactName: 'Большое Зелье' }] },
    { tier: 15, xpRequired: CUMULATIVE_XP[14], rewards: [
      {
        type: 'collectible',
        collectibleCode: `${element}_relic`,
        collectibleName: element === 'fire'  ? '🐉 Сердце Огненного Дракона'
                       : element === 'ice'   ? '❄️ Кристалл Вечной Мерзлоты'
                       : element === 'earth' ? '🌿 Камень Жизни'
                       : '💧 Трезубец Посейдона',
        collectibleIcon: element === 'fire' ? '🐉' : element === 'ice' ? '❄️' : element === 'earth' ? '🌿' : '🔱',
      },
      { type: 'gold', amount: 1000 },
      { type: 'lootbox' },
    ], isMilestone: true },
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
  if (currentTier >= 15) return { currentTier: 15, xpInTier: 0, xpForTier: 0, totalXp: seasonXp };
  const prevThreshold = currentTier > 0 ? CUMULATIVE_XP[currentTier - 1] : 0;
  const nextThreshold = CUMULATIVE_XP[currentTier];
  return {
    currentTier,
    xpInTier: seasonXp - prevThreshold,
    xpForTier: nextThreshold - prevThreshold,
    totalXp: seasonXp,
  };
}

/** Max BP tier (alpha-test: 15, was 30) */
export const MAX_BP_TIER = 15;

/** Total XP to complete the Battle Pass (alpha-test: 5000, was 15000) */
export const TOTAL_BP_XP = CUMULATIVE_XP[CUMULATIVE_XP.length - 1];
