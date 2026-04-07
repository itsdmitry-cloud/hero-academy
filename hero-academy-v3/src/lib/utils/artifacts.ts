/**
 * 💥 Hero Academy: Artifacts Engine
 * 
 * Core logic for applying artifact effects, checking requirements, 
 * and consuming charges. This file serves as the "engine" ruleset.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'royal';

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
  isCriticalMistake: boolean; 
  isBossType?: boolean;
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

// Global Catalog as defined in GAME_MECHANICS.md
export const ARTIFACT_CATALOG: Record<string, ArtifactDef> = {
  // === 🟢 COMMON (10) ===
  'com_potion': { id: 'com_potion', name: 'Малое Снадобье Памяти', rarity: 'common', type: 'consumable', req_level: 1, effect_code: 'HEAL_30' },
  'com_pen': { id: 'com_pen', name: 'Ученическое Перо', rarity: 'common', type: 'passive', req_level: 1, duration_hours: 24, effect_code: 'XP_BOOST_10' },
  'com_shield': { id: 'com_shield', name: 'Деревянный Щит', rarity: 'common', type: 'passive', req_level: 1, max_charges: 3, effect_code: 'DMG_REDUCE_10' },
  'com_parchment': { id: 'com_parchment', name: 'Рваный Пергамент', rarity: 'common', type: 'passive', req_level: 1, duration_hours: 24, effect_code: 'GOLD_BOOST_10' },
  'com_coin': { id: 'com_coin', name: 'Медная Монета', rarity: 'common', type: 'passive', req_level: 1, max_charges: 3, effect_code: 'FLAT_GOLD_5' },
  'com_scroll': { id: 'com_scroll', name: 'Свиток Концентрации', rarity: 'common', type: 'passive', req_level: 2, max_charges: 1, effect_code: 'DMG_REDUCE_50' },
  'com_ring': { id: 'com_ring', name: 'Бронзовое Кольцо', rarity: 'common', type: 'passive', req_level: 2, effect_code: 'GOLD_BOOST_5' }, // no limit
  'com_ink': { id: 'com_ink', name: 'Флакон Чернил', rarity: 'common', type: 'passive', req_level: 3, max_charges: 5, effect_code: 'FLAT_DMG_REDUCE_5' },
  'com_cloak': { id: 'com_cloak', name: 'Плащ Новичка', rarity: 'common', type: 'passive', req_level: 3, duration_hours: 12, effect_code: 'XP_GOLD_5' },
  'com_magnet': { id: 'com_magnet', name: 'Магнит Жадности', rarity: 'common', type: 'passive', req_level: 4, duration_hours: 6, effect_code: 'GOLD_BOOST_20' },

  // === 🔵 RARE (10) ===
  'rar_potion': { id: 'rar_potion', name: 'Среднее Зелье Бодрости', rarity: 'rare', type: 'consumable', req_level: 5, effect_code: 'HEAL_60' },
  'rar_armor': { id: 'rar_armor', name: 'Броня Усидчивости', rarity: 'rare', type: 'passive', req_level: 5, max_charges: 5, effect_code: 'DMG_REDUCE_30' },
  'rar_pouch': { id: 'rar_pouch', name: 'Кошель Удачи', rarity: 'rare', type: 'passive', req_level: 5, duration_hours: 48, effect_code: 'GOLD_BOOST_30' },
  'rar_candle': { id: 'rar_candle', name: 'Свеча Полуночника', rarity: 'rare', type: 'passive', req_level: 5, max_charges: 1, effect_code: 'PROTECT_STREAK' },
  'rar_pen': { id: 'rar_pen', name: 'Перо Калиграфа', rarity: 'rare', type: 'passive', req_level: 6, duration_hours: 24, effect_code: 'XP_BOOST_20' },
  'rar_amulet': { id: 'rar_amulet', name: 'Серебряный Амулет', rarity: 'rare', type: 'passive', req_level: 7, duration_hours: 48, effect_code: 'XP_GOLD_15' },
  'rar_shield': { id: 'rar_shield', name: 'Щит Стражника', rarity: 'rare', type: 'passive', req_level: 8, max_charges: 2, effect_code: 'DMG_REDUCE_50' },
  'rar_focus': { id: 'rar_focus', name: 'Зелье Фокуса', rarity: 'rare', type: 'consumable', req_level: 8, effect_code: 'FLAT_XP_100' },
  'rar_cloak': { id: 'rar_cloak', name: 'Плащ Ветра', rarity: 'rare', type: 'passive', req_level: 9, max_charges: 1, effect_code: 'BLOCK_ONE_MISTAKE' },
  'rar_elixir': { id: 'rar_elixir', name: 'Эликсир Озарения', rarity: 'rare', type: 'passive', req_level: 9, duration_hours: 5, effect_code: 'XP_BOOST_50' },

  // === 🟣 EPIC (10) ===
  'epi_orb': { id: 'epi_orb', name: 'Сфера Архимага', rarity: 'epic', type: 'passive', req_level: 15, max_charges: 3, effect_code: 'CLASSWORK_XP_50' },
  'epi_shield': { id: 'epi_shield', name: 'Мифриловый Щит', rarity: 'epic', type: 'passive', req_level: 15, max_charges: 2, effect_code: 'BLOCK_CRITICAL_DMG' },
  'epi_scroll': { id: 'epi_scroll', name: 'Свиток Выходного Дня', rarity: 'epic', type: 'consumable', req_level: 15, effect_code: 'SKIP_HOMEWORK' },
  'epi_potion': { id: 'epi_potion', name: 'Большое Зелье', rarity: 'epic', type: 'consumable', req_level: 15, effect_code: 'HEAL_100' },
  'epi_cup': { id: 'epi_cup', name: 'Золотая Чаша', rarity: 'epic', type: 'passive', req_level: 16, duration_hours: 48, effect_code: 'GOLD_BOOST_100' },
  'epi_rune': { id: 'epi_rune', name: 'Руна Знаний', rarity: 'epic', type: 'passive', req_level: 17, duration_hours: 48, effect_code: 'XP_BOOST_50' },
  'epi_armor': { id: 'epi_armor', name: 'Адамантитовый Нагрудник', rarity: 'epic', type: 'passive', req_level: 18, max_charges: 3, effect_code: 'DMG_REDUCE_70' },
  'epi_crystal': { id: 'epi_crystal', name: 'Кристалл Охотника', rarity: 'epic', type: 'passive', req_level: 19, max_charges: 1, effect_code: 'FLAT_BOSS_XP_200' },
  'epi_ring': { id: 'epi_ring', name: 'Кольцо Алхимика', rarity: 'epic', type: 'passive', req_level: 20, duration_hours: 24, effect_code: 'XP_GOLD_50' },
  'epi_feather': { id: 'epi_feather', name: 'Младшее Перо Феникса', rarity: 'epic', type: 'passive', req_level: 20, max_charges: 1, effect_code: 'PREVENT_DEATH_30' },

  // === 🟡 LEGENDARY (10) ===
  'leg_crown': { id: 'leg_crown', name: 'Корона Академии', rarity: 'legendary', type: 'passive', req_level: 25, duration_hours: 168, effect_code: 'XP_GOLD_MASSIVE' },
  'leg_hourglass': { id: 'leg_hourglass', name: 'Песочные Часы Времени', rarity: 'legendary', type: 'consumable', req_level: 25, effect_code: 'RETRY_QUEST' },
  'leg_cross': { id: 'leg_cross', name: 'Крест Возрождения', rarity: 'legendary', type: 'passive', req_level: 26, max_charges: 1, effect_code: 'PREVENT_DEATH_50' },
  'leg_staff': { id: 'leg_staff', name: 'Посох Властителя', rarity: 'legendary', type: 'passive', req_level: 27, max_charges: 5, effect_code: 'CLASSWORK_XP_200' },
  'leg_dragon': { id: 'leg_dragon', name: 'Золотой Дракон', rarity: 'legendary', type: 'passive', req_level: 28, duration_hours: 168, effect_code: 'GOLD_MULTIPLIER_3X' },
  'leg_aegis': { id: 'leg_aegis', name: 'Непробиваемая Эгида', rarity: 'legendary', type: 'passive', req_level: 29, max_charges: 3, effect_code: 'BLOCK_ALL_MISTAKES' },
  'leg_elixir': { id: 'leg_elixir', name: 'Эликсир Гения', rarity: 'legendary', type: 'consumable', req_level: 30, effect_code: 'FORCE_LEVEL_UP' },
  'leg_ringall': { id: 'leg_ringall', name: 'Кольцо Всевластия', rarity: 'legendary', type: 'passive', req_level: 32, duration_hours: 168, effect_code: 'TEAM_XP_10' },
  'leg_scroll': { id: 'leg_scroll', name: 'Свиток Истины', rarity: 'legendary', type: 'passive', req_level: 35, max_charges: 1, effect_code: 'BOSS_MULTIPLIER_3X' },
  'leg_star': { id: 'leg_star', name: 'Звезда Академии', rarity: 'legendary', type: 'passive', req_level: 40, duration_hours: 720, effect_code: 'INFINITE_STREAK' },

  // === 👑 ROYAL SET (5) ===
  'roy_mantle': { id: 'roy_mantle', name: 'Мантия Прогульщика', rarity: 'royal', type: 'passive', req_level: 1, effect_code: 'ROYAL_PIECE' },
  'roy_scepter': { id: 'roy_scepter', name: 'Скипетр Отгула', rarity: 'royal', type: 'passive', req_level: 1, effect_code: 'ROYAL_PIECE' },
  'roy_orb': { id: 'roy_orb', name: 'Держава Лени', rarity: 'royal', type: 'passive', req_level: 1, effect_code: 'ROYAL_PIECE' },
  'roy_crown': { id: 'roy_crown', name: 'Корона Свободы', rarity: 'royal', type: 'passive', req_level: 1, effect_code: 'ROYAL_PIECE' },
  'roy_seal': { id: 'roy_seal', name: 'Печать Директора', rarity: 'royal', type: 'passive', req_level: 1, effect_code: 'ROYAL_PIECE' },
};

export const ROYAL_SET_IDS = ['roy_mantle', 'roy_scepter', 'roy_orb', 'roy_crown', 'roy_seal'];

// === 🔥 FIRE SEASON ARTIFACTS (25) ===
// These are primarily server-side (use-artifact API) but passives are handled in calculateQuestResult.
export const FIRE_SEASON_CATALOG: Record<string, ArtifactDef> = {
  'fire_coals':            { id: 'fire_coals',            name: 'Угли Мотивации',     rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_HP_10' },
  'fire_spark':            { id: 'fire_spark',            name: 'Искра Гения',        rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_XP_50' },
  'fire_phoenix_extract':  { id: 'fire_phoenix_extract',  name: 'Экстракт Феникса',   rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_FULL_HP' },
  'fire_dwarven_ingot':    { id: 'fire_dwarven_ingot',    name: 'Слиток Гномов',      rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_GOLD_100' },
  'fire_magma_vial':       { id: 'fire_magma_vial',       name: 'Флакон Магмы',       rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_XP_200' },
  'fire_coal_stone':       { id: 'fire_coal_stone',       name: 'Угольный Камень',    rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_BOSS_500' },
  'fire_ashes':            { id: 'fire_ashes',            name: 'Пепел Предков',      rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_SEASON_XP_50' },
  'fire_volcano_tear':     { id: 'fire_volcano_tear',     name: 'Слеза Вулкана',      rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_RANDOM_GOLD' },
  'fire_hellfire_elixir':  { id: 'fire_hellfire_elixir',  name: 'Эликсир Пекла',      rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_COMBO' },
  'fire_ring':             { id: 'fire_ring',             name: 'Кольцо Огня',        rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'FIRE_GOLD_MULT_10' },
  'fire_berserker':        { id: 'fire_berserker',        name: 'Зелье Берсерка',     rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_BOSS_RANDOM' },
  'fire_lava_amulet':      { id: 'fire_lava_amulet',      name: 'Лавовый Амулет',     rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'FIRE_DMG_REDUCE_1' },
  'fire_dragon_scale':     { id: 'fire_dragon_scale',     name: 'Драконья Чешуйка',   rarity: 'common', type: 'passive',    req_level: 1, max_charges: 1, effect_code: 'FIRE_STREAK_SHIELD' },
  'fire_phoenix_feather':  { id: 'fire_phoenix_feather',  name: 'Огненное Перо',      rarity: 'common', type: 'passive',    req_level: 1, max_charges: 1, effect_code: 'FIRE_AUTO_RESURRECT' },
  'fire_banner':           { id: 'fire_banner',           name: 'Багровое Знамя',     rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'COSMETIC' },
  'fire_inquisitor':       { id: 'fire_inquisitor',       name: 'Шлем Инквизитора',   rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'COSMETIC' },
  'fire_eye_ifrit':        { id: 'fire_eye_ifrit',        name: 'Око Ифрита',         rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'COSMETIC' },
  'fire_flaming_sword':    { id: 'fire_flaming_sword',    name: 'Пламенный Меч',      rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'COSMETIC' },
  'fire_golden_torch':     { id: 'fire_golden_torch',     name: 'Золотой Факел',      rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'COSMETIC' },
  'fire_meteor_scroll':    { id: 'fire_meteor_scroll',    name: 'Метеоритный Дождь',  rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_CLASS_BOSS_3000' },
  'fire_hearth_scroll':    { id: 'fire_hearth_scroll',    name: 'Тепло Очага',        rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_CLASS_HP_20' },
  'fire_boom':             { id: 'fire_boom',             name: 'Огненный Бум',       rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_CLASS_XP_100' },
  'fire_dragon_hoard':     { id: 'fire_dragon_hoard',     name: 'Драконий Клад',      rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_CLASS_GOLD_50' },
  'fire_friendship_match': { id: 'fire_friendship_match', name: 'Спичка Дружбы',      rarity: 'common', type: 'consumable', req_level: 1, max_charges: 1, effect_code: 'FIRE_RANDOM_STUDENT' },
  'fire_dragon_claw':      { id: 'fire_dragon_claw',      name: 'Коготь Дракона',     rarity: 'common', type: 'passive',    req_level: 1, effect_code: 'FIRE_BOSS_MULT_20' },
};

// Merge fire season into the main catalog for unified lookups
Object.assign(ARTIFACT_CATALOG, FIRE_SEASON_CATALOG);

/**
 * Validates if the hero meets the level requirements.
 */
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
  let goldMultiplierAbsolute = 1.0; // For Golden Dragon X3
  let xpMultiplierAbsolute = 1.0; // For Boss 3X
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

    // Apply Effects Dictionary
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
      case 'FIRE_DMG_REDUCE_1':
        if (result.finalDamage > 0) { flatDamageReduction += 1; triggered = true; }
        break;
      case 'FIRE_BOSS_MULT_20':
        if (rawResult.isBossType) { xpMultiplier += 0.20; triggered = true; }
        break;
      case 'FIRE_STREAK_SHIELD':
        result.protectedStreak = true;
        result.messages.push(`🐉 ${def.name} защитит ваш стрик!`);
        break;
      case 'COSMETIC':
        // Purely decorative — no gameplay effect
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
    
    // Prefer the better one: cross (50) > fire feather (50) > feather (30)
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

/**
 * Helper to check if a user has all 5 Royal Set pieces in Inventory
 */
export function checkHasRoyalSet(inventory: PlayerArtifact[]): boolean {
  const ownedDefIds = inventory.map(i => i.defId);
  return ROYAL_SET_IDS.every(royId => ownedDefIds.includes(royId));
}
