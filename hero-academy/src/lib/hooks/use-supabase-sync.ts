'use client';

/**
 * Sync hook that bridges Supabase data into the existing Zustand heroStore.
 * Always overwrites the store with real DB data when authenticated.
 */

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHeroStore } from '@/lib/store/heroStore';

export function useSupabaseSync() {
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    async function syncHeroData() {
      if (!user) return;

      const { data: hero } = await supabase
        .from('heroes')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!hero) return;

      const [statsRes, logsRes] = await Promise.all([
        supabase
          .from('hero_stats')
          .select('strength, knowledge, endurance, luck, wisdom')
          .eq('hero_id', hero.id)
          .single(),
        supabase
          .from('activity_log')
          .select('*')
          .eq('hero_id', hero.id)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      const stats = statsRes.data;
      const logs = logsRes.data;

      const store = useHeroStore.getState();
      
      const parsedActivity = (logs || []).map(log => {
        const meta = typeof log.metadata === 'object' ? log.metadata : {} as Record<string, unknown>;

        // Skip these entirely – no value for student to see
        if (['lootbox_opened', 'shop_purchase', 'teacher_gold_grant', 'bp_reward_claimed'].includes(log.action)) return null;

        let category: 'quest' | 'boss' | 'event' = 'event';

        const rarityEmoji: Record<string, string> = { common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡' };
        let questName = log.action;
        let resultMsg  = log.action;
        const msgs: string[] = [];

        // ── QUEST / DUNGEON / BOSS XP grant ──────────────────────────────────
        if (log.action === 'quest_completed' || log.action === 'quest_complete') {
          category = 'quest';
          questName = String(meta.quest ?? 'Квест');
          resultMsg  = '✅ Успех';
          if (Array.isArray(meta.pipeline)) msgs.push(...meta.pipeline as string[]);

        // ── TEACHER XP or GOLD ────────────────────────────────────────────────
        } else if (log.action === 'teacher_xp_grant') {
          category  = 'quest';
          questName = String(meta.reason ?? 'Награда учителя');
          const subj = meta.subject ? ` (${meta.subject})` : '';
          resultMsg  = `🌟 Награда${subj}`;
          if (Array.isArray(meta.pipeline)) msgs.push(...meta.pipeline as string[]);
          if (log.xp_change > 0)   msgs.unshift(`⭐ Получено XP: +${log.xp_change}`);
          if (log.gold_change > 0) msgs.unshift(`💰 Получено золота: +${log.gold_change}`);

        // ── SYSTEM GRANT ──────────────────────────────────────────────────────
        } else if (log.action === 'grant_xp') {
          questName = String(meta.reason ?? 'Начисление XP');
          resultMsg  = '⭐ XP';
          if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);

        } else if (log.action === 'grant_gold') {
          questName = String(meta.reason ?? 'Начисление золота');
          resultMsg  = '💰 Золото';
          if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);

        // ── DAMAGE ────────────────────────────────────────────────────────────
        } else if (log.action === 'teacher_damage' || log.action === 'damage') {
          questName = String(meta.reason ?? 'Штраф от учителя');
          resultMsg  = `⚠️ Урон (${meta.subject ?? 'Предмет'})`;
          if (Array.isArray(meta.pipeline)) msgs.push(...meta.pipeline as string[]);

        // ── BOSS KILL REWARD ──────────────────────────────────────────────────
        } else if (log.action === 'boss_kill_reward') {
          category = 'boss';
          const dmgMatch = String(meta.reason ?? '').match(/(\d+)%.*Боссу?\s*\(([^)]+)\)/i);
          if (dmgMatch) {
            questName = `🐉 Босс убит: ${dmgMatch[2]}`;
            const isMvp     = String(meta.reason ?? '').includes('MVP');
            const isLastHit = String(meta.reason ?? '').includes('последний');
            resultMsg = `⚔️ ${dmgMatch[1]}% урона${isMvp ? ' 👑' : ''}${isLastHit ? ' 🗡️' : ''}`;
          } else {
            questName = '🐉 Победа над боссом';
            resultMsg  = '⚔️ Участвовал';
          }
          // Detailed stats in expanded section
          if (log.xp_change > 0)   msgs.push(`⭐ Опыт: +${log.xp_change}`);
          if (log.gold_change > 0) msgs.push(`💰 Золото: +${log.gold_change}`);
          if (meta.damage_dealt)   msgs.push(`⚔️ Нанесено урона: ${meta.damage_dealt}`);
          if (meta.is_mvp)         msgs.push(`👑 MVP — наибольший урон в классе!`);
          if (meta.is_last_hit)    msgs.push(`🗡️ Последний удар — бонус +1000 XP`);
          if (Array.isArray(meta.level_ups) && (meta.level_ups as number[]).length > 0) {
            (meta.level_ups as number[]).forEach(lvl => msgs.push(`🆙 Уровень повышен до ${lvl}!`));
          }

        // ── ARTIFACT DROP ─────────────────────────────────────────────────────
        } else if (log.action === 'artifact_drop') {
          const rar = String(meta.rarity ?? 'common');
          questName = `🎁 ${meta.artifact ?? 'Артефакт'}`;
          resultMsg  = `${rarityEmoji[rar] ?? '⚪'} ${rar.charAt(0).toUpperCase() + rar.slice(1)}`;
          const srcLabel = meta.source === 'boss_kill' ? 'убийства босса' : 'задания';
          msgs.push(`Выпал из ${srcLabel}`);

        // ── POTIONS & CONSUMABLES ─────────────────────────────────────────────
        } else if (log.action === 'potion_used') {
          questName = `⚗️ ${meta.item ?? meta.artifact ?? 'Расходник'}`;
          resultMsg  = '✨ Эффект применён';
          if (meta.effect) msgs.push(`Эффект: ${meta.effect}`);

        // ── CLASS ARTIFACTS ───────────────────────────────────────────────────
        } else if (log.action === 'class_artifact_used') {
          const actName = String(meta.activator_name ?? 'Одноклассник');
          const artName = String(meta.artifact ?? 'Массовый артефакт');
          const icon = String(meta.icon ?? '✨');
          questName = `${icon} ${artName} (от ${actName})`;
          resultMsg = '🎊 Подарок классу!';
          msgs.push(`🔥 ${actName} применил(а) сезонный эффект на весь класс!`);
          if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);
          if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);
          if (log.hp_change > 0) msgs.push(`❤️ +${log.hp_change} HP`);

        // ── TEAM ARTIFACT ACTIVATED ──────────────────────────────────
        } else if (log.action === 'team_artifact_activated') {
          const actName = String(meta.activator_name ?? 'Одноклассник');
          const artNameStr = String(meta.artifact ?? 'Командный артефакт');
          const icon = String(meta.icon ?? '✨');
          const effectVal = Number(meta.effect_value ?? 0);
          const durationH = meta.duration_hours ? Number(meta.duration_hours) : null;

          if (durationH) {
            questName = `${icon} ${actName} активировал(а) «${artNameStr}»`;
            resultMsg = '🛡️ Аура класса!';
            msgs.push(`🔥 ${artNameStr} — +${effectVal}% на ${durationH}ч для всего класса`);
          } else {
            questName = `${icon} ${actName} использовал(а) «${artNameStr}»`;
            resultMsg = '🎊 Подарок классу!';
            msgs.push(`🔥 ${artNameStr} — эффект применён ко всему классу`);
          }

        // ── STREAK ───────────────────────────────────────────────────────────
        } else if (log.action === 'streak_bonus' || log.action === 'streak_reward' || log.action === 'streak_update') {
          const days = meta.days ?? meta.streak ?? '?';
          questName = `🔥 Стрик: ${days} дней`;
          resultMsg  = '🏅 Награда за стрик';
          if (log.xp_change > 0)   msgs.push(`⭐ +${log.xp_change} XP`);
          if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);

        // ── BOSS DAMAGE (from batch grading) ─────────────────────────────────
        } else if (log.action === 'boss_damage') {
          category = 'boss';
          const subj = String(meta.subject ?? meta.boss_name ?? 'Босс');
          const dmg  = Number(meta.damage_dealt ?? 0);
          questName  = `🐉 Атака босса: ${subj}`;
          resultMsg  = `⚔️ ${dmg.toLocaleString('ru-RU')} урона`;
          msgs.push(`⚔️ Урон нанесён: ${dmg.toLocaleString('ru-RU')}`);
          if (meta.boss_name) msgs.push(`🐉 Босс: ${meta.boss_name}`);
          if (meta.subject)   msgs.push(`📚 Предмет: ${meta.subject}`);

        // ── QUEST GRADED (from batch grading) ─────────────────────────────────
        } else if (log.action === 'quest_graded') {
          category  = 'quest';
          const subj  = String(meta.subject ?? '');
          const score = Number(meta.score ?? 0);
          questName  = subj ? `📝 ${subj}: оценка ${score}` : `📝 Проверено: оценка ${score}`;
          resultMsg  = score >= 4 ? '✅ Хорошо' : score === 3 ? '⚠️ Удовл.' : '❌ Плохо';

        // ── LEVEL UP ──────────────────────────────────────────────────────────
        } else if (log.action === 'level_up') {
          questName = `🆙 Уровень ${meta.level ?? '?'}!`;
          resultMsg  = '✨ Повышение уровня';
        }

        return {
          id:       log.id,
          date:     new Date(log.created_at).toLocaleDateString('ru-RU'),
          quest:    questName,
          result:   resultMsg,
          category,
          xp:       log.xp_change > 0 ? `+${log.xp_change}` : log.xp_change < 0 ? `${log.xp_change}` : '-',
          gold:     log.gold_change > 0 ? `+${log.gold_change}` : log.gold_change < 0 ? `${log.gold_change}` : '-',
          messages: msgs,
          // raw fields for ActionBreakdown
          action:        log.action,
          metadata:      meta as Record<string, unknown>,
          xpChangeRaw:   log.xp_change,
          hpChangeRaw:   log.hp_change,
          goldChangeRaw: log.gold_change,
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      useHeroStore.setState({
        hero: {
          ...store.hero,
          // Always overwrite with DB values — never fall back to stale localStorage "Артём Воин"
          heroId: hero.id,
          name: hero.name,
          gender: hero.gender,
          level: hero.level,
          xp: hero.xp,
          xp_to_next: hero.xp_to_next,
          hp: hero.hp,
          hp_max: hero.hp_max,
          gold: hero.gold,
          streak: hero.streak_current ?? 0,
          streak_best: hero.streak_best ?? 0,
          season_xp: hero.season_xp ?? 0,
        },
        stats: stats ? {
          strength: stats.strength,
          knowledge: stats.knowledge,
          endurance: stats.endurance,
          luck: stats.luck,
          wisdom: stats.wisdom,
        } : store.stats,
        activity: parsedActivity
      });
      // Signal that real data has arrived — page can hide skeleton
      useHeroStore.getState().markSynced();
    }

    syncHeroData();
  // Re-run whenever the user changes (covers login/logout/switch account)
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isLive: !!user };
}
