/**
 * Hero Academy — Unified Artifact Registry
 * 
 * SINGLE SOURCE OF TRUTH for all artifacts.
 * 
 * Every artifact is defined ONCE here with ALL fields needed by:
 *   - DB seeding (seed-artifacts.mjs)
 *   - Game engine (artifacts.ts → calculateQuestResult)
 *   - API routes (action/route.ts, grade-batch/route.ts)
 *   - UI (artifact shelf, shop, tooltips)
 * 
 * Adding a new artifact: add ONE entry here. Everything else auto-syncs.
 */

// ─── Types ───────────────────────────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'royal';
export type ArtifactType = 'passive' | 'consumable';

/** DB-compatible effect_type enum values */
export type EffectTypeEnum = 'xp_boost' | 'hp_shield' | 'skip_day' | 'gold_bonus' | 'damage_reduce' | 'streak_protect' | 'lootbox';

export interface ArtifactEntry {
  /** Unique string key (e.g. 'com_potion') — used as defId in client code */
  key: string;
  /** Display name (in Russian) */
  name: string;
  /** Description for UI/shop */
  description: string;
  /** Rarity tier */
  rarity: Rarity;
  /** Emoji or asset path */
  icon: string;
  /** passive = always-on while equipped, consumable = single-use */
  artifact_type: ArtifactType;

  // ─── DB fields ───
  /** DB enum effect_type (for queries/filters) */
  effect_type: EffectTypeEnum;
  /** Free-text effect identifier (for game logic, e.g. 'damage_shield', 'xp_boost') */
  effect: string;
  /** Numeric effect value (e.g. 50 for +50%) */
  effect_value: number;
  /** Duration in hours (0 = permanent/charge-based) */
  duration_hours: number;
  /** Drop probability 0.0–1.0 (used by rollArtifactDrop) */
  drop_rate: number;
  /** Max charges (0 = unlimited/duration-based) */
  max_charges: number;
  /** Minimum hero level to equip */
  req_level: number;
  /** Can be purchased in shop */
  is_shopable: boolean;
  /** Can stack in inventory */
  stackable: boolean;

  // ─── Client-side effect code (for calculateQuestResult) ───
  /** Internal effect code used by the client-side artifacts engine */
  effect_code: string;

  /** Season tag (null = available always) */
  season_tag?: string;
}

// ─── Effect code → DB mapping helper ─────────────────────────

function mapEffectToDB(code: string): { effect_type: EffectTypeEnum; effect: string; effect_value: number } {
  // XP boosts
  if (code === 'XP_GOLD_MASSIVE')     return { effect_type: 'xp_boost',       effect: 'xp_boost,gold_boost',   effect_value: 100 };
  if (code.startsWith('XP_BOOST_'))   return { effect_type: 'xp_boost',       effect: 'xp_boost',              effect_value: parseInt(code.split('_').pop()!) || 0 };
  if (code.startsWith('XP_GOLD_'))    return { effect_type: 'xp_boost',       effect: 'xp_boost,gold_boost',   effect_value: parseInt(code.split('_').pop()!) || 0 };
  // Gold
  if (code === 'GOLD_MULTIPLIER_3X')  return { effect_type: 'gold_bonus',     effect: 'gold_multiplier',       effect_value: 200 };
  if (code.startsWith('GOLD_BOOST_')) return { effect_type: 'gold_bonus',     effect: 'gold_boost',            effect_value: parseInt(code.split('_').pop()!) || 0 };
  if (code.startsWith('FLAT_GOLD_'))  return { effect_type: 'gold_bonus',     effect: 'extra_gold',            effect_value: parseInt(code.split('_').pop()!) || 0 };
  // Damage reduce
  if (code.startsWith('FLAT_DMG_REDUCE_')) return { effect_type: 'damage_reduce', effect: 'passive_damage_reduction', effect_value: parseInt(code.split('_').pop()!) || 0 };
  if (code.startsWith('DMG_REDUCE_')) return { effect_type: 'damage_reduce',  effect: 'dmg_reduce',            effect_value: parseInt(code.split('_').pop()!) || 0 };
  // Shields
  if (code === 'BLOCK_ONE_MISTAKE')   return { effect_type: 'damage_reduce',  effect: 'damage_shield',         effect_value: 100 };
  if (code === 'BLOCK_ALL_MISTAKES')  return { effect_type: 'damage_reduce',  effect: 'damage_shield',         effect_value: 100 };
  if (code === 'BLOCK_CRITICAL_DMG')  return { effect_type: 'damage_reduce',  effect: 'damage_shield',         effect_value: 100 };
  // HP
  if (code.startsWith('HEAL_'))       return { effect_type: 'hp_shield',      effect: 'hp_restore',            effect_value: parseInt(code.split('_').pop()!) };
  if (code === 'PREVENT_DEATH_30')    return { effect_type: 'hp_shield',      effect: 'death_save',            effect_value: 30 };
  if (code === 'PREVENT_DEATH_50')    return { effect_type: 'hp_shield',      effect: 'death_save',            effect_value: 50 };
  // Streak
  if (code === 'PROTECT_STREAK')      return { effect_type: 'streak_protect', effect: 'streak_protect',        effect_value: 1 };
  if (code === 'INFINITE_STREAK')     return { effect_type: 'streak_protect', effect: 'streak_protect',        effect_value: 999 };
  // Skip
  if (code === 'SKIP_HOMEWORK')       return { effect_type: 'skip_day',       effect: 'skip_day',              effect_value: 1 };
  // Boss
  if (code === 'FLAT_BOSS_XP_200')    return { effect_type: 'xp_boost',       effect: 'boss_dmg',              effect_value: 200 };
  if (code === 'BOSS_MULTIPLIER_3X')  return { effect_type: 'xp_boost',       effect: 'boss_dmg',              effect_value: 200 };
  if (code === 'CLASSWORK_XP_50')     return { effect_type: 'xp_boost',       effect: 'xp_boost',              effect_value: 50 };
  if (code === 'CLASSWORK_XP_200')    return { effect_type: 'xp_boost',       effect: 'xp_boost',              effect_value: 200 };
  if (code === 'FLAT_XP_100')         return { effect_type: 'xp_boost',       effect: 'xp_instant',            effect_value: 100 };
  // Special
  if (code === 'RETRY_QUEST')         return { effect_type: 'skip_day',       effect: 'retry_quest',           effect_value: 1 };
  if (code === 'FORCE_LEVEL_UP')      return { effect_type: 'xp_boost',       effect: 'force_level_up',        effect_value: 1 };
  if (code === 'TEAM_XP_10')          return { effect_type: 'xp_boost',  effect: 'team_xp',               effect_value: 10 };
  if (code === 'TEAM_BOSS_20')        return { effect_type: 'xp_boost',  effect: 'team_boss_dmg',         effect_value: 20 };
  if (code === 'ROYAL_PIECE')         return { effect_type: 'xp_boost',       effect: 'royal_set_piece',       effect_value: 0 };
  // Lootboxes
  if (code === 'LOOTBOX_COMMON')      return { effect_type: 'lootbox',        effect: 'lootbox',               effect_value: 0 };
  if (code === 'LOOTBOX_RARE')        return { effect_type: 'lootbox',        effect: 'lootbox',               effect_value: 0 };
  if (code === 'LOOTBOX_EPIC')        return { effect_type: 'lootbox',        effect: 'lootbox',               effect_value: 0 };
  if (code === 'LOOTBOX_LEGENDARY')   return { effect_type: 'lootbox',        effect: 'lootbox',               effect_value: 0 };
  if (code === 'LOOTBOX_FIRE')        return { effect_type: 'lootbox',        effect: 'lootbox',               effect_value: 0 };
  // Fire season — simple self-use
  if (code === 'FIRE_HP_10')          return { effect_type: 'hp_shield',      effect: 'hp_restore',            effect_value: 10 };
  if (code === 'FIRE_XP_50')          return { effect_type: 'xp_boost',       effect: 'xp_instant',            effect_value: 50 };
  if (code === 'FIRE_FULL_HP')        return { effect_type: 'hp_shield',      effect: 'hp_restore',            effect_value: 100 };
  if (code === 'FIRE_GOLD_100')       return { effect_type: 'gold_bonus',     effect: 'extra_gold',            effect_value: 100 };
  if (code === 'FIRE_XP_200')         return { effect_type: 'xp_boost',       effect: 'xp_instant',            effect_value: 200 };
  if (code === 'FIRE_SEASON_XP_50')   return { effect_type: 'xp_boost',       effect: 'consumable_season_xp',  effect_value: 50 };
  if (code === 'FIRE_RANDOM_GOLD')    return { effect_type: 'gold_bonus',     effect: 'extra_gold',            effect_value: 50 };
  if (code === 'FIRE_COMBO')          return { effect_type: 'xp_boost',       effect: 'consumable_combo',      effect_value: 30 };
  // Fire season — boss damage consumables
  if (code === 'FIRE_BOSS_500')       return { effect_type: 'xp_boost',       effect: 'consumable_boss_damage', effect_value: 500 };
  if (code === 'FIRE_BOSS_RANDOM')    return { effect_type: 'xp_boost',       effect: 'consumable_boss_damage', effect_value: 100 };
  if (code === 'FIRE_CLASS_BOSS_3000') return { effect_type: 'xp_boost',      effect: 'consumable_boss_damage', effect_value: 3000 };
  // Fire season — class-wide consumables
  if (code === 'FIRE_CLASS_HP_20')    return { effect_type: 'hp_shield',      effect: 'consumable_class_hp',   effect_value: 20 };
  if (code === 'FIRE_CLASS_XP_100')   return { effect_type: 'xp_boost',       effect: 'consumable_class_xp',   effect_value: 100 };
  if (code === 'FIRE_CLASS_GOLD_50')  return { effect_type: 'gold_bonus',     effect: 'consumable_class_gold', effect_value: 50 };
  if (code === 'FIRE_RANDOM_STUDENT') return { effect_type: 'xp_boost',       effect: 'consumable_random_student', effect_value: 50 };
  // Fire season — passives
  if (code === 'FIRE_GOLD_MULT_10')   return { effect_type: 'gold_bonus',     effect: 'gold_boost',            effect_value: 10 };
  if (code === 'FIRE_BOSS_MULT_20')   return { effect_type: 'xp_boost',       effect: 'boss_dmg',              effect_value: 20 };
  if (code === 'FIRE_DMG_REDUCE_1')   return { effect_type: 'damage_reduce',  effect: 'passive_damage_reduction', effect_value: 1 };
  if (code === 'FIRE_STREAK_SHIELD')  return { effect_type: 'streak_protect', effect: 'streak_protect',        effect_value: 1 };
  if (code === 'FIRE_AUTO_RESURRECT') return { effect_type: 'hp_shield',      effect: 'auto_resurrect',        effect_value: 50 };
  if (code === 'COSMETIC')            return { effect_type: 'xp_boost',       effect: 'cosmetic',              effect_value: 0 };
  // Default
  return { effect_type: 'xp_boost', effect: code.toLowerCase(), effect_value: 0 };
}

// ─── Shorthand builder ───────────────────────────────────────

function art(
  key: string, name: string, desc: string, rarity: Rarity, icon: string,
  type: ArtifactType, code: string,
  opts: Partial<Pick<ArtifactEntry, 'duration_hours' | 'drop_rate' | 'max_charges' | 'req_level' | 'is_shopable' | 'stackable' | 'season_tag'>> = {}
): ArtifactEntry {
  const db = mapEffectToDB(code);
  return {
    key, name, description: desc, rarity,
    icon: key.startsWith('lootbox_') ? (key === 'lootbox_fire' ? '/assets/artifacts/chest_v3_fire.png' : `/assets/lootboxes/${key.split('_')[1]}.png`) : `/assets/artifacts/${key}.png`,
    artifact_type: type,
    effect_type: db.effect_type, effect: db.effect, effect_value: db.effect_value,
    duration_hours: opts.duration_hours ?? 0,
    drop_rate: opts.drop_rate ?? (rarity === 'common' ? 0.20 : rarity === 'rare' ? 0.08 : rarity === 'epic' ? 0.03 : rarity === 'royal' ? 0.001 : 0.01),
    max_charges: opts.max_charges ?? (type === 'consumable' ? 1 : 0),
    req_level: opts.req_level ?? 1,
    is_shopable: opts.is_shopable ?? false,
    stackable: opts.stackable ?? false,
    effect_code: code,
    season_tag: opts.season_tag,
  };
}

// ═══════════════════════════════════════════════════════════════
// THE REGISTRY — every artifact in one place
// ═══════════════════════════════════════════════════════════════

export const ARTIFACT_REGISTRY: ArtifactEntry[] = [
  // ── 📦 LOOTBOXES (5) ──
  art('lootbox_common',    'Обычный Сундук',         'Содержит обычный предмет',                 'common', '📦', 'consumable', 'LOOTBOX_COMMON',   { is_shopable: true }),
  art('lootbox_rare',      'Редкий Сундук',          'Содержит редкий предмет',                  'rare', '🎁', 'consumable', 'LOOTBOX_RARE',     { is_shopable: true }),
  art('lootbox_epic',      'Эпический Сундук',       'Содержит эпический предмет',               'epic', '🧰', 'consumable', 'LOOTBOX_EPIC',     { is_shopable: true }),
  art('lootbox_legendary', 'Легендарный Сундук',     'Содержит легендарный лут',                 'legendary', '👑', 'consumable', 'LOOTBOX_LEGENDARY', { is_shopable: true }),
  art('lootbox_fire',      'Огненный Сундук',        'Содержит артефакт Огненного Сезона',       'rare', '🔥', 'consumable', 'LOOTBOX_FIRE',     { season_tag: 'fire' }),

  // ── 🟢 COMMON (10) ──
  art('com_potion',    'Малое Снадобье Памяти',  'Восстанавливает 30 HP',                     'common', '🧪', 'consumable', 'HEAL_30',          { is_shopable: true, drop_rate: 0.25 }),
  art('com_pen',       'Ученическое Перо',       'XP +10% на 24 часа',                       'common', '🪶', 'passive',    'XP_BOOST_10',      { duration_hours: 24, is_shopable: true }),
  art('com_shield',    'Деревянный Щит',         '-10% к урону (3 заряда)',                   'common', '🛡️', 'passive',    'DMG_REDUCE_10',    { max_charges: 3, is_shopable: true }),
  art('com_parchment', 'Рваный Пергамент',       'Gold +10% на 24 часа',                     'common', '📜', 'passive',    'GOLD_BOOST_10',    { duration_hours: 24, is_shopable: true }),
  art('com_coin',      'Медная Монета',          '+5 Gold за квест (3 заряда)',               'common', '🪙', 'passive',    'FLAT_GOLD_5',      { max_charges: 3, is_shopable: true }),
  art('com_scroll',    'Свиток Концентрации',    'Блокирует 50% урона (1 заряд)',             'common', '📃', 'passive',    'DMG_REDUCE_50',    { max_charges: 1, req_level: 2 }),
  art('com_ring',      'Бронзовое Кольцо',       'Gold +5% постоянно',                       'common', '💍', 'passive',    'GOLD_BOOST_5',     { req_level: 2 }),
  art('com_ink',       'Флакон Чернил',          '-5 к урону (5 зарядов)',                    'common', '🖋️', 'passive',    'FLAT_DMG_REDUCE_5',{ max_charges: 5, req_level: 3 }),
  art('com_cloak',     'Плащ Новичка',           'XP +5%, Gold +5% на 12 часов',             'common', '🧥', 'passive',    'XP_GOLD_5',        { duration_hours: 12, req_level: 3 }),
  art('com_magnet',    'Магнит Жадности',        'Gold +20% на 6 часов',                     'common', '🧲', 'passive',    'GOLD_BOOST_20',    { duration_hours: 6, req_level: 4 }),

  // ── 🔵 RARE (10) ──
  art('rar_potion',    'Среднее Зелье Бодрости', 'Восстанавливает 60 HP',                     'rare', '🧪', 'consumable', 'HEAL_60',           { req_level: 5, is_shopable: true }),
  art('rar_armor',     'Броня Усидчивости',      '-30% к урону (5 зарядов)',                  'rare', '🛡️', 'passive',    'DMG_REDUCE_30',     { max_charges: 5, req_level: 5, is_shopable: true }),
  art('rar_pouch',     'Кошель Удачи',           'Gold +30% на 48 часов',                    'rare', '👛', 'passive',    'GOLD_BOOST_30',     { duration_hours: 48, req_level: 5 }),
  art('rar_candle',    'Свеча Полуночника',      'Защищает стрик от сброса (1 заряд)',        'rare', '🕯️', 'passive',    'PROTECT_STREAK',    { max_charges: 1, req_level: 5, is_shopable: true }),
  art('rar_pen',       'Перо Калиграфа',         'XP +20% на 24 часа',                       'rare', '✒️',  'passive',    'XP_BOOST_20',       { duration_hours: 24, req_level: 6 }),
  art('rar_amulet',    'Серебряный Амулет',      'XP +15%, Gold +15% на 48 часов',           'rare', '📿', 'passive',    'XP_GOLD_15',        { duration_hours: 48, req_level: 7 }),
  art('rar_shield',    'Щит Стражника',          '-50% к урону (2 заряда)',                   'rare', '🛡️', 'passive',    'DMG_REDUCE_50',     { max_charges: 2, req_level: 8 }),
  art('rar_focus',     'Зелье Фокуса',           'Мгновенно даёт +100 XP',                   'rare', '🧪', 'consumable', 'FLAT_XP_100',       { req_level: 8 }),
  art('rar_cloak',     'Плащ Ветра',             'Полностью блокирует одну ошибку (1 заряд)', 'rare', '🪭', 'passive',    'BLOCK_ONE_MISTAKE', { max_charges: 1, req_level: 9 }),
  art('rar_elixir',    'Эликсир Озарения',       'XP +50% на 5 часов',                       'rare', '⚗️', 'passive',    'XP_BOOST_50',       { duration_hours: 5, req_level: 9 }),

  // ── 🟣 EPIC (10) ──
  art('epi_orb',       'Сфера Архимага',         'XP +50% за классную работу (3 заряда)',      'epic', '🔮', 'passive',    'CLASSWORK_XP_50',   { max_charges: 3, req_level: 15 }),
  art('epi_shield',    'Мифриловый Щит',         'Блокирует критический урон (2 заряда)',      'epic', '🛡️', 'passive',    'BLOCK_CRITICAL_DMG',{ max_charges: 2, req_level: 15 }),
  art('epi_scroll',    'Свиток Выходного Дня',   'Пропуск домашки без потери HP',              'epic', '📜', 'consumable', 'SKIP_HOMEWORK',     { req_level: 15 }),
  art('epi_potion',    'Большое Зелье',          'Полностью восстанавливает HP',              'epic', '🧪', 'consumable', 'HEAL_100',          { req_level: 15, is_shopable: true }),
  art('epi_cup',       'Золотая Чаша',           'Gold +100% на 48 часов',                    'epic', '🏆', 'passive',    'GOLD_BOOST_100',    { duration_hours: 48, req_level: 16 }),
  art('epi_rune',      'Руна Знаний',            'XP +50% на 48 часов',                      'epic', '🔷', 'passive',    'XP_BOOST_50',       { duration_hours: 48, req_level: 17 }),
  art('epi_armor',     'Адамантитовый Нагрудник', '-70% к урону (3 заряда)',                   'epic', '🦺', 'passive',    'DMG_REDUCE_70',     { max_charges: 3, req_level: 18 }),
  art('epi_crystal',   'Кристалл Охотника',      '+200 XP за босс-битву (1 заряд)',           'epic', '💎', 'passive',    'FLAT_BOSS_XP_200',  { max_charges: 1, req_level: 19 }),
  art('epi_ring',      'Кольцо Алхимика',        'XP +50%, Gold +50% на 24 часа',            'epic', '💍', 'passive',    'XP_GOLD_50',        { duration_hours: 24, req_level: 20 }),
  art('epi_feather',   'Младшее Перо Феникса',   'Спасает от гибели, оставляя 30 HP (1 заряд)', 'epic', '🪶', 'passive',    'PREVENT_DEATH_30',  { max_charges: 1, req_level: 20 }),

  // ── 🟡 LEGENDARY (10) ──
  art('leg_crown',     'Корона Академии',        'XP +100%, Gold +50% на 7 дней',             'legendary', '👑', 'passive',    'XP_GOLD_MASSIVE',   { duration_hours: 168, req_level: 25 }),
  art('leg_hourglass', 'Песочные Часы Времени',  'Позволяет переделать квест',                'legendary', '⏳', 'consumable', 'RETRY_QUEST',       { req_level: 25 }),
  art('leg_cross',     'Крест Возрождения',      'Спасает от гибели, оставляя 50 HP (1 заряд)', 'legendary', '✝️',  'passive',    'PREVENT_DEATH_50',  { max_charges: 1, req_level: 26 }),
  art('leg_staff',     'Посох Властителя',       '+200 XP за классную работу (5 зарядов)',    'legendary', '🏑', 'passive',    'CLASSWORK_XP_200',  { max_charges: 5, req_level: 27 }),
  art('leg_dragon',    'Золотой Дракон',         'Gold ×3 на 7 дней',                         'legendary', '🐉', 'passive',    'GOLD_MULTIPLIER_3X',{ duration_hours: 168, req_level: 28 }),
  art('leg_aegis',     'Непробиваемая Эгида',    'Блокирует любой урон (3 заряда)',            'legendary', '🛡️', 'passive',    'BLOCK_ALL_MISTAKES',{ max_charges: 3, req_level: 29 }),
  art('leg_elixir',    'Эликсир Гения',          'Мгновенное повышение уровня',               'legendary', '🧪', 'consumable', 'FORCE_LEVEL_UP',    { req_level: 30 }),
  art('leg_ringall',   'Кольцо Всевластия',      '+10% XP всему классу на 7 дней',            'legendary', '💍', 'passive',    'TEAM_XP_10',        { duration_hours: 168, req_level: 32 }),
  art('leg_scroll',    'Свиток Истины',           'Урон боссу ×3 (1 заряд)',                   'legendary', '📜', 'passive',    'BOSS_MULTIPLIER_3X',{ max_charges: 1, req_level: 35 }),
  art('leg_star',      'Звезда Академии',        'Бесконечный стрик на 30 дней',              'legendary', '⭐', 'passive',    'INFINITE_STREAK',   { duration_hours: 720, req_level: 40 }),

  // ── 👑 ROYAL SET (5) ──
  art('roy_mantle',    'Мантия Прогульщика',     'Часть Королевского набора',                 'royal', '👘', 'passive', 'ROYAL_PIECE'),
  art('roy_scepter',   'Скипетр Отгула',         'Часть Королевского набора',                 'royal', '🔱', 'passive', 'ROYAL_PIECE'),
  art('roy_orb',       'Держава Лени',           'Часть Королевского набора',                 'royal', '🔮', 'passive', 'ROYAL_PIECE'),
  art('roy_crown',     'Корона Свободы',         'Часть Королевского набора',                 'royal', '👑', 'passive', 'ROYAL_PIECE'),
  art('roy_seal',      'Печать Директора',       'Часть Королевского набора',                 'royal', '🔏', 'passive', 'ROYAL_PIECE'),

  // ── 🔥 FIRE SEASON (25) ──
  art('fire_coals',            'Угли Мотивации',     'Восстанавливает 10 HP',                'common', '🔥', 'consumable', 'FIRE_HP_10',           { season_tag: 'fire' }),
  art('fire_spark',            'Искра Гения',        'Мгновенно даёт +50 XP',               'common', '✨', 'consumable', 'FIRE_XP_50',           { season_tag: 'fire' }),
  art('fire_phoenix_extract',  'Экстракт Феникса',   'Полностью восстанавливает HP',         'common', '🧪', 'consumable', 'FIRE_FULL_HP',         { season_tag: 'fire' }),
  art('fire_dwarven_ingot',    'Слиток Гномов',      'Мгновенно даёт +100 Gold',            'common', '🪙', 'consumable', 'FIRE_GOLD_100',        { season_tag: 'fire' }),
  art('fire_magma_vial',       'Флакон Магмы',       'Мгновенно даёт +200 XP',              'common', '🧪', 'consumable', 'FIRE_XP_200',          { season_tag: 'fire' }),
  art('fire_coal_stone',       'Угольный Камень',    'Наносит 500 урона боссу',             'common', '🪨', 'consumable', 'FIRE_BOSS_500',        { season_tag: 'fire' }),
  art('fire_ashes',            'Пепел Предков',      'Даёт +50 сезонного XP',               'common', '🏺', 'consumable', 'FIRE_SEASON_XP_50',    { season_tag: 'fire' }),
  art('fire_volcano_tear',     'Слеза Вулкана',      'Мгновенно даёт +50 Gold',             'common', '💧', 'consumable', 'FIRE_RANDOM_GOLD',     { season_tag: 'fire' }),
  art('fire_hellfire_elixir',  'Эликсир Пекла',      '+100 XP, +50 Gold, +25 HP',           'common', '⚗️', 'consumable', 'FIRE_COMBO',           { season_tag: 'fire' }),
  art('fire_ring',             'Кольцо Огня',        'Gold +10% постоянно',                 'common', '💍', 'passive',    'FIRE_GOLD_MULT_10',    { season_tag: 'fire' }),
  art('fire_berserker',        'Зелье Берсерка',     'Наносит 100 урона боссу',             'common', '🧪', 'consumable', 'FIRE_BOSS_RANDOM',     { season_tag: 'fire' }),
  art('fire_lava_amulet',      'Лавовый Амулет',     '-1 к урону постоянно',                'common', '📿', 'passive',    'FIRE_DMG_REDUCE_1',    { season_tag: 'fire' }),
  art('fire_dragon_scale',     'Драконья Чешуйка',   'Защищает стрик от сброса (1 заряд)',  'common', '🐉', 'passive',    'FIRE_STREAK_SHIELD',   { max_charges: 1, season_tag: 'fire' }),
  art('fire_phoenix_feather',  'Огненное Перо',      'Авто-воскрешение с 50 HP (1 заряд)',  'common', '🪶', 'passive',    'FIRE_AUTO_RESURRECT',  { max_charges: 1, season_tag: 'fire' }),
  art('fire_banner',           'Багровое Знамя',     'Украшение профиля героя',             'common', '🏴', 'passive',    'COSMETIC',             { season_tag: 'fire' }),
  art('fire_inquisitor',       'Шлем Инквизитора',   'Украшение профиля героя',             'common', '⛑️', 'passive',    'COSMETIC',             { season_tag: 'fire' }),
  art('fire_eye_ifrit',        'Око Ифрита',         'Украшение профиля героя',             'common', '👁️', 'passive',    'COSMETIC',             { season_tag: 'fire' }),
  art('fire_flaming_sword',    'Пламенный Меч',      'Украшение профиля героя',             'common', '⚔️', 'passive',    'COSMETIC',             { season_tag: 'fire' }),
  art('fire_golden_torch',     'Золотой Факел',      'Украшение профиля героя',             'common', '🔦', 'passive',    'COSMETIC',             { season_tag: 'fire' }),
  art('fire_meteor_scroll',    'Метеоритный Дождь',  'Наносит 3000 урона боссу',            'common', '☄️', 'consumable', 'FIRE_CLASS_BOSS_3000', { season_tag: 'fire' }),
  art('fire_hearth_scroll',    'Тепло Очага',        '+20 HP каждому ученику в классе',     'common', '🏠', 'consumable', 'FIRE_CLASS_HP_20',     { season_tag: 'fire' }),
  art('fire_boom',             'Огненный Бум',       '+100 XP каждому ученику в классе',    'common', '💥', 'consumable', 'FIRE_CLASS_XP_100',    { season_tag: 'fire' }),
  art('fire_dragon_hoard',     'Драконий Клад',      '+50 Gold каждому ученику в классе',   'common', '💰', 'consumable', 'FIRE_CLASS_GOLD_50',   { season_tag: 'fire' }),
  art('fire_friendship_match', 'Спичка Дружбы',      '+50 XP и Gold случайному однокласснику', 'common', '🔥', 'consumable', 'FIRE_RANDOM_STUDENT',  { season_tag: 'fire' }),
  art('fire_dragon_claw',      'Коготь Дракона',     '+20% урона боссу постоянно',         'common', '🐲', 'passive',    'FIRE_BOSS_MULT_20',    { season_tag: 'fire' }),
  art('fire_team_boss_potion', 'Огненный Натиск',    '+20% урона боссу всему классу на 24 часа', 'rare', '🔥', 'passive',    'TEAM_BOSS_20',         { duration_hours: 24, season_tag: 'fire' }),
];

// ─── Indexed lookups ─────────────────────────────────────────

/** Map key → ArtifactEntry for O(1) lookups */
export const REGISTRY_BY_KEY: Record<string, ArtifactEntry> = {};
for (const a of ARTIFACT_REGISTRY) {
  REGISTRY_BY_KEY[a.key] = a;
}

/** Royal Set keys */
export const ROYAL_SET_KEYS = ['roy_mantle', 'roy_scepter', 'roy_orb', 'roy_crown', 'roy_seal'];

// ─── DB seed format ──────────────────────────────────────────

/** Convert registry entry to the format expected by Supabase `artifacts` table INSERT */
export function toDbRow(entry: ArtifactEntry) {
  return {
    name: entry.name,
    description: entry.description,
    rarity: entry.rarity === 'royal' ? 'legendary' : entry.rarity, // DB enum doesn't have 'royal'
    icon: entry.icon,
    effect_type: entry.effect_type,
    effect: entry.effect,
    effect_value: entry.effect_value,
    duration_hours: entry.duration_hours,
    drop_rate: entry.drop_rate,
    max_charges: entry.max_charges,
    is_shopable: entry.is_shopable,
    stackable: entry.stackable,
    artifact_type: entry.artifact_type,
    min_level: entry.req_level,
    season_pool: entry.season_tag,
  };
}

/** Generate all DB rows for seeding */
export function allDbRows() {
  return ARTIFACT_REGISTRY.map(toDbRow);
}
