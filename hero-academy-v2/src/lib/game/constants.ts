import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/* ═══════ Unified difficulty mapping ═══════
 * Quest DB stores difficulty as text: easy / medium / hard
 * Drop system needs a number 1–5.
 */
export const DIFFICULTY_MAP: Record<string, number> = {
  easy:   1,
  medium: 3,
  hard:   5,
};

/* ═══════ Quest type → drop rate multiplier ═══════ */
export const QUEST_TYPE_DROP_MULT: Record<string, number> = {
  quest:   0.5,   // ДЗ — lowest
  dungeon: 1.0,   // Контрольная
  boss:    2.0,   // Босс — highest
};

/* ═══════ Cumulative XP System ═══════
 * XP NEVER resets on level-up. It accumulates forever.
 * Level is determined by total XP thresholds.
 *
 * Per-level cost: xpPerLevel(L) = 1000 + L * 500
 *   Level 1→2: 1500,  Level 2→3: 2000,  Level 3→4: 2500 ...
 *
 * Cumulative threshold: cumulativeXpForLevel(L) = (L-1) * (1000 + 250*L)
 *   Level 2: 1500,  Level 3: 3500,  Level 4: 6000,  Level 5: 9000 ...
 *
 * This is the SINGLE SOURCE OF TRUTH for level progression.
 */

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
  return { current, needed, percent: needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 0 };
}

/**
 * Apply XP gain (cumulative — never resets).
 * Returns { xp, level, xpNext, levelUps }
 * xp = new total XP, xpNext = cumulative threshold for next level.
 */
export function applyXpGain(currentXp: number, currentLevel: number, _currentXpNext: number | null, xpGain: number) {
  const xp = currentXp + xpGain;
  let level = currentLevel;
  const levelUps: number[] = [];

  // Level-up loop: advance while total XP >= threshold for next level
  while (xp >= cumulativeXpForLevel(level + 1)) {
    level++;
    levelUps.push(level);
  }

  const xpNext = cumulativeXpForLevel(level + 1);
  return { xp, level, xpNext, levelUps };
}

/* ═══════ Shared Economy Config ═══════
 * Single source of truth for loading economy multipliers.
 * Cascade: class → school → global
 */
export interface EconomyConfig {
  dmg_multiplier: number;
  xp_multiplier: number;
  gold_multiplier: number;
  drop_rate_multiplier: number;
  boss_hp_multiplier: number;
}

export const DEFAULT_ECO: EconomyConfig = {
  dmg_multiplier: 100,
  xp_multiplier: 100,
  gold_multiplier: 100,
  drop_rate_multiplier: 100,
  boss_hp_multiplier: 100,
};

/**
 * Load economy config for a class. Fallback cascade: class → school → global.
 * Accepts either classId directly, or heroId (will resolve to classId).
 */
export async function getEconomyConfig(opts: { classId?: string; heroId?: string }): Promise<EconomyConfig> {
  let classId = opts.classId;
  let schoolId: string | undefined;

  if (!classId && opts.heroId) {
    // Resolve heroId → userId → classId/schoolId
    const { data: hero } = await admin.from('heroes').select('user_id').eq('id', opts.heroId).single();
    if (!hero) return DEFAULT_ECO;
    const { data: user } = await admin.from('users').select('class_id, school_id').eq('id', hero.user_id).single();
    if (!user) return DEFAULT_ECO;
    classId = user.class_id;
    schoolId = user.school_id;
  } else if (classId && !schoolId) {
    const { data: cls } = await admin.from('classes').select('school_id').eq('id', classId).single();
    schoolId = cls?.school_id;
  }

  const keys: string[] = [];
  if (classId) keys.push(`scope_class_${classId}`);
  if (schoolId) keys.push(`scope_school_${schoolId}`);
  keys.push('scope_global');

  for (const key of keys) {
    const { data } = await admin.from('economy_config').select('value').eq('key', key).maybeSingle();
    if (data?.value) {
      const v = data.value as Record<string, number>;
      return {
        dmg_multiplier:       v.dmg_multiplier       ?? 100,
        xp_multiplier:        v.xp_multiplier        ?? 100,
        gold_multiplier:      v.gold_multiplier      ?? 100,
        drop_rate_multiplier: v.drop_rate_multiplier ?? 100,
        boss_hp_multiplier:   v.boss_hp_multiplier   ?? 100,
      };
    }
  }
  return DEFAULT_ECO;
}

/* ═══════ Activity Log Action Names ═══════
 * Single source of truth for all action strings in activity_log.
 */
export const ACTIVITY_ACTIONS = {
  TEACHER_DAMAGE:     'teacher_damage',
  TEACHER_XP_GRANT:   'teacher_xp_grant',
  TEACHER_GOLD_GRANT: 'teacher_gold_grant',
  QUEST_GRADED:       'quest_graded',
  QUEST_COMPLETE:     'quest_complete',
  BOSS_DAMAGE:        'boss_damage',
  BOSS_KILL_REWARD:   'boss_kill_reward',
  ARTIFACT_DROP:      'artifact_drop',
  SHOP_PURCHASE:      'shop_purchase',
  POTION_USED:        'potion_used',
  LOOTBOX_OPENED:     'lootbox_opened',
  STREAK_UPDATE:      'streak_update',
  STREAK_REWARD:      'streak_reward',   // legacy — historical logs
  LEVEL_UP:           'level_up',
  ADMIN_UNDO:         'admin_undo',
} as const;

/* ═══════ Rarity weights per numeric difficulty ═══════ */
const RARITY_WEIGHTS: Record<number, number[]> = {
  1: [85, 14, 1,   0],
  2: [70, 25, 4.5, 0.5],
  3: [55, 33, 10,  2],
  4: [40, 35, 19,  6],
  5: [25, 35, 28,  12],
};
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

/**
 * Roll for an artifact drop after a quest/grade event.
 *
 * @param heroId          – hero receiving the potential drop
 * @param heroLevel       – hero's current level (affects min_level filter + level bonus)
 * @param questType       – 'quest' | 'dungeon' | 'boss' (affects base chance)
 * @param difficulty      – numeric 1–5 (affects rarity weights)
 * @param dropRateMultiplier – admin economy_config multiplier (default 100 = 100%)
 * @returns dropped artifact info, or null
 */
export async function rollArtifactDrop(
  heroId: string,
  heroLevel: number,
  questType: string = 'quest',
  difficulty: number = 1,
  dropRateMultiplier: number = 100,
): Promise<{ id: string; name: string; icon: string; rarity: string } | null> {

  // Step 1: Should anything drop at all?
  const typeMult = QUEST_TYPE_DROP_MULT[questType] ?? 1.0;
  const levelBonus = 1 + Math.min(heroLevel * 0.01, 0.5);
  const baseDropChance = (0.08 + (difficulty - 1) * 0.02) * (dropRateMultiplier / 100);
  const dropChance = baseDropChance * typeMult * levelBonus;

  if (Math.random() > dropChance) return null;

  // Step 2: Pick rarity based on difficulty
  const clampedDiff = Math.min(5, Math.max(1, Math.round(difficulty)));
  const weights = RARITY_WEIGHTS[clampedDiff] ?? RARITY_WEIGHTS[1];
  const totalW = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * totalW;
  let chosenRarity = 'common';
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { chosenRarity = RARITIES[i]; break; }
  }

  // Step 3: Pick random artifact of that rarity
  const { data: catalog } = await admin
    .from('artifacts')
    .select('id, name, icon, rarity, effect, min_level, max_charges, duration_hours')
    .eq('rarity', chosenRarity)
    .neq('effect', 'lootbox')
    .lte('min_level', heroLevel);

  if (!catalog || catalog.length === 0) return null;

  // Filter out royal set
  const eligible = catalog.filter((a: Record<string, unknown>) => {
    const eff = String(a.effect ?? '');
    return !eff.startsWith('royal_set');
  });
  if (eligible.length === 0) return null;

  // Pick random from eligible
  const pick = eligible[Math.floor(Math.random() * eligible.length)] as Record<string, unknown>;
  const maxCharges = Number(pick.max_charges) || 0;
  const durationHours = Number(pick.duration_hours) || 0;

  await admin.from('hero_artifacts').insert({
    hero_id: heroId,
    artifact_id: pick.id,
    source: 'drop',
    quantity: 1,
    charges_remaining: maxCharges > 0 ? maxCharges : 1,
    expires_at: durationHours > 0
      ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
      : null,
  });

  return {
    id: String(pick.id),
    name: String(pick.name),
    icon: String(pick.icon),
    rarity: String(pick.rarity),
  };
}

/* ═══════ Boss Kill Reward Distribution ═══════
 * Called when a subject_boss reaches 0 HP.
 * Distributes XP, Gold, and lootboxes to ALL alive heroes in the class.
 *
 * Pool:   25,000 XP  /  5,000 Gold  (split by damage %)
 * MVP:    +2,000 XP
 * LastHit: +1,000 XP
 * Lootbox: tier = heroLevel bracket + dmg% bonus + MVP bonus
 */
export async function distributeBossKillRewards(opts: {
  bossId: string;
  classId: string;
  subject: string;
  lastHitHeroId: string;   // hero who dealt the killing blow
  teacherId: string;       // for activity_log user_id
}): Promise<{ heroesRewarded: number }> {
  const { bossId, classId, subject, lastHitHeroId, teacherId } = opts;

  const poolXp = 25000;
  const poolGold = 5000;
  const mvpBonusXp = 2000;
  const lastHitBonusXp = 1000;

  // 1. Get total damage per hero for this boss
  const { data: logs } = await admin.from('boss_damage_logs')
    .select('hero_id, damage_dealt')
    .eq('boss_id', bossId);

  const damageMap: Record<string, number> = {};
  let totalDamage = 0;
  if (logs) {
    for (const log of logs) {
      damageMap[log.hero_id] = (damageMap[log.hero_id] || 0) + log.damage_dealt;
      totalDamage += log.damage_dealt;
    }
  }

  // Identify MVP (highest total damage)
  let mvpHeroId: string | null = null;
  let maxDmg = 0;
  for (const [hId, dmg] of Object.entries(damageMap)) {
    if (dmg > maxDmg) { maxDmg = dmg; mvpHeroId = hId; }
  }

  // 2. Fetch all alive students in class with their hero data
  const { data: classStudents } = await admin.from('users')
    .select('id, heroes!left(id, hp, xp, gold, level, xp_to_next, season_xp)')
    .eq('class_id', classId)
    .eq('role', 'student');

  if (!classStudents) return { heroesRewarded: 0 };

  let rewarded = 0;

  for (const st of classStudents) {
    const hr = Array.isArray(st.heroes) ? st.heroes[0] : st.heroes as Record<string, unknown> | null;
    if (!hr || (hr as any).hp <= 0) continue; // Only alive heroes

    const heroId = String((hr as any).id);
    const myDmg = damageMap[heroId] || 0;

    // Consolation prize for alive students who did 0 damage
    let myXp = 100;
    let myGold = 25;
    let metadataStr = `Победа класса над боссом по предмету "${subject}"! (Утешительный приз)`;

    if (myDmg > 0 && totalDamage > 0) {
      const dmgPercent = myDmg / totalDamage;
      myXp = Math.round(poolXp * dmgPercent);
      myGold = Math.round(poolGold * dmgPercent);
      metadataStr = `Награда за ${Math.round(dmgPercent * 100)}% урона по Боссу (${subject})!`;
    }

    if (heroId === mvpHeroId) {
      myXp += mvpBonusXp;
      metadataStr += ` + MVP Бонус!`;
    }

    if (heroId === lastHitHeroId) {
      myXp += lastHitBonusXp;
      metadataStr += ` + Добивающий удар!`;
    }

    // Apply XP with cumulative level-up
    const { xp: bkXp, level: bkLevel, xpNext: bkXpNext, levelUps: bkLevelUps } = applyXpGain(
      (hr as any).xp ?? 0, (hr as any).level ?? 1, (hr as any).xp_to_next, myXp
    );
    const heroUpd: Record<string, unknown> = { xp: bkXp, gold: ((hr as any).gold ?? 0) + myGold, season_xp: ((hr as any).season_xp ?? 0) + myXp };
    if (bkLevelUps.length > 0) { heroUpd.level = bkLevel; heroUpd.xp_to_next = bkXpNext; }
    await admin.from('heroes').update(heroUpd).eq('id', heroId);

    // Activity log
    const dmgPct = totalDamage > 0 ? myDmg / totalDamage : 0;
    await admin.from('activity_log').insert({
      hero_id: heroId,
      user_id: teacherId,
      action: ACTIVITY_ACTIONS.BOSS_KILL_REWARD,
      xp_change: myXp,
      gold_change: myGold,
      metadata: {
        reason: metadataStr,
        damage_dealt: myDmg,
        is_mvp: heroId === mvpHeroId,
        is_last_hit: heroId === lastHitHeroId,
        level_ups: bkLevelUps,
      },
    });

    // LOOTBOX: tier by level bracket + damage %
    const LEVEL_CAPS: [number, string][] = [[15,'common'],[30,'rare'],[45,'epic'],[100,'legendary']];
    const TIERS = ['common','rare','epic','legendary'];
    const baseTier = LEVEL_CAPS.find(([cap]) => bkLevel <= cap)?.[1] ?? 'legendary';
    let tierIdx = TIERS.indexOf(baseTier);
    if (dmgPct >= 0.40) tierIdx = Math.min(3, tierIdx + 2);
    else if (dmgPct >= 0.25) tierIdx = Math.min(3, tierIdx + 1);
    if (heroId === mvpHeroId) tierIdx = Math.min(3, tierIdx + 1);
    if (myDmg === 0) tierIdx = Math.max(0, tierIdx - 1);
    const boxTier = TIERS[tierIdx];

    const { data: bossBox } = await admin.from('artifacts')
      .select('id, name').eq('effect','lootbox').eq('rarity', boxTier).maybeSingle();
    if (bossBox) {
      await admin.from('hero_artifacts').insert({
        hero_id: heroId, artifact_id: bossBox.id,
        source: 'reward', quantity: 1, charges_remaining: 1,
      });
      await admin.from('activity_log').insert({
        hero_id: heroId, user_id: teacherId, action: ACTIVITY_ACTIONS.ARTIFACT_DROP,
        metadata: { artifact: bossBox.name, rarity: boxTier, source: 'boss_kill', dmg_pct: Math.round(dmgPct * 100) },
      });
    }

    rewarded++;
  }

  return { heroesRewarded: rewarded };
}
