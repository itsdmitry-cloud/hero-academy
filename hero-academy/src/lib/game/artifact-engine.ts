/**
 * Hero Academy — Artifact Engine (shared module)
 *
 * Single source of truth for damage classification, charge management,
 * and hero modifier resolution. Used by both game/action and game/grade-batch.
 */

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Types ───────────────────────────────────────────────────

export type DmgClassification = 'full_shield' | 'passive_reduce' | 'none';

export interface PassiveDmgArt {
  heroArtifactId: string;
  name: string;
  value: number;
  chargesLeft: number;   // 0 = duration-based (no charge decrement)
  maxCharges: number;
}

export interface ShieldInfo {
  heroArtifactId: string;
  name: string;
  chargesLeft: number;
}

export interface ProtectiveArt {
  heroArtifactId: string;
  name: string;
  effect: string;
  value: number;
  maxCharges: number;
  chargesLeft: number;
}

export interface ChargeArt {
  heroArtifactId: string;
  chargesLeft: number;
}

export interface HeroMods {
  xpBoost: number;
  passiveDmgReduce: number;
  passiveDmgArts: PassiveDmgArt[];
  bossDmgBoost: number;
  goldBoost: number;
  xpArtifacts: string[];
  xpChargeArts: ChargeArt[];
  bossArtifacts: string[];
  goldArtifacts: string[];
  goldChargeArts: ChargeArt[];
  shield: ShieldInfo | null;
  protectiveArts: ProtectiveArt[];
}

// ─── Classification ──────────────────────────────────────────

/**
 * Classify a damage-related artifact by its `effect` field.
 *
 * FULL SHIELD (100% block + consume 1 charge):
 *   effect = 'damage_shield' AND effect_value >= 100
 *
 * PASSIVE REDUCTION (% reduction + consume 1 charge when damage > 0):
 *   effect = 'dmg_reduce' OR 'passive_damage_reduction'
 *   OR effect = 'damage_shield' AND effect_value < 100
 *
 * NOT IN DAMAGE PIPELINE (handled elsewhere):
 *   death_save, undo_crit, hp_restore, streak_protect, cosmetic, etc.
 */
export function classifyDmgArtifact(eff: string, val: number): DmgClassification {
  if (eff.includes('damage_shield') && val >= 100) return 'full_shield';
  if (eff.includes('dmg_reduce') || eff.includes('passive_damage_reduction')) return 'passive_reduce';
  if (eff.includes('damage_shield') && val < 100 && val > 0) return 'passive_reduce';
  return 'none';
}

// ─── Charge Management ───────────────────────────────────────

/**
 * Decrement 1 charge from a hero_artifact, delete if exhausted.
 */
export async function decrementCharge(heroArtifactId: string, currentCharges: number) {
  const newCharges = currentCharges - 1;
  if (newCharges <= 0) {
    await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);
  } else {
    await admin.from('hero_artifacts').update({ charges_remaining: newCharges }).eq('id', heroArtifactId);
  }
}

// ─── Hero Modifier Resolution ────────────────────────────────

const classAurasCache = new Map<string, { data: { xpBoost: number, bossDmgBoost: number, goldBoost: number, applied: string[] }, expires: number }>();

export async function getClassAuras(heroId: string) {
  // Check local short-lived cache (prevents DB spam during grade-batch loops)
  const cached = classAurasCache.get(heroId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  let xpBoost = 0;
  let bossDmgBoost = 0;
  let goldBoost = 0;
  const applied: string[] = [];
  const emptyResult = { xpBoost, bossDmgBoost, goldBoost, applied };

  // 1. Get classId of current hero
  const { data: heroData } = await admin.from('heroes').select('user_id').eq('id', heroId).single();
  if (!heroData?.user_id) return emptyResult;

  const { data: userData } = await admin.from('users').select('class_id').eq('id', heroData.user_id).single();
  const classId = userData?.class_id;
  if (!classId) return emptyResult;

  // 2. Get other heroes in class
  const { data: students } = await admin.from('users').select('id, display_name').eq('class_id', classId).eq('role', 'student');
  if (!students || students.length === 0) return { xpBoost, bossDmgBoost, goldBoost, applied };

  const studentMap = new Map<string, string>(); // user_id -> name
  students.forEach(s => studentMap.set(s.id, s.display_name));

  const { data: cHeroes } = await admin.from('heroes').select('id, user_id').in('user_id', students.map(s => s.id));
  if (!cHeroes || cHeroes.length === 0) return { xpBoost, bossDmgBoost, goldBoost, applied };

  const otherHeroIds = cHeroes.filter((h: any) => h.id !== heroId).map((h: any) => h.id);
  if (otherHeroIds.length === 0) return { xpBoost, bossDmgBoost, goldBoost, applied };

  const heroNameMap = new Map<string, string>();
  cHeroes.forEach((h: any) => {
    if (h.id !== heroId) {
      heroNameMap.set(h.id, studentMap.get(h.user_id) || 'Студент');
    }
  });

  // 3. Find equipped auras
  const now = new Date();
  const { data: artifacts } = await admin
    .from('hero_artifacts')
    .select('hero_id, expires_at, artifacts!inner(effect, effect_type, effect_value, name)')
    .in('hero_id', otherHeroIds)
    .eq('is_equipped', true);

  if (!artifacts) return { xpBoost, bossDmgBoost, goldBoost, applied };

  for (const a of artifacts as Record<string, any>[]) {
    // Check expiration
    if (a.expires_at && new Date(String(a.expires_at)) < now) continue;

    const art = Array.isArray(a.artifacts) ? a.artifacts[0] : a.artifacts;
    if (!art) continue;

    const eff = String(art.effect ?? '');
    const effType = String(art.effect_type ?? '');
    const val = Number(art.effect_value ?? 0);
    const effects = eff.split(',').map(e => e.trim());
    const effTypes = effType.split(',').map(e => e.trim());

    const isTeamXp = effects.includes('team_xp') || effects.includes('team_xp_boost') || effTypes.includes('team_xp_boost') || effTypes.includes('team_xp') || eff === 'TEAM_XP_10';
    const isTeamBoss = effects.includes('team_boss_dmg') || effTypes.includes('team_boss_dmg');
    const isTeamGold = effects.includes('team_gold') || effTypes.includes('team_gold');

    if (!isTeamXp && !isTeamBoss && !isTeamGold) continue;

    const ownerName = heroNameMap.get(String(a.hero_id)) || 'Аура Класса';

    if (isTeamXp) {
      xpBoost += val;
      applied.push(`Аура: ${art.name} от ${ownerName} (+${val}% XP)`);
    }
    if (isTeamBoss) {
      bossDmgBoost += val;
      applied.push(`Аура: ${art.name} от ${ownerName} (+${val}% Урон Боссу)`);
    }
    if (isTeamGold) {
      goldBoost += val;
      applied.push(`Аура: ${art.name} от ${ownerName} (+${val}% Золото)`);
    }
  }

  const result = { xpBoost, bossDmgBoost, goldBoost, applied };
  
  // Cache for 5 seconds (grade-batch protection)
  classAurasCache.set(heroId, { data: result, expires: Date.now() + 5000 });
  
  return result;
}

/**
 * Load all equipped artifact modifiers for a hero.
 * Resolves: xp boost, gold boost, boss damage boost,
 * passive dmg reduction, full shield, and protective arts.
 */
export async function getHeroMods(heroId: string): Promise<HeroMods> {
  const { data } = await admin
    .from('hero_artifacts')
    .select('id, charges_remaining, artifacts!inner(effect, effect_type, effect_value, name, max_charges)')
    .eq('hero_id', heroId)
    .eq('is_equipped', true)
    .gt('charges_remaining', 0);

  let xpBoost = 0, passiveDmgReduce = 0, bossDmgBoost = 0, goldBoost = 0;
  const xpArtifacts: string[] = [];
  const xpChargeArts: ChargeArt[] = [];
  const passiveDmgArts: PassiveDmgArt[] = [];
  const bossArtifacts: string[] = [];
  const goldArtifacts: string[] = [];
  const goldChargeArts: ChargeArt[] = [];
  let shield: ShieldInfo | null = null;
  const protectiveArts: ProtectiveArt[] = [];

  if (data) {
    for (const a of data as Record<string, unknown>[]) {
      const art = a.artifacts as Record<string, unknown>;
      const eff       = String(art?.effect ?? '');
      const effType   = String(art?.effect_type ?? '');
      const val       = Number(art?.effect_value ?? 0);
      const name      = String(art?.name ?? 'Артефакт');
      const haId      = String(a.id);
      const charges   = Number(a.charges_remaining ?? 0);
      const maxCh     = Number(art?.max_charges ?? 0);

      const dmgClass = classifyDmgArtifact(eff, val);

      // ── Full Shield (damage_shield with value >= 100) ──
      if (dmgClass === 'full_shield' && !shield) {
        shield = { heroArtifactId: haId, name, chargesLeft: charges };
        continue;
      }

      // ── Passive damage reduction ──
      if (dmgClass === 'passive_reduce') {
        passiveDmgReduce += val;
        passiveDmgArts.push({ heroArtifactId: haId, name, value: val, chargesLeft: charges, maxCharges: maxCh });
      }

      // XP boost
      if (eff.includes('xp_boost') || effType.includes('xp_boost') || effType.includes('passive_xp')) {
        xpBoost += val;
        xpArtifacts.push(`${name} (+${val}%)`);
        if (maxCh > 0) xpChargeArts.push({ heroArtifactId: haId, chargesLeft: charges });
      }
      // Boss damage multiplier
      if (eff.includes('boss_dmg') || effType.includes('boss_dmg')) {
        bossDmgBoost += val; bossArtifacts.push(`${name} (+${val}%)`);
      }
      // Gold multiplier
      if (eff.includes('gold_multiplier') || eff.includes('gold_boost') || eff.includes('extra_gold') ||
          effType.includes('gold_multiplier') || effType.includes('gold_boost')) {
        goldBoost += val;
        goldArtifacts.push(`${name} (+${val}%)`);
        if (maxCh > 0) goldChargeArts.push({ heroArtifactId: haId, chargesLeft: charges });
      }

      // Protective Mechanics (undo_crit, death_save, auto_resurrect)
      if (eff.includes('undo_crit') || effType.includes('undo_crit') || eff.includes('death_save') || eff.includes('auto_resurrect') || effType.includes('death_save') || effType.includes('auto_resurrect')) {
        protectiveArts.push({ heroArtifactId: haId, name, effect: eff || effType, value: val, chargesLeft: charges, maxCharges: maxCh });
      }
    }
  }

  // ─── Incorporate Class Auras ───
  const auras = await getClassAuras(heroId);
  xpBoost += auras.xpBoost;
  bossDmgBoost += auras.bossDmgBoost;
  goldBoost += auras.goldBoost;
  xpArtifacts.push(...auras.applied.filter(a => a.includes('XP')));
  bossArtifacts.push(...auras.applied.filter(a => a.includes('Урон Боссу')));
  goldArtifacts.push(...auras.applied.filter(a => a.includes('Золото')));

  return {
    xpBoost:          Math.min(xpBoost, 200),
    passiveDmgReduce: Math.min(passiveDmgReduce, 90),
    passiveDmgArts,
    bossDmgBoost:     Math.min(bossDmgBoost, 100),
    goldBoost:        Math.min(goldBoost, 100),
    xpArtifacts,
    xpChargeArts,
    bossArtifacts,
    goldArtifacts,
    goldChargeArts,
    shield,
    protectiveArts,
  };
}

/**
 * Simplified modifier loader for game/action route (damage/xp/gold single actions).
 * Filters by action type to avoid loading unnecessary modifiers.
 */
export async function getArtifactModifiers(heroId: string, actionType: 'damage' | 'grant_xp' | 'grant_gold') {
  const { data: artifacts } = await admin
    .from('hero_artifacts')
    .select('id, artifact_id, charges_remaining, expires_at, artifacts(effect, effect_type, effect_value, name, max_charges)')
    .eq('hero_id', heroId)
    .eq('is_equipped', true);

  let passive_dmg_reduction = 0;
  let xp_boost = 0;
  let gold_boost = 0;
  let boss_dmg_boost = 0;
  const applied: string[] = [];
  const toDecrement: string[] = [];
  const passiveDmgArts: PassiveDmgArt[] = [];
  let shield: ShieldInfo | null = null;

  if (artifacts) {
    const now = new Date();

    for (const a of artifacts) {
      const rec = a as Record<string, unknown>;
      const artData = rec.artifacts as Record<string, unknown> | Record<string, unknown>[] | null;
      const art = Array.isArray(artData) ? artData[0] : artData;
      if (!art) continue;
      const effect = String(art.effect || '');
      const effType = String(art.effect_type || '');
      if (!effect && !effType) continue;
      const effectValue = Number(art.effect_value) || 0;
      const maxCharges = Number(art.max_charges) || 0;
      const chargesLeft = Number(rec.charges_remaining) ?? 0;
      const expiresAt = rec.expires_at ? new Date(String(rec.expires_at)) : null;

      if (expiresAt && expiresAt < now) continue;
      if (maxCharges > 0 && chargesLeft <= 0) continue;

      const effects = effect.split(',').map(e => e.trim());
      let contributed = false;

      const dmgClass = classifyDmgArtifact(effect, effectValue);

      // ── Full Shield ──
      if (actionType === 'damage' && dmgClass === 'full_shield' && !shield) {
        shield = { heroArtifactId: String(rec.id), name: String(art.name), chargesLeft };
        contributed = true;
      }

      // ── Passive dmg reduction ──
      if (actionType === 'damage' && dmgClass === 'passive_reduce') {
        passive_dmg_reduction += effectValue;
        passiveDmgArts.push({ heroArtifactId: String(rec.id), name: String(art.name), value: effectValue, chargesLeft, maxCharges });
        contributed = true;
      }

      // XP/gold/boss effects
      for (const eff of effects) {
        if (actionType === 'grant_xp' && eff.includes('xp_boost')) {
          xp_boost += effectValue;
          contributed = true;
        }
        if (actionType === 'grant_gold' && (eff.includes('gold_boost') || eff.includes('extra_gold') || eff.includes('gold_bonus') || eff.includes('gold_multiplier'))) {
          gold_boost += effectValue;
          contributed = true;
        }
        if (eff.includes('boss_dmg')) {
          boss_dmg_boost += effectValue;
          contributed = true;
        }
      }

      if (contributed && shield?.heroArtifactId !== String(rec.id)) {
        applied.push(`${String(art.name)} (${effectValue > 0 ? (actionType === 'damage' ? '-' : '+') + effectValue + '%' : ''})`);
        if (maxCharges > 0 && actionType !== 'damage') {
          toDecrement.push(String(rec.id));
        }
      }
    }
  }

  // ─── Incorporate Class Auras ───
  const auras = await getClassAuras(heroId);
  if (actionType === 'grant_xp') {
    xp_boost += auras.xpBoost;
    applied.push(...auras.applied.filter(a => a.includes('XP')));
  }
  if (actionType === 'grant_gold') {
    gold_boost += auras.goldBoost;
    applied.push(...auras.applied.filter(a => a.includes('Золото')));
  }
  if (actionType === 'damage') { // Wait, Damage means boss damage? No, 'damage' action is hero taking damage! Boss damage is dealt via complete-quest which uses getHeroMods! Action route doesn't deal boss damage using getArtifactModifiers. So boss damage aura here is ignored.
    boss_dmg_boost += auras.bossDmgBoost;
    applied.push(...auras.applied.filter(a => a.includes('Урон Боссу')));
  }

  // Decrement charges for non-damage artifacts
  for (const haId of toDecrement) {
    const { data: ha } = await admin.from('hero_artifacts').select('charges_remaining').eq('id', haId).single();
    if (ha) {
      await decrementCharge(haId, ha.charges_remaining as number);
    }
  }

  return {
    passive_dmg_reduction: Math.min(passive_dmg_reduction, 90),
    passiveDmgArts,
    xp_boost,
    gold_boost,
    boss_dmg_boost: Math.min(boss_dmg_boost, 100),
    applied,
    shield,
  };
}
