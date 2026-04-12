import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rollArtifactDrop, DIFFICULTY_MAP, applyXpGain, getEconomyConfig, distributeBossKillRewards } from '@/lib/game/constants';
import { decrementCharge, getArtifactModifiers } from '@/lib/game/artifact-engine';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Game Action Pipeline:
 * 1. Teacher sends base action (damage, xp, gold)
 * 2. Load economy_config for class → school → global (cascade)
 * 3. Apply balance multipliers
 * 4. Load student artifacts
 * 5. Apply artifact effects
 * 6. Execute final values on hero
 */

interface GameAction {
  hero_id: string;
  action: 'damage' | 'grant_xp' | 'grant_gold';
  base_amount: number;
  reason?: string;
  subject?: string;
  teacher_id?: string;
  difficulty?: number | string; // 1-5 or 'easy'/'medium'/'hard'
  quest_type?: string;          // 'quest' | 'dungeon' | 'boss'
}

// classifyDmgArtifact, decrementCharge, getArtifactModifiers → imported from artifact-engine

export async function POST(req: Request) {
  const body = await req.json() as GameAction;
  const { hero_id, action, base_amount, reason, subject, teacher_id, difficulty: rawDiff, quest_type: rawQuestType } = body;

  // Derive difficulty: explicit value → DIFFICULTY_MAP text → infer from base_amount (fallback)
  const difficulty = rawDiff
    ? (typeof rawDiff === 'string' ? (DIFFICULTY_MAP[rawDiff] ?? 1) : Math.min(5, Math.max(1, rawDiff)))
    : base_amount >= 120 ? 5
    : base_amount >= 80 ? 4
    : base_amount >= 50 ? 3
    : base_amount >= 30 ? 2
    : 1;

  if (!hero_id || !action || base_amount === undefined) {
    return NextResponse.json({ error: 'hero_id, action, base_amount required' }, { status: 400 });
  }

  try {
    // Step 1: Get economy config (class → school → global cascade)
    const eco = await getEconomyConfig({ heroId: hero_id });

    // Step 2: Get artifact modifiers
    const arts = await getArtifactModifiers(hero_id, action);

    // Randomness: ±10% variation
    const randomFactor = 0.9 + Math.random() * 0.2; // 0.90 – 1.10
    const randomPct = Math.round((randomFactor - 1) * 100);

    // Step 3: Calculate final amount
    let finalAmount = base_amount;
    const pipeline: string[] = [`Базовое: ${base_amount}`];

    if (action === 'damage') {
      // Apply balance dmg_multiplier
      const afterBalance = Math.round(base_amount * (eco.dmg_multiplier / 100));
      pipeline.push(`Баланс (${eco.dmg_multiplier}%): ${afterBalance}`);

      if (arts.shield) {
        // ── FULL SHIELD: completely block damage, consume 1 charge ──
        finalAmount = 0;
        pipeline.push(`🛡️ ${arts.shield.name}: Урон полностью поглощён! (заряд -1)`);
        await decrementCharge(arts.shield.heroArtifactId, arts.shield.chargesLeft);
      } else if (arts.passive_dmg_reduction > 0) {
        // ── PASSIVE %: reduce damage, consume charges on charge-based passive arts ──
        finalAmount = Math.round(afterBalance * (1 - arts.passive_dmg_reduction / 100));
        const passiveLabels = arts.passiveDmgArts.map(a => `${a.name} (-${a.value}%)`);
        pipeline.push(`Пассивная защита (-${arts.passive_dmg_reduction}%): ${finalAmount} [${passiveLabels.join(', ')}]`);
        // Apply randomness
        finalAmount = finalAmount > 0 ? Math.round(finalAmount * randomFactor) : 0;
        if (finalAmount > 0) pipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalAmount}`);
        // Decrement charges on passive dmg artifacts
        for (const art of arts.passiveDmgArts) {
          if (art.maxCharges > 0) {
            await decrementCharge(art.heroArtifactId, art.chargesLeft);
          }
        }
      } else {
        // ── No protection ──
        finalAmount = afterBalance;
        finalAmount = Math.round(finalAmount * randomFactor);
        pipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalAmount}`);
      }

      // Apply damage to hero
      const { data: hero } = await admin.from('heroes').select('hp').eq('id', hero_id).single();
      if (!hero) return NextResponse.json({ error: 'Hero not found' }, { status: 404 });
      
      let newHp = Math.max(0, hero.hp - finalAmount);
      let deathSaved = false;
      let undoCrit = false;

      // Fetch all protective artifacts once (for undo_crit + death_save checks)
      const { data: protectiveArts } = newHp <= 0 ? await admin
        .from('hero_artifacts')
        .select('id, charges_remaining, artifacts(effect, effect_type, effect_value, name)')
        .eq('hero_id', hero_id)
        .eq('is_equipped', true) : { data: null };

      if (newHp <= 0 && protectiveArts) {
        // Priority 1: undo_crit — cancel the killing blow entirely
        for (const ds of protectiveArts) {
          const rec = ds as Record<string, unknown>;
          const artData = rec.artifacts as Record<string, unknown> | Record<string, unknown>[] | null;
          const art = Array.isArray(artData) ? artData[0] : artData;
          if (!art) continue;
          if (!String(art.effect ?? art.effect_type ?? '').includes('undo_crit')) continue;

          // Killing blow cancelled — hero keeps original HP
          newHp = hero.hp;
          finalAmount = 0;
          undoCrit = true;
          pipeline.push(`⏪ ${String(art.name)}: Смертельный удар отменён! HP не изменилось (${hero.hp})`);
          await admin.from('hero_artifacts').delete().eq('id', String(rec.id));
          break;
        }

        // Priority 2: death_save — hero survives with X HP (if undo_crit didn't fire)
        if (!undoCrit) {
          for (const ds of protectiveArts) {
            const rec = ds as Record<string, unknown>;
            const artData = rec.artifacts as Record<string, unknown> | Record<string, unknown>[] | null;
            const art = Array.isArray(artData) ? artData[0] : artData;
            if (!art) continue;
            const effStr = String(art.effect ?? art.effect_type ?? '');
            if (!effStr.includes('death_save') && !effStr.includes('auto_resurrect')) continue;

            const saveHp = Number(art.effect_value) || 30;
            newHp = saveHp;
            deathSaved = true;
            pipeline.push(`🔥 ${String(art.name)}: Смерть отменена! Выживание с ${saveHp} HP`);
            await admin.from('hero_artifacts').delete().eq('id', String(rec.id));
            break;
          }
        }
      }

      await admin.from('heroes').update({
        hp: newHp,
        status: newHp === 0 ? 'inactive' : 'active',
      }).eq('id', hero_id);

      // Log
      await admin.from('activity_log').insert({
        hero_id,
        user_id: teacher_id,
        action: 'teacher_damage',
        hp_change: -finalAmount,
        metadata: { reason, subject, pipeline, base: base_amount, eco_mult: eco.dmg_multiplier, art_reduce: arts.passive_dmg_reduction, shield_used: !!arts.shield },
      }).then(() => {});

      return NextResponse.json({
        success: true,
        action: 'damage',
        base_amount,
        final_amount: finalAmount,
        new_hp: newHp,
        status: newHp === 0 ? 'inactive' : 'active',
        death_saved: deathSaved,
        applied_artifacts: arts.applied,
        pipeline,
      });

    } else if (action === 'grant_xp') {
      // Apply balance xp_multiplier
      finalAmount = Math.round(base_amount * (eco.xp_multiplier / 100));
      pipeline.push(`Баланс (${eco.xp_multiplier}%): ${finalAmount}`);

      // Apply artifact XP boost
      if (arts.xp_boost > 0) {
        finalAmount = Math.round(finalAmount * (1 + arts.xp_boost / 100));
        pipeline.push(`Артефакты (+${arts.xp_boost}%): ${finalAmount} [${arts.applied.join(', ')}]`);
      }

      // Apply ±10% randomness
      finalAmount = Math.max(1, Math.round(finalAmount * randomFactor));
      pipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalAmount}`);

      // Apply XP
      const { data: hero } = await admin.from('heroes').select('xp, level, xp_to_next, season_xp').eq('id', hero_id).single();
      if (!hero) return NextResponse.json({ error: 'Hero not found' }, { status: 404 });

      const { xp: newXp, level: newLevel, xpNext: newXpNext, levelUps } = applyXpGain(hero.xp, hero.level, hero.xp_to_next, finalAmount);

      const heroWithSeason = hero as typeof hero & { season_xp?: number | null };
      const heroUpdate: Record<string, unknown> = {
        xp: newXp, level: newLevel, xp_to_next: newXpNext,
        season_xp: (heroWithSeason.season_xp ?? 0) + finalAmount,
      };
      if (levelUps.length > 0) {
        pipeline.push(`🎉 Уровень ${levelUps.join(' → ')}!`);
      }
      await admin.from('heroes').update(heroUpdate).eq('id', hero_id);


      // DEAL DAMAGE TO SEASON BOSS (new model) or SUBJECT BOSS (legacy)
      if (subject) {
        const { data: userData } = await admin.from('heroes').select('user_id').eq('id', hero_id).single();
        if (userData) {
          const { data: classData } = await admin.from('users').select('class_id, school_id').eq('id', userData.user_id).single();
          if (classData && classData.class_id && classData.school_id) {
            const { data: season } = await admin.from('seasons')
              .select('id')
              .eq('school_id', classData.school_id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();

            if (season) {
               // Try new model first: season_boss → season_boss_class_hp
               let bossRow: { id: string; current_hp: number } | null = null;
               let bossTableName: string = 'season_boss_class_hp';

               const { data: seasonBoss } = await admin.from('season_boss')
                 .select('id').eq('season_id', season.id).maybeSingle();
               if (seasonBoss) {
                 const { data: classHp } = await admin.from('season_boss_class_hp')
                   .select('id, current_hp')
                   .eq('season_boss_id', seasonBoss.id)
                   .eq('class_id', classData.class_id)
                   .maybeSingle();
                 if (classHp && classHp.current_hp > 0) bossRow = classHp;
               }

               // Fallback: legacy subject_bosses
               if (!bossRow) {
                 const { data: legacyBoss } = await admin.from('subject_bosses')
                   .select('id, current_hp')
                   .eq('season_id', season.id)
                   .eq('class_id', classData.class_id)
                   .ilike('subject_id', subject)
                   .maybeSingle();
                 if (legacyBoss && legacyBoss.current_hp > 0) {
                   bossRow = legacyBoss;
                   bossTableName = 'subject_bosses';
                 }
               }

               if (bossRow && bossRow.current_hp > 0) {
                 const bossDamage = finalAmount;
                 pipeline.push(`🐉 Урон боссу = XP: ${bossDamage}`);
                 const newBossHp = Math.max(0, bossRow.current_hp - bossDamage);
                 const bossUpd: Record<string, unknown> = { current_hp: newBossHp, is_defeated: newBossHp === 0 };
                 if (newBossHp === 0 && bossTableName === 'season_boss_class_hp') {
                   bossUpd.defeated_at = new Date().toISOString();
                 }
                 await admin.from(bossTableName).update(bossUpd).eq('id', bossRow.id);

                 await admin.from('boss_damage_logs').insert({
                   boss_id: bossRow.id,
                   hero_id: hero_id,
                   damage_dealt: bossDamage,
                   action_type: 'teacher_reward'
                 }).then(() => {});

                 pipeline.push(`⚔️ Босс получил -${bossDamage} HP`);

                 if (newBossHp === 0 && bossRow.current_hp > 0) {
                   pipeline.push(`🐉 БОСС ПОВЕРЖЕН! Идет подсчет вклада...`);
                   const rewards = await distributeBossKillRewards({
                     bossId: bossRow.id,
                     classId: classData.class_id,
                     subject: subject ?? '',
                     lastHitHeroId: hero_id,
                     teacherId: teacher_id ?? '',
                   });
                   pipeline.push(`🎁 Награды розданы ${rewards.heroesRewarded} героям!`);
                 }
               }
            }
          }
        }
      }

      // Log
      await admin.from('activity_log').insert({
        hero_id,
        user_id: teacher_id,
        action: 'teacher_xp_grant',
        xp_change: finalAmount,
        metadata: { reason, subject, pipeline, base: base_amount, eco_mult: eco.xp_multiplier, art_boost: arts.xp_boost },
      }).then(() => {});

      // ── STREAK UPDATE (Weekend-Aware) ──────────────────────────────────────
      // Streak only advances on weekdays (Mon–Fri). Weekends are skipped.
      // Friday→Monday gap is bridged so weekend doesn't break the streak.
      try {
        const todayDay = new Date().getDay(); // 0=Sun, 6=Sat
        const isWeekend = todayDay === 0 || todayDay === 6;

        if (!isWeekend) {
          // Bridge Friday→Monday gap: make Postgres see it as consecutive
          if (todayDay === 1) { // Monday
            const { data: streakHero } = await admin.from('heroes')
              .select('streak_last_date').eq('id', hero_id).single();
            const lastDate = streakHero?.streak_last_date
              ? new Date(streakHero.streak_last_date as string) : null;
            if (lastDate && lastDate.getDay() === 5) { // last was Friday
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              await admin.from('heroes').update({
                streak_last_date: yesterday.toISOString().split('T')[0],
              }).eq('id', hero_id);
            }
          }

          const { data: streakData } = await admin.rpc('update_hero_streak', { p_hero_id: hero_id });
          const sr = streakData as Record<string, unknown> | null;
          if (sr?.updated) {
            const days = Number(sr.streak_current);
            const label = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
            pipeline.push(`🔥 Стрик: ${days} ${label}`);
            if (sr.is_new_record) pipeline.push(`🏆 Новый рекорд стрика!`);
          }
          if (sr?.bonus) {
            const bonus = sr.bonus as Record<string, unknown>;
            pipeline.push(`🎁 Бонус за ${bonus.milestone} дней стрика: +${bonus.xp} XP, +${bonus.gold} Gold!`);
          }
        }
      } catch { /* streak update is non-critical */ }

      // Roll for artifact drop
      const { data: heroFull } = await admin.from('heroes').select('level').eq('id', hero_id).single();
      // Determine quest type: explicit param → fallback to reason text → default 'quest'
      const questType = rawQuestType
        ?? (reason?.includes('boss') ? 'boss'
          : reason?.includes('dungeon') || reason?.includes('контрольн') || reason?.includes('тест') ? 'dungeon'
          : 'quest');
      const droppedArtifact = await rollArtifactDrop(hero_id, heroFull?.level ?? 1, questType, difficulty, eco.drop_rate_multiplier);

      if (droppedArtifact) {
        pipeline.push(`🎁 Дроп: ${droppedArtifact.icon} ${droppedArtifact.name} (${droppedArtifact.rarity})`);
        // Log drop
        await admin.from('activity_log').insert({
          hero_id, user_id: teacher_id, action: 'artifact_drop',
          metadata: { artifact: droppedArtifact.name, rarity: droppedArtifact.rarity, source: 'quest' },
        }).then(() => {});
      }

      return NextResponse.json({
        success: true,
        action: 'grant_xp',
        base_amount,
        final_amount: finalAmount,
        applied_artifacts: arts.applied,
        dropped_artifact: droppedArtifact,
        pipeline,
      });

    } else if (action === 'grant_gold') {
      // Apply balance gold_multiplier
      finalAmount = Math.round(base_amount * (eco.gold_multiplier / 100));
      pipeline.push(`Баланс (${eco.gold_multiplier}%): ${finalAmount}`);

      // Apply artifact gold boost
      if (arts.gold_boost > 0) {
        finalAmount = Math.round(finalAmount * (1 + arts.gold_boost / 100));
        pipeline.push(`Артефакты (+${arts.gold_boost}%): ${finalAmount} [${arts.applied.join(', ')}]`);
      }

      // Apply ±10% randomness
      finalAmount = Math.max(1, Math.round(finalAmount * randomFactor));
      pipeline.push(`Рандом (${randomPct >= 0 ? '+' : ''}${randomPct}%): ${finalAmount}`);

      // Apply gold
      const { data: hero } = await admin.from('heroes').select('gold').eq('id', hero_id).single();
      if (!hero) return NextResponse.json({ error: 'Hero not found' }, { status: 404 });
      
      await admin.from('heroes').update({ gold: hero.gold + finalAmount }).eq('id', hero_id);

      // Log
      await admin.from('activity_log').insert({
        hero_id,
        user_id: teacher_id,
        action: 'teacher_gold_grant',
        gold_change: finalAmount,
        metadata: { reason, subject, pipeline, base: base_amount, eco_mult: eco.gold_multiplier, art_boost: arts.gold_boost },
      }).then(() => {});

      return NextResponse.json({
        success: true,
        action: 'grant_gold',
        base_amount,
        final_amount: finalAmount,
        pipeline,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
