import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { applyXpGain } from '@/lib/game/constants';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/game/use-artifact
 * Handles ALL consumable artifact types, including class-wide and boss damage.
 * Body: { heroArtifactId: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { heroArtifactId } = await req.json();
    if (!heroArtifactId) return NextResponse.json({ error: 'heroArtifactId required' }, { status: 400 });

    // Load the hero_artifact + joined artifact definition
    const { data: entry } = await admin
      .from('hero_artifacts')
      .select('*, artifact:artifact_id(*)')
      .eq('id', heroArtifactId)
      .single();

    if (!entry) return NextResponse.json({ error: 'Артефакт не найден' }, { status: 404 });

    const art = entry.artifact as Record<string, unknown>;
    const effect = String(art.effect ?? art.effect_type ?? '');
    let val = Number(art.effect_value ?? 0);
    const artName = String(art.name ?? 'Артефакт');

    // Load hero
    const { data: hero } = await admin
      .from('heroes')
      .select('id, user_id, xp, hp, hp_max, gold, level, xp_to_next, season_xp, status')
      .eq('user_id', user.id)
      .single();

    if (!hero) return NextResponse.json({ error: 'Герой не найден' }, { status: 404 });

    // Verify ownership
    if (entry.hero_id !== hero.id) {
      return NextResponse.json({ error: 'Этот артефакт не принадлежит вашему герою' }, { status: 403 });
    }

    // ═══ DYNAMIC LEVEL SCALING ═══
    // +10% power for every level above 1, for flat XP/Gold/Damage consumables.
    const scalableEffects = [
      'xp_instant', 'consumable_xp', 'consumable_season_xp',
      'gold_bonus', 'extra_gold', 'gold_instant', 'consumable_random_gold',
      'consumable_class_xp', 'consumable_class_gold', 
      'consumable_boss_damage'
    ];
    
    if (scalableEffects.includes(effect)) {
      const scaleMultiplier = 1 + (hero.level - 1) * 0.1;
      val = Math.round(val * scaleMultiplier);
    }
    // ═════════════════════════════

    // Load user class_id for class-wide effects
    const { data: userData } = await admin.from('users').select('class_id').eq('id', user.id).single();
    const classId = userData?.class_id ?? null;

    // Helper: consume the artifact
    const consumeArtifact = async () => {
      await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);
    };

    // Helper: log activity
    const logActivity = async (action: string, meta: Record<string, unknown>, changes?: { xp?: number; gold?: number; hp?: number }) => {
      await admin.from('activity_log').insert({
        hero_id: hero.id,
        user_id: user.id,
        action,
        xp_change: changes?.xp ?? 0,
        gold_change: changes?.gold ?? 0,
        hp_change: changes?.hp ?? 0,
        metadata: { artifact: artName, ...meta },
      });
    };

    // ══════════════════════════════════════════
    // SIMPLE CONSUMABLES (single hero)
    // ══════════════════════════════════════════

    if (effect === 'hp_restore') {
      const newHp = Math.min(hero.hp_max, hero.hp + val);
      if (newHp <= hero.hp) return NextResponse.json({ error: 'Здоровье уже полное' }, { status: 400 });
      await admin.from('heroes').update({ hp: newHp, status: 'active' }).eq('id', hero.id);
      await consumeArtifact();
      await logActivity('potion_used', { effect: 'hp_restore' }, { hp: newHp - hero.hp });
      return NextResponse.json({ success: true, effect: 'hp_restore', value: val, message: `❤️ +${val} HP` });
    }

    if (effect === 'xp_instant' || effect === 'consumable_xp') {
      const { xp, level, xpNext } = applyXpGain(hero.xp, hero.level, hero.xp_to_next, val);
      const upd: Record<string, unknown> = { xp, level, xp_to_next: xpNext, status: 'active', season_xp: (hero.season_xp ?? 0) + val };
      await admin.from('heroes').update(upd).eq('id', hero.id);
      await consumeArtifact();
      await logActivity('potion_used', { effect: 'xp_instant' }, { xp: val });
      return NextResponse.json({ success: true, effect: 'xp_instant', value: val, message: `⚡ +${val} XP` });
    }

    if (effect === 'gold_bonus' || effect === 'extra_gold' || effect === 'gold_instant') {
      await admin.from('heroes').update({ gold: hero.gold + val }).eq('id', hero.id);
      await consumeArtifact();
      await logActivity('potion_used', { effect: 'gold_bonus' }, { gold: val });
      return NextResponse.json({ success: true, effect: 'gold_bonus', value: val, message: `💰 +${val} золота` });
    }

    if (effect === 'consumable_season_xp') {
      const newSeasonXp = (hero.season_xp ?? 0) + val;
      await admin.from('heroes').update({ season_xp: newSeasonXp }).eq('id', hero.id);
      await consumeArtifact();
      await logActivity('potion_used', { effect: 'season_xp' }, { xp: val });
      return NextResponse.json({ success: true, effect: 'season_xp', value: val, message: `🔥 +${val} сезонного XP` });
    }

    // ══════════════════════════════════════════
    // CLASS-WIDE CONSUMABLES
    // ══════════════════════════════════════════

    if (effect === 'consumable_class_hp') {
      if (!classId) return NextResponse.json({ error: 'Вы не состоите в классе' }, { status: 400 });

      // Get all heroes in class
      const { data: students } = await admin.from('users').select('id').eq('class_id', classId).eq('role', 'student');
      if (!students?.length) return NextResponse.json({ error: 'В классе нет учеников' }, { status: 400 });

      const userIds = students.map(s => s.id);
      const { data: heroes } = await admin.from('heroes').select('id, user_id, hp, hp_max').in('user_id', userIds);

      const { data: activatorUser } = await admin.from('users').select('display_name').eq('id', user.id).single();
      const activatorName = activatorUser?.display_name ?? 'Герой';

      let healed = 0;
      const logEntries = [];
      if (heroes) {
        for (const h of heroes) {
          const newHp = Math.min(h.hp_max, h.hp + val);
          if (newHp > h.hp) {
            await admin.from('heroes').update({ hp: newHp, status: 'active' }).eq('id', h.id);
            healed++;
          }
          // Log for everyone in class
          logEntries.push({
            hero_id: h.id, 
            user_id: h.user_id, // we don't have user_id grouped here, but we can fetch it or just use h.id! Wait, heroes table doesn't return user_id in the select!
            action: 'class_artifact_used',
            hp_change: newHp > h.hp ? val : 0,
            metadata: {
              artifact: artName, effect_type: effect, effect_value: val,
              activator_name: activatorName, icon: '❤️', class_id: classId,
            }
          });
        }
      }

      await consumeArtifact();
      if (logEntries.length > 0) await admin.from('activity_log').insert(logEntries);

      return NextResponse.json({ success: true, effect: 'class_hp', value: val, message: `❤️ +${val} HP для ${healed} учеников!` });
    }

    if (effect === 'consumable_class_xp') {
      if (!classId) return NextResponse.json({ error: 'Вы не состоите в классе' }, { status: 400 });

      const { data: students } = await admin.from('users').select('id').eq('class_id', classId).eq('role', 'student');
      if (!students?.length) return NextResponse.json({ error: 'В классе нет учеников' }, { status: 400 });

      const userIds = students.map(s => s.id);
      const { data: heroes } = await admin.from('heroes').select('id, user_id, xp, level, xp_to_next, season_xp').in('user_id', userIds);

      const { data: activatorUser } = await admin.from('users').select('display_name').eq('id', user.id).single();
      const activatorName = activatorUser?.display_name ?? 'Герой';

      let boosted = 0;
      const logEntries = [];
      if (heroes) {
        for (const h of heroes) {
          const { xp, level, xpNext } = applyXpGain(h.xp, h.level, h.xp_to_next, val);
          const upd: Record<string, unknown> = { xp, level, xp_to_next: xpNext, season_xp: (h.season_xp ?? 0) + val };
          await admin.from('heroes').update(upd).eq('id', h.id);
          boosted++;

          logEntries.push({
            hero_id: h.id, 
            user_id: h.user_id,
            action: 'class_artifact_used',
            xp_change: val,
            metadata: {
              artifact: artName, effect_type: effect, effect_value: val,
              activator_name: activatorName, icon: '⚡', class_id: classId,
            }
          });
        }
      }

      await consumeArtifact();
      if (logEntries.length > 0) await admin.from('activity_log').insert(logEntries);

      return NextResponse.json({ success: true, effect: 'class_xp', value: val, message: `⚡ +${val} XP для ${boosted} учеников!` });
    }

    if (effect === 'consumable_class_gold') {
      if (!classId) return NextResponse.json({ error: 'Вы не состоите в классе' }, { status: 400 });

      const { data: students } = await admin.from('users').select('id').eq('class_id', classId).eq('role', 'student');
      if (!students?.length) return NextResponse.json({ error: 'В классе нет учеников' }, { status: 400 });

      const userIds = students.map(s => s.id);
      const { data: heroes } = await admin.from('heroes').select('id, user_id, gold').in('user_id', userIds);

      const { data: activatorUser } = await admin.from('users').select('display_name').eq('id', user.id).single();
      const activatorName = activatorUser?.display_name ?? 'Герой';

      let gifted = 0;
      const logEntries = [];
      if (heroes) {
        for (const h of heroes) {
          await admin.from('heroes').update({ gold: h.gold + val }).eq('id', h.id);
          gifted++;

          logEntries.push({
            hero_id: h.id, 
            user_id: h.user_id,
            action: 'class_artifact_used',
            gold_change: val,
            metadata: {
              artifact: artName, effect_type: effect, effect_value: val,
              activator_name: activatorName, icon: '💰', class_id: classId,
            }
          });
        }
      }

      await consumeArtifact();
      if (logEntries.length > 0) await admin.from('activity_log').insert(logEntries);

      return NextResponse.json({ success: true, effect: 'class_gold', value: val, message: `💰 +${val} золота для ${gifted} учеников!` });
    }

    // ══════════════════════════════════════════
    // BOSS DAMAGE CONSUMABLES
    // ══════════════════════════════════════════

    if (effect === 'consumable_boss_damage') {
      if (!classId) return NextResponse.json({ error: 'Вы не состоите в классе' }, { status: 400 });

      // Find active boss for this class
      const { data: boss } = await admin.from('subject_bosses')
        .select('id, name, current_hp')
        .eq('class_id', classId)
        .eq('is_defeated', false)
        .gt('current_hp', 0)
        .limit(1)
        .maybeSingle();

      if (!boss) return NextResponse.json({ error: 'Нет активного босса в вашем классе!' }, { status: 400 });

      const newBossHp = Math.max(0, boss.current_hp - val);
      await admin.from('subject_bosses').update({
        current_hp: newBossHp,
        is_defeated: newBossHp === 0,
      }).eq('id', boss.id);

      // Log boss damage
      await admin.from('boss_damage_logs').insert({
        boss_id: boss.id,
        hero_id: hero.id,
        damage_dealt: val,
        action_type: 'artifact_consumable',
      });

      await consumeArtifact();
      await logActivity('boss_damage', {
        boss_id: boss.id, boss_name: boss.name,
        damage_dealt: val, source: 'artifact',
      });

      return NextResponse.json({
        success: true, effect: 'boss_damage', value: val,
        message: `🐉 ${val} урона боссу «${boss.name}»! (HP: ${boss.current_hp} → ${newBossHp})`,
        bossDefeated: newBossHp === 0,
      });
    }

    // ══════════════════════════════════════════
    // RANDOM STUDENT GIFTS
    // ══════════════════════════════════════════

    if (effect === 'consumable_random_student') {
      if (!classId) return NextResponse.json({ error: 'Вы не состоите в классе' }, { status: 400 });

      // Get all OTHER students in class
      const { data: students } = await admin.from('users')
        .select('id, display_name')
        .eq('class_id', classId).eq('role', 'student')
        .neq('id', user.id);

      if (!students?.length) return NextResponse.json({ error: 'Нет других учеников в классе' }, { status: 400 });

      const lucky = students[Math.floor(Math.random() * students.length)];
      const { data: luckyHero } = await admin.from('heroes')
        .select('id, xp, gold, level, xp_to_next, season_xp')
        .eq('user_id', lucky.id).single();

      if (!luckyHero) return NextResponse.json({ error: 'Герой получателя не найден' }, { status: 400 });

      const { xp, level, xpNext } = applyXpGain(luckyHero.xp, luckyHero.level, luckyHero.xp_to_next, val);
      const upd: Record<string, unknown> = { xp, level, xp_to_next: xpNext, gold: luckyHero.gold + val, season_xp: (luckyHero.season_xp ?? 0) + val };
      await admin.from('heroes').update(upd).eq('id', luckyHero.id);

      await consumeArtifact();

      const { data: activatorUser } = await admin.from('users').select('display_name').eq('id', user.id).single();
      await admin.from('activity_log').insert({
        hero_id: hero.id, user_id: user.id,
        action: 'class_artifact_used',
        metadata: {
          artifact: artName, effect_type: effect, effect_value: val,
          activator_name: activatorUser?.display_name ?? 'Герой',
          recipient: lucky.display_name,
          icon: '🎁', class_id: classId,
        },
      });

      return NextResponse.json({
        success: true, effect: 'random_student', value: val,
        message: `🎁 ${lucky.display_name} получил(а) +${val} XP и +${val} золота!`,
      });
    }

    if (effect === 'consumable_random_gold') {
      // Same as random_student but gold only
      if (!classId) return NextResponse.json({ error: 'Вы не состоите в классе' }, { status: 400 });

      const { data: students } = await admin.from('users')
        .select('id, display_name')
        .eq('class_id', classId).eq('role', 'student')
        .neq('id', user.id);

      if (!students?.length) return NextResponse.json({ error: 'Нет других учеников' }, { status: 400 });

      const lucky = students[Math.floor(Math.random() * students.length)];
      const { data: luckyHero } = await admin.from('heroes')
        .select('id, gold').eq('user_id', lucky.id).single();

      if (!luckyHero) return NextResponse.json({ error: 'Герой не найден' }, { status: 400 });

      await admin.from('heroes').update({ gold: luckyHero.gold + val }).eq('id', luckyHero.id);
      await consumeArtifact();

      const { data: activatorUser } = await admin.from('users').select('display_name').eq('id', user.id).single();
      await admin.from('activity_log').insert({
        hero_id: hero.id, user_id: user.id,
        action: 'class_artifact_used',
        metadata: {
          artifact: artName, effect_type: effect, effect_value: val,
          activator_name: activatorUser?.display_name ?? 'Герой',
          recipient: lucky.display_name,
          icon: '💰', class_id: classId,
        },
      });

      return NextResponse.json({
        success: true, effect: 'random_gold', value: val,
        message: `💰 ${lucky.display_name} получил(а) +${val} золота!`,
      });
    }

    // ══════════════════════════════════════════
    // COMBO CONSUMABLE (XP + Gold + HP)
    // ══════════════════════════════════════════

    if (effect === 'consumable_combo') {
      // Combo: +100 XP, +50 Gold, +25 HP
      const comboXp = 100, comboGold = 50, comboHp = 25;
      const newHp = Math.min(hero.hp_max, hero.hp + comboHp);
      const { xp, level, xpNext } = applyXpGain(hero.xp, hero.level, hero.xp_to_next, comboXp);
      const upd: Record<string, unknown> = {
        xp, level, xp_to_next: xpNext,
        gold: hero.gold + comboGold, hp: newHp, status: 'active',
        season_xp: (hero.season_xp ?? 0) + comboXp,
      };
      await admin.from('heroes').update(upd).eq('id', hero.id);
      await consumeArtifact();
      await logActivity('potion_used', { effect: 'combo' }, { xp: comboXp, gold: comboGold, hp: comboHp });
      return NextResponse.json({
        success: true, effect: 'combo', value: comboXp,
        message: `🔥 Комбо! +${comboXp} XP, +${comboGold} 💰, +${comboHp} ❤️`,
      });
    }

    // ══════════════════════════════════════════
    // SPECIAL CONSUMABLES
    // ══════════════════════════════════════════

    if (effect === 'skip_day') {
      await consumeArtifact();
      await logActivity('artifact_skip_homework', { effect: 'skip_day' });
      return NextResponse.json({ success: true, effect: 'skip_day', value: 1, message: '📜 Домашка пропущена без потери HP!' });
    }

    if (effect === 'force_level_up') {
      const { xp, level, xpNext } = applyXpGain(hero.xp, hero.level, hero.xp_to_next, hero.xp_to_next - hero.xp);
      await admin.from('heroes').update({ xp, level, xp_to_next: xpNext }).eq('id', hero.id);
      await consumeArtifact();
      await logActivity('artifact_level_up', { effect: 'force_level_up', new_level: level });
      return NextResponse.json({ success: true, effect: 'force_level_up', value: level, message: `🧪 Мгновенное повышение до уровня ${level}!` });
    }

    return NextResponse.json({ error: `Неизвестный эффект: ${effect}` }, { status: 400 });
  } catch (err) {
    console.error('[use-artifact]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
