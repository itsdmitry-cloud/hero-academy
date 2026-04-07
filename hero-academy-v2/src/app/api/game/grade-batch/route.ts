import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rollArtifactDrop, DIFFICULTY_MAP, getEconomyConfig, ACTIVITY_ACTIONS, applyXpGain, distributeBossKillRewards } from '@/lib/game/constants';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface GradeEntry {
  heroId: string;
  score: number;   // 1–5
  xp: number;     // already score-adjusted
  gold: number;
  hpDamage: number;
}

interface BatchBody {
  questId: string;
  classId: string;
  subject: string;
  teacherId: string;
  difficulty: string;   // 'easy' | 'medium' | 'hard'
  questType: string;    // 'quest' | 'dungeon' | 'boss'
  grades: GradeEntry[];
}

/* Economy config is now imported from @/lib/game/constants (getEconomyConfig) */

/* Level-up helper — now imported from constants as applyXpGain */

/* ── CLASSIFICATION BY `effect` FIELD (NOT effect_type! DB maps all shields to 'damage_reduce') ──
 *
 * FULL SHIELD (100% block + consume 1 charge):
 *   effect = 'damage_shield' AND effect_value >= 100
 *   Examples: Мифриловый Щит, Непробиваемая Эгида, Плащ Ветра, Свиток Выходного Дня, Щит Стражи
 *
 * PASSIVE REDUCTION (% reduction + consume 1 charge when damage > 0):
 *   effect = 'dmg_reduce' OR 'passive_damage_reduction'
 *   OR effect = 'damage_shield' AND effect_value < 100 (e.g. Щит Стражника val=50)
 *   Examples: Деревянный Щит(-10%), Броня Усидчивости(-30%), Щит Стражника(-50%), Лавовый Амулет
 *
 * NOT IN DAMAGE PIPELINE (handled elsewhere):
 *   death_save, undo_crit, hp_restore, streak_protect, shield_auto_resurrect, cosmetic, etc.
 */

function classifyDmgArtifact(eff: string, val: number): 'full_shield' | 'passive_reduce' | 'none' {
  // Full shield: damage_shield with 100% block
  if (eff.includes('damage_shield') && val >= 100) return 'full_shield';
  // Passive reduction: dmg_reduce, passive_damage_reduction, or damage_shield with val < 100 (Щит Стражника)
  if (eff.includes('dmg_reduce') || eff.includes('passive_damage_reduction')) return 'passive_reduce';
  if (eff.includes('damage_shield') && val < 100 && val > 0) return 'passive_reduce';
  return 'none';
}

interface PassiveDmgArt {
  heroArtifactId: string;
  name: string;
  value: number;
  chargesLeft: number;   // 0 = duration-based (no charge decrement)
  maxCharges: number;
}

interface HeroMods {
  xpBoost: number;
  passiveDmgReduce: number;         // total percentage from passive artifacts
  passiveDmgArts: PassiveDmgArt[];  // individual passive dmg artifacts (for charge tracking)
  bossDmgBoost: number;
  goldBoost: number;
  xpArtifacts: string[];
  xpChargeArts: { heroArtifactId: string; chargesLeft: number }[];  // xp boost arts to decrement
  bossArtifacts: string[];
  goldArtifacts: string[];
  goldChargeArts: { heroArtifactId: string; chargesLeft: number }[]; // gold boost arts to decrement
  // Shield info: the FIRST full-shield artifact found (to consume charge)
  shield: { heroArtifactId: string; name: string; chargesLeft: number } | null;
  // Protective mechanics (undo_crit, death_save) to handle fatal blows
  protectiveArts: { heroArtifactId: string; name: string; effect: string; value: number; maxCharges: number; chargesLeft: number }[];
}

/* ── Artifact modifiers for one hero ── */
async function getHeroMods(heroId: string): Promise<HeroMods> {
  const { data } = await admin
    .from('hero_artifacts')
    .select('id, charges_remaining, artifacts!inner(effect, effect_type, effect_value, name, max_charges)')
    .eq('hero_id', heroId)
    .eq('is_equipped', true)
    .gt('charges_remaining', 0);

  let xpBoost = 0, passiveDmgReduce = 0, bossDmgBoost = 0, goldBoost = 0;
  const xpArtifacts: string[] = [];
  const xpChargeArts: HeroMods['xpChargeArts'] = [];
  const passiveDmgArts: PassiveDmgArt[] = [];
  const bossArtifacts: string[] = [];
  const goldArtifacts: string[] = [];
  const goldChargeArts: HeroMods['goldChargeArts'] = [];
  let shield: HeroMods['shield'] = null;
  const protectiveArts: HeroMods['protectiveArts'] = [];

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

      // ── Passive damage reduction (dmg_reduce, passive_damage_reduction, damage_shield val<100) ──
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

/* ── Decrement 1 charge from a hero_artifact, delete if exhausted ── */
async function decrementCharge(heroArtifactId: string, currentCharges: number) {
  const newCharges = currentCharges - 1;
  if (newCharges <= 0) {
    await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);
  } else {
    await admin.from('hero_artifacts').update({ charges_remaining: newCharges }).eq('id', heroArtifactId);
  }
}

/* ── Process one hero ── */
async function processHero(
  g: GradeEntry,
  eco: { xp_multiplier: number; gold_multiplier: number; dmg_multiplier: number; drop_rate_multiplier: number },
  questId: string,
  subject: string,
  teacherId: string,
  numDifficulty: number,
  questType: string,
) {
  const { heroId, score, xp: baseXp, gold: baseGold, hpDamage: baseHp } = g;
  if (!heroId) return { heroId: '', bossDamage: 0 };

  // Load hero + artifact mods in parallel
  const [heroRow, mods] = await Promise.all([
    admin.from('heroes').select('xp, level, xp_to_next, hp, hp_max, gold, status, season_xp').eq('id', heroId).single(),
    getHeroMods(heroId),
  ]);

  const hero = heroRow.data;
  if (!hero) return { heroId: '', bossDamage: 0 };

  // Apply economy multipliers + artifact boost + random ±10%
  const randomFactor = 0.9 + Math.random() * 0.2; // 0.90–1.10
  const randomPct    = Math.round((randomFactor - 1) * 100);

  const afterBalanceXp   = Math.round(baseXp   * (eco.xp_multiplier  / 100));
  const afterBalanceGold = Math.round(baseGold * (eco.gold_multiplier / 100));
  const afterBalanceHp   = Math.round(baseHp   * (eco.dmg_multiplier  / 100));
  const afterArtXp       = Math.round(afterBalanceXp * (1 + mods.xpBoost  / 100));
  const finalXp   = Math.max(0, Math.round(afterArtXp * randomFactor));
  const afterArtGold     = Math.round(afterBalanceGold * (1 + mods.goldBoost / 100));
  const finalGold  = afterArtGold;

  // ── HP damage: shield-first, then passive reduction ──
  let finalHp = 0;
  let shieldUsed = false;
  let shieldName = '';

  if (baseHp > 0 && afterBalanceHp > 0) {
    if (mods.shield) {
      // FULL SHIELD: fully blocks damage, consume 1 charge
      finalHp = 0;
      shieldUsed = true;
      shieldName = mods.shield.name;
      await decrementCharge(mods.shield.heroArtifactId, mods.shield.chargesLeft);
    } else if (mods.passiveDmgReduce > 0) {
      // PASSIVE: % reduction, consume 1 charge from each charge-based passive art
      const afterPassive = Math.round(afterBalanceHp * (1 - mods.passiveDmgReduce / 100));
      finalHp = afterPassive > 0 ? Math.round(afterPassive * randomFactor) : 0;
      // Decrement charges on passive dmg artifacts (only charge-based ones, only when damage existed)
      for (const art of mods.passiveDmgArts) {
        if (art.maxCharges > 0) {
          await decrementCharge(art.heroArtifactId, art.chargesLeft);
        }
      }
    } else {
      // No protection at all
      finalHp = Math.round(afterBalanceHp * randomFactor);
    }
  }

  // ── Decrement charges for XP boost artifacts (charge-based only) ──
  if (finalXp > 0) {
    for (const art of mods.xpChargeArts) {
      await decrementCharge(art.heroArtifactId, art.chargesLeft);
    }
  }
  // ── Decrement charges for Gold boost artifacts (charge-based only) ──
  if (finalGold > 0) {
    for (const art of mods.goldChargeArts) {
      await decrementCharge(art.heroArtifactId, art.chargesLeft);
    }
  }

  // Build XP pipeline (same format as teacher_xp_grant in game/action/route.ts)
  const xpPipeline: string[] = [`Базовое: ${baseXp}`];
  if (eco.xp_multiplier !== 100) xpPipeline.push(`Баланс (${eco.xp_multiplier}%): ${afterBalanceXp}`);
  if (mods.xpBoost > 0) xpPipeline.push(`Артефакты (+${mods.xpBoost}%): ${afterArtXp} [${mods.xpArtifacts.join(', ')}]`);
  xpPipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalXp}`);

  // Build HP pipeline
  const passiveDmgLabels = mods.passiveDmgArts.map(a => `${a.name} (-${a.value}%)`);
  const hpPipeline: string[] = [`Базовый урон: ${baseHp}`];
  if (eco.dmg_multiplier !== 100) hpPipeline.push(`Баланс (${eco.dmg_multiplier}%): ${afterBalanceHp}`);
  if (shieldUsed) {
    hpPipeline.push(`🛡️ ${shieldName}: Урон полностью поглощён! (заряд -1)`);
    hpPipeline.push(`Отнято HP: 0`);
  } else if (mods.passiveDmgReduce > 0) {
    const afterPassive = Math.round(afterBalanceHp * (1 - mods.passiveDmgReduce / 100));
    hpPipeline.push(`Пассивная защита (-${mods.passiveDmgReduce}%): ${afterPassive} [${passiveDmgLabels.join(', ')}]`);
    if (afterPassive > 0) hpPipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalHp}`);
    if (finalHp > 0) hpPipeline.push(`Отнято HP: -${finalHp}`);
  } else if (finalHp > 0) {
    hpPipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalHp}`);
    hpPipeline.push(`Отнято HP: -${finalHp}`);
  }

  // Build gold pipeline
  const goldPipeline: string[] = [];
  if (eco.gold_multiplier !== 100) goldPipeline.push(`Баланс (${eco.gold_multiplier}%): ${afterBalanceGold}`);
  if (mods.goldBoost > 0) goldPipeline.push(`Артефакты (+${mods.goldBoost}%): ${afterArtGold} [${mods.goldArtifacts.join(', ')}]`);

  // Compute new values
  const { xp: newXp, level: newLevel, xpNext: newXpNext } = applyXpGain(hero.xp, hero.level, hero.xp_to_next, finalXp);
  const newGold = hero.gold + finalGold;

  let newHp   = Math.max(0, hero.hp - finalHp);
  let deathSaved = false;
  let undoCrit = false;
  let saveArtName = '';

  if (newHp === 0 && hero.hp > 0 && finalHp > 0) {
    // Priority 1: undo_crit
    for (const art of mods.protectiveArts) {
      if (art.effect.includes('undo_crit')) {
        newHp = hero.hp;
        finalHp = 0; // Negated completely
        undoCrit = true;
        saveArtName = art.name;
        if (art.maxCharges > 0) await decrementCharge(art.heroArtifactId, art.chargesLeft);
        break;
      }
    }
    // Priority 2: death_save / auto_resurrect (only if didn't undo)
    if (!undoCrit) {
      for (const art of mods.protectiveArts) {
        if (art.effect.includes('death_save') || art.effect.includes('auto_resurrect')) {
          const saveHp = Number(art.value) || 30; // 30 is fallback
          newHp = saveHp;
          deathSaved = true;
          saveArtName = art.name;
          if (art.maxCharges > 0) await decrementCharge(art.heroArtifactId, art.chargesLeft);
          break;
        }
      }
    }
  }

  // Structured breakdown for rich two-column UI rendering
  const breakdown = {
    xp: {
      base:        baseXp,
      scorePct:    Math.round(g.score > 0 ? (afterBalanceXp / (baseXp || 1)) * 100 : 0),
      balancePct:  eco.xp_multiplier,
      afterBalance: afterBalanceXp,
      artBoost:    mods.xpBoost > 0 ? mods.xpBoost : null,
      artNames:    mods.xpBoost > 0 ? mods.xpArtifacts : [],
      afterArt:    afterArtXp,
      randomPct,
      final:       finalXp,
    },
    gold: finalGold > 0 ? {
      base:        Math.round(g.gold),
      balancePct:  eco.gold_multiplier,
      afterBalance: afterBalanceGold,
      artBoost:    mods.goldBoost > 0 ? mods.goldBoost : null,
      artNames:    mods.goldBoost > 0 ? mods.goldArtifacts : [],
      final:       finalGold,
    } : null,
    hp: (baseHp > 0) ? {
      base:        baseHp,
      balancePct:  eco.dmg_multiplier,
      afterBalance: afterBalanceHp,
      shield:      shieldUsed ? shieldName : null,
      passivePct:  mods.passiveDmgReduce > 0 ? mods.passiveDmgReduce : null,
      passiveNames: mods.passiveDmgArts.map(a => `${a.name} (-${a.value}%)`),
      randomPct:   shieldUsed ? 0 : randomPct,
      undoCrit:    undoCrit ? saveArtName : null,
      deathSaved:  deathSaved ? saveArtName : null,
      final:       finalHp,
    } : null,
  };

  // Build hero update (includes season_xp for Battle Pass)
  const heroUpdate: Record<string, unknown> = {
    xp: newXp, gold: newGold, hp: newHp,
    status: newHp === 0 ? 'inactive' : 'active',
    season_xp: ((hero as any).season_xp ?? 0) + finalXp,
  };
  if (newLevel > hero.level) { heroUpdate.level = newLevel; heroUpdate.xp_to_next = newXpNext; }

  // Fire streak + hero update + activity_log + quest_attempts in parallel
  await Promise.all([
    admin.from('heroes').update(heroUpdate).eq('id', heroId),
    finalXp > 0
      ? Promise.resolve(admin.rpc('update_hero_streak', { p_hero_id: heroId })).catch(() => {})
      : Promise.resolve(),
    score > 0
      ? Promise.resolve(
          admin.from('activity_log').insert({
            hero_id: heroId, user_id: teacherId, action: ACTIVITY_ACTIONS.QUEST_GRADED,
            xp_change: finalXp, gold_change: finalGold, hp_change: -finalHp,
            metadata: { quest_id: questId, score, subject, breakdown },
          })
        ).catch(() => {})
      : Promise.resolve(),
    // Fix #4: Write grade into quest_attempts for per-student history
    Promise.resolve(
      admin.from('quest_attempts').insert({
        quest_id: questId,
        hero_id: heroId,
        status: 'graded',
        grade: score,
        xp_earned: finalXp,
        gold_earned: finalGold,
        hp_lost: finalHp,
        correct_count: score >= 4 ? 1 : 0,
        mistake_count: score <= 2 ? 1 : 0,
        graded_at: new Date().toISOString(),
      })
    ).catch(() => {}),
  ]);

  // boss damage = XP earned, boosted by boss damage artifacts (e.g. Коготь Дракона +20%)
  let bossDamage = finalXp;
  if (mods.bossDmgBoost > 0) {
    // boss damage boost — noted separately, not in breakdown
    bossDamage = Math.round(finalXp * (1 + mods.bossDmgBoost / 100));
  }

  // Roll for artifact drop (only on positive scores 4-5, i.e. score >= 4)
  let droppedArtifact: { id: string; name: string; icon: string; rarity: string } | null = null;
  if (score >= 4) {
    const heroLevel = hero.level ?? 1;
    droppedArtifact = await rollArtifactDrop(heroId, heroLevel, questType, numDifficulty, eco.drop_rate_multiplier);
    if (droppedArtifact) {
      await admin.from('activity_log').insert({
        hero_id: heroId, user_id: teacherId, action: 'artifact_drop',
        metadata: { artifact: droppedArtifact.name, rarity: droppedArtifact.rarity, source: 'quest_grade', quest_id: questId },
      }).then(() => {});
    }
  }

  return { heroId, bossDamage, xpPipeline, droppedArtifact };
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as BatchBody;
    const { questId, classId, subject, teacherId, difficulty: rawDiff, questType: rawType, grades } = body;

    if (!questId || !classId || !grades?.length) {
      return NextResponse.json({ error: 'questId, classId, grades required' }, { status: 400 });
    }

    // ── Load shared data ONCE ──
    const [eco, seasonRow] = await Promise.all([
      getEconomyConfig({ classId }),
      admin.from('seasons').select('id')
        .eq('school_id',
          (await admin.from('classes').select('school_id').eq('id', classId).single()).data?.school_id ?? ''
        ).eq('status', 'active').limit(1).maybeSingle(),
    ]);

    const seasonId = seasonRow.data?.id ?? null;

    // Load boss ONCE
    let bossId: string | null = null;
    let bossCurrentHp = 0;
    let bossName = subject ?? 'Босс';
    if (seasonId && subject) {
      const { data: boss } = await admin.from('subject_bosses')
        .select('id, current_hp, name')
        .eq('season_id', seasonId)
        .eq('class_id', classId)
        .ilike('subject_id', subject)
        .maybeSingle();
      if (boss && boss.current_hp > 0) {
        bossId = boss.id;
        bossCurrentHp = boss.current_hp;
        bossName = (boss as Record<string, unknown>).name as string ?? bossName;
      }
    }

    // Resolve numeric difficulty from text
    const numDifficulty = DIFFICULTY_MAP[rawDiff ?? 'easy'] ?? 1;
    const questType = rawType ?? 'quest';

    // ── Process ALL heroes in PARALLEL ──
    const results = await Promise.all(
      grades.map(g => processHero(g, eco, questId, subject, teacherId, numDifficulty, questType))
    );

    const totalBossDamage = results.reduce((s, r) => s + r.bossDamage, 0);

    // ── Apply boss damage ONCE ──
    if (bossId && totalBossDamage > 0) {
      const newBossHp = Math.max(0, bossCurrentHp - totalBossDamage);
      await admin.from('subject_bosses').update({
        current_hp: newBossHp,
        is_defeated: newBossHp === 0,
      }).eq('id', bossId);

      // Log individual boss damage per hero (parallel: boss_damage_logs + activity_log)
      const heroHits = results.filter(r => r.bossDamage > 0 && r.heroId);
      await Promise.all(
        heroHits.flatMap(r => [
          Promise.resolve(
            admin.from('boss_damage_logs').insert({
              boss_id: bossId,
              hero_id: r.heroId,
              damage_dealt: r.bossDamage,
              action_type: 'quest_grade_batch',
            })
          ).catch(() => {}),
          Promise.resolve(
            admin.from('activity_log').insert({
              hero_id: r.heroId,
              user_id: teacherId,
              action: ACTIVITY_ACTIONS.BOSS_DAMAGE,
              xp_change: 0,
              gold_change: 0,
              hp_change: 0,
              metadata: {
                boss_id: bossId,
                boss_name: bossName,
                damage_dealt: r.bossDamage,
                subject,
                quest_id: questId,
              },
            })
          ).catch(() => {}),
        ])
      );

      // ── BOSS DEFEATED: distribute rewards to all class heroes ──
      if (newBossHp === 0) {
        // Determine which hero dealt the most damage in this batch (last hit)
        const topHitter = heroHits.reduce((best, r) => r.bossDamage > best.bossDamage ? r : best, heroHits[0]);
        await distributeBossKillRewards({
          bossId,
          classId,
          subject: subject ?? 'Предмет',
          lastHitHeroId: topHitter?.heroId ?? '',
          teacherId: teacherId ?? '',
        });
      }
    }

    // ── Archive quest ──
    await admin.from('quests').update({ status: 'archived' }).eq('id', questId);

    return NextResponse.json({ success: true, students_processed: grades.length, total_boss_damage: totalBossDamage });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
