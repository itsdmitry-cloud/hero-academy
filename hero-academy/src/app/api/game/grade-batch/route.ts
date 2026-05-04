import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rollArtifactDrop, DIFFICULTY_MAP, getEconomyConfig, ACTIVITY_ACTIONS, applyXpGain, distributeBossKillRewards } from '@/lib/game/constants';
import { getHeroMods, decrementCharge } from '@/lib/game/artifact-engine';
import { getMoscowDate, planStreakUpdate } from '@/lib/game/streak-calendar';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface GradeEntry {
  heroId: string;
  score: number;   // 1–5
  notSubmitted?: boolean; // true = «Не сдал» (score=1 + метка для метаданных)
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

// classifyDmgArtifact, getHeroMods, decrementCharge → imported from artifact-engine

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
  const { heroId, score, notSubmitted, xp: baseXp, gold: baseGold, hpDamage: baseHp } = g;
  if (!heroId) return { heroId: '', bossDamage: 0 };

  // Load hero + artifact mods in parallel
  const [heroRow, mods] = await Promise.all([
    admin.from('heroes').select('xp, level, xp_to_next, hp, hp_max, gold, status, season_xp, streak_last_date').eq('id', heroId).single(),
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
  let activeReduction = 0;
  const activePassiveLabels: string[] = [];

  if (baseHp > 0 && afterBalanceHp > 0) {
    if (mods.shield) {
      // FULL SHIELD: fully blocks damage, consume 1 charge
      finalHp = 0;
      shieldUsed = true;
      shieldName = mods.shield.name;
      await decrementCharge(mods.shield.heroArtifactId, mods.shield.chargesLeft);
    } else if (mods.passiveDmgReduce > 0) {
      // Duration-based (no charges): all stack. Charge-based: only ONE per hit, in order.
      for (const art of mods.passiveDmgArts) {
        if (art.maxCharges === 0) {
          activeReduction += art.value;
          activePassiveLabels.push(`${art.name} (-${art.value}%)`);
        }
      }
      const activeChargeArt = mods.passiveDmgArts.find(a => a.maxCharges > 0);
      if (activeChargeArt) {
        activeReduction += activeChargeArt.value;
        activePassiveLabels.push(`${activeChargeArt.name} (-${activeChargeArt.value}%, заряд -1)`);
        await decrementCharge(activeChargeArt.heroArtifactId, activeChargeArt.chargesLeft);
      }

      activeReduction = Math.min(activeReduction, 90);
      const afterPassive = Math.round(afterBalanceHp * (1 - activeReduction / 100));
      finalHp = afterPassive > 0 ? Math.round(afterPassive * randomFactor) : 0;
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
  const hpPipeline: string[] = [`Базовый урон: ${baseHp}`];
  if (eco.dmg_multiplier !== 100) hpPipeline.push(`Баланс (${eco.dmg_multiplier}%): ${afterBalanceHp}`);
  if (shieldUsed) {
    hpPipeline.push(`🛡️ ${shieldName}: Урон полностью поглощён! (заряд -1)`);
    hpPipeline.push(`Отнято HP: 0`);
  } else if (activeReduction > 0) {
    const afterPassive = Math.round(afterBalanceHp * (1 - activeReduction / 100));
    hpPipeline.push(`Пассивная защита (-${activeReduction}%): ${afterPassive} [${activePassiveLabels.join(', ')}]`);
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

  // Boss damage = final XP (после всего пайплайна: баланс, артефакты, рандом)
  const bossDamage = finalXp;

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
    hp: {
      base:        baseHp,
      balancePct:  eco.dmg_multiplier,
      afterBalance: baseHp > 0 ? afterBalanceHp : 0,
      shield:      shieldUsed ? shieldName : null,
      passivePct:  activeReduction > 0 ? activeReduction : null,
      passiveNames: baseHp > 0 ? activePassiveLabels : [],
      randomPct:   baseHp > 0 ? (shieldUsed ? 0 : randomPct) : 0,
      undoCrit:    undoCrit ? saveArtName : null,
      deathSaved:  deathSaved ? saveArtName : null,
      final:       finalHp,
    },
    bossDmg: null,
  };

  // Build hero update (includes season_xp for Battle Pass)
  const heroWithSeason = hero as typeof hero & { season_xp?: number | null };
  const heroUpdate: Record<string, unknown> = {
    xp: newXp, level: newLevel, xp_to_next: newXpNext,
    gold: newGold, hp: newHp,
    status: newHp === 0 ? 'inactive' : 'active',
    season_xp: (heroWithSeason.season_xp ?? 0) + finalXp,
  };

  // ── STREAK plan (Alpha math calendar): skip / bridge / normal ──────────
  // Стрик считается только в школьные дни (Пн/Ср/Чт/Пт), праздники не сбрасывают.
  const streakLastDate = (hero as typeof hero & { streak_last_date?: string | null }).streak_last_date ?? null;
  const streakPlan = planStreakUpdate(getMoscowDate(), streakLastDate);
  const fireStreakRpc = finalXp > 0 && streakPlan.kind !== 'skip';

  // 1. heroUpdate (xp/gold/hp/...) обязательно ДО RPC, иначе milestone-бонус
  // от update_hero_streak может быть затёрт устаревшим snapshot'ом xp/gold.
  // 2. Activity_log и quest_attempts пишутся параллельно с heroUpdate (разные таблицы).
  await Promise.all([
    admin.from('heroes').update(heroUpdate).eq('id', heroId),
    score > 0
      ? Promise.resolve(
          admin.from('activity_log').insert({
            hero_id: heroId, user_id: teacherId, action: ACTIVITY_ACTIONS.QUEST_GRADED,
            xp_change: finalXp, gold_change: finalGold, hp_change: -finalHp,
            metadata: {
              quest_id: questId,
              score,
              subject,
              breakdown,
              ...(notSubmitted ? { submission_status: 'not_submitted' } : {}),
            },
          })
        ).catch(() => {})
      : Promise.resolve(),
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

  // Bridge + RPC последовательно после heroUpdate.
  // CAS на streak_last_date: если параллельный запрос уже обновил дату,
  // мост не выполняется и RPC видит актуальное состояние (избегаем double-count).
  if (fireStreakRpc) {
    if (streakPlan.kind === 'bridge') {
      const cas = streakLastDate === null
        ? admin.from('heroes').update({ streak_last_date: streakPlan.bridgeDate })
            .eq('id', heroId).is('streak_last_date', null).select('id')
        : admin.from('heroes').update({ streak_last_date: streakPlan.bridgeDate })
            .eq('id', heroId).eq('streak_last_date', streakLastDate).select('id');
      try { await cas; } catch { /* ignore CAS write failures */ }
    }
    try { await admin.rpc('update_hero_streak', { p_hero_id: heroId }); } catch { /* non-critical */ }
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

    // Load boss ONCE from subject_bosses
    let bossId: string | null = null;
    let bossCurrentHp = 0;

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
      const bossUpdate: Record<string, unknown> = {
        current_hp: newBossHp,
        is_defeated: newBossHp === 0,
      };
      await admin.from('subject_bosses').update(bossUpdate).eq('id', bossId);

      // Log individual boss damage per hero (boss_damage_logs only, no separate activity_log entry)
      const heroHits = results.filter(r => r.bossDamage > 0 && r.heroId);
      await Promise.all(
        heroHits.map(r =>
          Promise.resolve(
            admin.from('boss_damage_logs').insert({
              boss_id: bossId,
              hero_id: r.heroId,
              damage_dealt: r.bossDamage,
              action_type: 'quest_grade_batch',
            })
          ).catch(() => {})
        )
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
