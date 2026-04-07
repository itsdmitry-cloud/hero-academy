/**
 * 💥 Hero Academy: Artifacts Engine (Client-side)
 * 
 * Re-exports from artifact-registry.ts (single source of truth)
 * and provides client-side game logic (calculateQuestResult).
 */

import { ARTIFACT_REGISTRY, REGISTRY_BY_KEY, ROYAL_SET_KEYS, type ArtifactEntry } from '@/lib/game/artifact-registry';

// ─── Re-export types and catalog ─────────────────────────────

export type Rarity = ArtifactEntry['rarity'];

export interface ArtifactDef {
  id: string;
  name: string;
  rarity: Rarity;
  type: 'passive' | 'consumable';
  req_level: number;
  max_charges?: number; 
  duration_hours?: number; 
  effect_code: string; 
}

export interface PlayerArtifact {
  id: string; 
  defId: string; 
  is_equipped: boolean;
  charges_left?: number;
  expires_at?: Date;
}

export interface HeroState {
  hp: number;
  xp: number;
  gold: number;
  level: number;
  streak: number;
  activeArtifacts: string[]; 
}

export interface QuestResult {
  baseXp: number;
  baseGold: number;
  baseDamage: number;
  isBossType?: boolean;
  isCriticalMistake?: boolean;
}

export interface ModifiedResult {
  finalXp: number;
  finalGold: number;
  finalDamage: number;
  preventedDeath: boolean;
  protectedStreak: boolean;
  artifactsUsed: string[];
  messages: string[];
}

// Build ARTIFACT_CATALOG from registry (backward compat)
function registryToArtifactDef(e: ArtifactEntry): ArtifactDef {
  return {
    id: e.key,
    name: e.name,
    rarity: e.rarity,
    type: e.artifact_type,
    req_level: e.req_level,
    max_charges: e.max_charges || undefined,
    duration_hours: e.duration_hours || undefined,
    effect_code: e.effect_code,
  };
}

/** 
 * Global Catalog — auto-generated from ARTIFACT_REGISTRY.
 * Keyed by artifact `key` (e.g. 'com_potion'). 
 */
export const ARTIFACT_CATALOG: Record<string, ArtifactDef> = {};
for (const entry of ARTIFACT_REGISTRY) {
  ARTIFACT_CATALOG[entry.key] = registryToArtifactDef(entry);
}

export const ROYAL_SET_IDS = ROYAL_SET_KEYS;

// ─── Game logic ──────────────────────────────────────────────

export function canEquipArtifact(heroLevel: number, artifactDefId: string): boolean {
  const def = ARTIFACT_CATALOG[artifactDefId];
  if (!def) return false;
  return heroLevel >= def.req_level;
}

/**
 * Calculates the final rewards and damage for a quest/homework,
 * taking into account all active artifacts on the hero's shelf.
 */
export function calculateQuestResult(
  hero: HeroState,
  rawResult: QuestResult,
  equippedArtifacts: PlayerArtifact[]
): ModifiedResult {
  
  let result: ModifiedResult = {
    finalXp: rawResult.baseXp,
    finalGold: rawResult.baseGold,
    finalDamage: rawResult.baseDamage,
    preventedDeath: false,
    protectedStreak: false,
    artifactsUsed: [],
    messages: []
  };

  let xpMultiplier = 1.0;
  let goldMultiplier = 1.0;
  let goldMultiplierAbsolute = 1.0;
  let xpMultiplierAbsolute = 1.0;
  let absoluteProtection = false;
  
  let damageReductionPct = 0.0;
  let flatDamageReduction = 0;
  let flatGoldAdd = 0;
  let flatXpAdd = 0;

  const usedInstances = new Set<string>();

  for (const art of equippedArtifacts) {
    if (!hero.activeArtifacts.includes(art.id)) continue;
    if (art.expires_at && new Date() > art.expires_at) continue;

    const def = ARTIFACT_CATALOG[art.defId];
    if (!def) continue;

    let triggered = false;

    switch (def.effect_code) {
      // Combos
      case 'XP_GOLD_5': xpMultiplier += 0.05; goldMultiplier += 0.05; break;
      case 'XP_GOLD_15': xpMultiplier += 0.15; goldMultiplier += 0.15; break;
      case 'XP_GOLD_50': xpMultiplier += 0.50; goldMultiplier += 0.50; break;
      case 'XP_GOLD_MASSIVE': xpMultiplier += 1.00; goldMultiplier += 0.50; break;
      
      // XP
      case 'XP_BOOST_10': xpMultiplier += 0.10; break;
      case 'XP_BOOST_20': xpMultiplier += 0.20; break;
      case 'XP_BOOST_50': xpMultiplier += 0.50; break;
      
      // GOLD
      case 'GOLD_BOOST_5': goldMultiplier += 0.05; break;
      case 'GOLD_BOOST_10': goldMultiplier += 0.10; break;
      case 'GOLD_BOOST_20': goldMultiplier += 0.20; break;
      case 'GOLD_BOOST_30': goldMultiplier += 0.30; break;
      case 'GOLD_BOOST_100': goldMultiplier += 1.00; break;
      case 'GOLD_MULTIPLIER_3X': goldMultiplierAbsolute = 3.0; break;
      case 'FLAT_GOLD_5': 
        if (result.finalXp > 0) { flatGoldAdd += 5; triggered = true; } 
        break;

      // CLASSWORK XP (passive boost per graded assignment)
      case 'CLASSWORK_XP_50': xpMultiplier += 0.50; break;
      case 'CLASSWORK_XP_200': xpMultiplier += 2.00; break;

      // SPECIFIC QUEST TYPES
      case 'FLAT_BOSS_XP_200':
        if (rawResult.isBossType) { flatXpAdd += 200; triggered = true; }
        break;
      case 'BOSS_MULTIPLIER_3X':
        if (rawResult.isBossType) { xpMultiplierAbsolute = 3.0; triggered = true; }
        break;

      // HP & DAMAGE REDUCTION
      case 'DMG_REDUCE_10':
        if (result.finalDamage > 0) { damageReductionPct = Math.max(damageReductionPct, 0.10); triggered = true; }
        break;
      case 'DMG_REDUCE_30':
        if (result.finalDamage > 0) { damageReductionPct = Math.max(damageReductionPct, 0.30); triggered = true; }
        break;
      case 'DMG_REDUCE_50':
        if (result.finalDamage > 0) { damageReductionPct = Math.max(damageReductionPct, 0.50); triggered = true; }
        break;
      case 'DMG_REDUCE_70':
        if (result.finalDamage > 0) { damageReductionPct = Math.max(damageReductionPct, 0.70); triggered = true; }
        break;
      case 'FLAT_DMG_REDUCE_5':
        if (result.finalDamage > 0) { flatDamageReduction = 5; triggered = true; }
        break;

      // IMMUNITIES
      case 'BLOCK_CRITICAL_DMG':
        if (result.finalDamage > 0 && rawResult.isCriticalMistake) {
          absoluteProtection = true;
          result.messages.push(`✨ ${def.name} поглотил критическую ошибку!`);
          triggered = true;
        }
        break;
      case 'BLOCK_ONE_MISTAKE':
      case 'BLOCK_ALL_MISTAKES':
        if (result.finalDamage > 0) {
          absoluteProtection = true;
          result.messages.push(`☄️ ${def.name} защитил вас от потери HP!`);
          triggered = true;
        }
        break;

      // === 🔥 FIRE SEASON PASSIVES ===
      case 'FIRE_GOLD_MULT_10': goldMultiplier += 0.10; break;
      case 'FIRE_REGEN_2': break; // daily regen, handled by /api/streak/update
      case 'FIRE_BOSS_MULT_20':
        if (rawResult.isBossType) { xpMultiplier += 0.20; triggered = true; }
        break;
      case 'PROTECT_STREAK':
      case 'FIRE_STREAK_SHIELD':
      case 'INFINITE_STREAK':
        result.protectedStreak = true;
        result.messages.push(`🐉 ${def.name} защитит ваш стрик!`);
        triggered = true;
        break;
      case 'COSMETIC':
        break;
    }

    if (triggered) {
      usedInstances.add(art.id);
    }
  }

  // Calculate Subtotals
  result.finalXp = Math.floor((result.finalXp * xpMultiplier * xpMultiplierAbsolute) + flatXpAdd);
  result.finalGold = Math.floor((result.finalGold * goldMultiplier * goldMultiplierAbsolute) + flatGoldAdd);

  if (absoluteProtection) {
    result.finalDamage = 0;
  } else if (result.finalDamage > 0) {
    const reduced = Math.max(0, result.finalDamage - flatDamageReduction);
    result.finalDamage = Math.floor(reduced * (1 - damageReductionPct));
  }

  // Death Prevention triggers
  if (hero.hp - result.finalDamage <= 0) {
    const revive30 = equippedArtifacts.find(a => ARTIFACT_CATALOG[a.defId]?.effect_code === 'PREVENT_DEATH_30');
    const revive50 = equippedArtifacts.find(a => ARTIFACT_CATALOG[a.defId]?.effect_code === 'PREVENT_DEATH_50');
    const fireRevive = equippedArtifacts.find(a => ARTIFACT_CATALOG[a.defId]?.effect_code === 'FIRE_AUTO_RESURRECT');
    
    let triggeredRevive = revive50 || fireRevive || revive30;

    if (triggeredRevive && hero.activeArtifacts.includes(triggeredRevive.id)) {
      result.preventedDeath = true;
      const isFireRevive = ARTIFACT_CATALOG[triggeredRevive.defId].effect_code === 'FIRE_AUTO_RESURRECT';
      const amount = (ARTIFACT_CATALOG[triggeredRevive.defId].effect_code === 'PREVENT_DEATH_50' || isFireRevive) ? 50 : 30;
      result.finalDamage = hero.hp - amount; 
      result.messages.push(`🌟 Ваш Герой пал, но ${ARTIFACT_CATALOG[triggeredRevive.defId].name} спас его, оставив ${amount} HP!`);
      usedInstances.add(triggeredRevive.id);
    }
  }

  result.artifactsUsed = Array.from(usedInstances);
  return result;
}

export function checkHasRoyalSet(inventory: PlayerArtifact[]): boolean {
  const ownedDefIds = inventory.map(i => i.defId);
  return ROYAL_SET_IDS.every(royId => ownedDefIds.includes(royId));
}
