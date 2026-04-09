import { createClient } from '@supabase/supabase-js';

// ── Re-export pure math from the single source of truth ──
export { xpPerLevel, cumulativeXpForLevel, xpToNext, xpProgress, applyXpGain } from '@/lib/game/math';
import { cumulativeXpForLevel, applyXpGain } from '@/lib/game/math';

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

/* ═══════ Shared Economy Config ═══════
 * Single source of truth for loading economy multipliers.
 * Cascade: class → school → global
 *
 * OPTIMIZED: 30-second in-memory cache per classId to avoid
 * repeated DB hits on hot paths (grade-batch processes 30 students).
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

// ── In-memory cache (TTL = 30s) ──
const ecoCache = new Map<string, { config: EconomyConfig; ts: number }>();
const ECO_CACHE_TTL_MS = 30_000;

function getCachedEco(cacheKey: string): EconomyConfig | null {
  const entry = ecoCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < ECO_CACHE_TTL_MS) return entry.config;
  return null;
}

function setCachedEco(cacheKey: string, config: EconomyConfig) {
  ecoCache.set(cacheKey, { config, ts: Date.now() });
  // Evict old entries if cache grows too large
  if (ecoCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of ecoCache) {
      if (now - v.ts > ECO_CACHE_TTL_MS) ecoCache.delete(k);
    }
  }
}

/**
 * Load economy config for a class. Fallback cascade: class → school → global.
 * Accepts either classId directly, or heroId (will resolve to classId).
 * Results are cached for 30 seconds per classId.
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

  // Check cache
  const cacheKey = classId ?? 'global';
  const cached = getCachedEco(cacheKey);
  if (cached) return cached;

  // Build scope keys for cascade fallback
  const keys: string[] = [];
  if (classId) keys.push(`scope_class_${classId}`);
  if (schoolId) keys.push(`scope_school_${schoolId}`);
  keys.push('scope_global');

  // Fetch all matching configs in ONE query (instead of sequential)
  const { data: rows } = await admin.from('economy_config')
    .select('key, value')
    .in('key', keys);

  // Apply cascade priority: class > school > global
  if (rows && rows.length > 0) {
    const byKey = new Map(rows.map(r => [r.key, r.value as Record<string, number>]));
    for (const key of keys) {
      const v = byKey.get(key);
      if (v) {
        const result: EconomyConfig = {
          dmg_multiplier:       v.dmg_multiplier       ?? 100,
          xp_multiplier:        v.xp_multiplier        ?? 100,
          gold_multiplier:      v.gold_multiplier      ?? 100,
          drop_rate_multiplier: v.drop_rate_multiplier ?? 100,
          boss_hp_multiplier:   v.boss_hp_multiplier   ?? 100,
        };
        setCachedEco(cacheKey, result);
        return result;
      }
    }
  }

  setCachedEco(cacheKey, DEFAULT_ECO);
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
  let dropChance = baseDropChance * typeMult * levelBonus;

  // Бескомпромиссная гарантия дропа за Босса и тяжелые контрольные
  const isHeavyTask = questType === 'boss' || difficulty >= 4;
  if (isHeavyTask) {
    dropChance = 1.0;
  }

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

  // Step 3: Fetch artifacts
  let query = admin
    .from('artifacts')
    .select('id, name, icon, rarity, effect, min_level, max_charges, duration_hours, drop_rate')
    .eq('rarity', chosenRarity)
    .lte('min_level', heroLevel)
    .is('season_pool', null); // Исключаем сезонные (они выпадают иначе)

  if (isHeavyTask) {
    // Выдаем только Лутбоксы
    query = query.eq('effect_type', 'lootbox');
  } else {
    // В обычной домашке лутбоксы не выпадают
    query = query.neq('effect_type', 'lootbox').neq('effect', 'lootbox');
  }

  const { data: catalog } = await query;

  if (!catalog || catalog.length === 0) return null;

  // Filter out royal set
  const eligible = catalog.filter((a: Record<string, unknown>) => {
    const eff = String(a.effect ?? '');
    return !eff.startsWith('royal_set');
  });
  if (eligible.length === 0) return null;

  // Pick weighted random from eligible using drop_rate
  const totalDropWeight = eligible.reduce((sum, a: Record<string, unknown>) => sum + (Number(a.drop_rate) || 0.1), 0);
  let r = Math.random() * totalDropWeight;
  let pick = eligible[0] as Record<string, unknown>;
  for (const a of eligible) {
    const w = Number((a as Record<string, unknown>).drop_rate) || 0.1;
    r -= w;
    if (r <= 0) {
      pick = a as Record<string, unknown>;
      break;
    }
  }
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

/* ═══════ Boss Kill Reward Distribution (BATCHED) ═══════
 * Called when a subject_boss reaches 0 HP.
 * Distributes XP, Gold, and lootboxes to ALL alive heroes in the class.
 *
 * Pool:   25,000 XP  /  5,000 Gold  (split by damage %)
 * MVP:    +2,000 XP
 * LastHit: +1,000 XP
 * Lootbox: tier = heroLevel bracket + dmg% bonus + MVP bonus
 *
 * OPTIMIZED: All DB writes are batched (6 queries total, not N*5).
 */
export async function distributeBossKillRewards(opts: {
  bossId: string;
  classId: string;
  subject: string;
  lastHitHeroId: string;
  teacherId: string;
}): Promise<{ heroesRewarded: number }> {
  const { bossId, classId, subject, lastHitHeroId, teacherId } = opts;

  const poolXp = 25000;
  const poolGold = 5000;
  const mvpBonusXp = 2000;
  const lastHitBonusXp = 1000;

  // 1. Get total damage per hero for this boss (1 query)
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

  let mvpHeroId: string | null = null;
  let maxDmg = 0;
  for (const [hId, dmg] of Object.entries(damageMap)) {
    if (dmg > maxDmg) { maxDmg = dmg; mvpHeroId = hId; }
  }

  // 2. Fetch all alive students + hero data (1 query)
  const { data: classStudents } = await admin.from('users')
    .select('id, heroes!left(id, hp, xp, gold, level, xp_to_next, season_xp)')
    .eq('class_id', classId)
    .eq('role', 'student');

  if (!classStudents) return { heroesRewarded: 0 };

  // 3. Pre-fetch all lootbox artifacts (1 query instead of N)
  const { data: lootboxes } = await admin.from('artifacts')
    .select('id, name, rarity')
    .eq('effect', 'lootbox');
  const lootboxByTier: Record<string, { id: string; name: string }> = {};
  if (lootboxes) {
    for (const lb of lootboxes) {
      lootboxByTier[lb.rarity] = { id: lb.id, name: lb.name };
    }
  }

  // 4. Compute all rewards in memory (0 queries)
  const LEVEL_CAPS: [number, string][] = [[15,'common'],[30,'rare'],[45,'epic'],[100,'legendary']];
  const TIERS = ['common','rare','epic','legendary'];

  // Local shape for the joined heroes row we select above.
  // Only lists the fields that we actually read in this loop.
  interface HeroRow {
    id: string;
    hp: number;
    xp: number;
    gold: number;
    level: number;
    xp_to_next: number;
    season_xp: number | null;
  }

  const heroUpdates: { id: string; data: Record<string, unknown> }[] = [];
  const activityLogs: Record<string, unknown>[] = [];
  const lootboxInserts: Record<string, unknown>[] = [];

  for (const st of classStudents) {
    const hrRaw = Array.isArray(st.heroes) ? st.heroes[0] : st.heroes;
    const hr = (hrRaw as unknown as HeroRow | null);
    if (!hr || hr.hp <= 0) continue;

    const heroId = String(hr.id);
    const myDmg = damageMap[heroId] || 0;

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

    const { xp: bkXp, level: bkLevel, xpNext: bkXpNext, levelUps: bkLevelUps } = applyXpGain(
      hr.xp ?? 0, hr.level ?? 1, hr.xp_to_next, myXp
    );
    const heroUpd: Record<string, unknown> = {
      xp: bkXp,
      gold: (hr.gold ?? 0) + myGold,
      season_xp: (hr.season_xp ?? 0) + myXp,
    };
    if (bkLevelUps.length > 0) { heroUpd.level = bkLevel; heroUpd.xp_to_next = bkXpNext; }
    heroUpdates.push({ id: heroId, data: heroUpd });

    const dmgPct = totalDamage > 0 ? myDmg / totalDamage : 0;
    activityLogs.push({
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

    // Lootbox tier calculation
    const baseTier = LEVEL_CAPS.find(([cap]) => bkLevel <= cap)?.[1] ?? 'legendary';
    let tierIdx = TIERS.indexOf(baseTier);
    if (dmgPct >= 0.40) tierIdx = Math.min(3, tierIdx + 2);
    else if (dmgPct >= 0.25) tierIdx = Math.min(3, tierIdx + 1);
    if (heroId === mvpHeroId) tierIdx = Math.min(3, tierIdx + 1);
    if (myDmg === 0) tierIdx = Math.max(0, tierIdx - 1);
    const boxTier = TIERS[tierIdx];

    const bossBox = lootboxByTier[boxTier];
    if (bossBox) {
      lootboxInserts.push({
        hero_id: heroId, artifact_id: bossBox.id,
        source: 'reward', quantity: 1, charges_remaining: 1,
      });
      activityLogs.push({
        hero_id: heroId, user_id: teacherId, action: ACTIVITY_ACTIONS.ARTIFACT_DROP,
        metadata: { artifact: bossBox.name, rarity: boxTier, source: 'boss_kill', dmg_pct: Math.round(dmgPct * 100) },
      });
    }
  }

  // 5. Execute ALL writes in parallel (3 batched queries)
  await Promise.all([
    // Hero updates — Supabase doesn't support multi-row upsert with different values per row,
    // so we batch them into a single Promise.all but it's still ~N updates.
    // For true batch upsert, we'd need a Postgres function. This is still better than sequential.
    Promise.all(heroUpdates.map(h =>
      admin.from('heroes').update(h.data).eq('id', h.id)
    )),
    // Activity logs — single batch insert
    activityLogs.length > 0
      ? admin.from('activity_log').insert(activityLogs)
      : Promise.resolve(),
    // Lootbox inserts — single batch insert
    lootboxInserts.length > 0
      ? admin.from('hero_artifacts').insert(lootboxInserts)
      : Promise.resolve(),
  ]);

  return { heroesRewarded: heroUpdates.length };
}

