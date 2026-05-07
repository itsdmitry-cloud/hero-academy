// src/lib/hero/mappers.ts
// Pure functions: DB row -> zustand-store format.
// Used by both SSR hydration and client realtime updates.

import type { ExtendedHeroState, ActivityEntry } from '@/lib/store/heroStore';
import type { HeroRow, HeroStatsRow, ActivityLogRow } from './types';

export function mapHero(row: HeroRow, _stats: HeroStatsRow | null): ExtendedHeroState {
  return {
    heroId: row.id,
    name: row.name,
    avatar: row.gender === 'female' ? '🧙‍♀️' : '🧙‍♂️',
    gender: row.gender,
    level: row.level,
    xp: row.xp,
    xp_to_next: row.xp_to_next,
    hp: row.hp,
    hp_max: row.hp_max,
    gold: row.gold,
    streak: row.streak_current ?? 0,
    streak_best: row.streak_best ?? 0,
    season_xp: row.season_xp ?? 0,
    activeArtifacts: [],
  };
}

export function mapStats(stats: HeroStatsRow | null) {
  if (!stats) return null;
  return {
    strength: stats.strength,
    knowledge: stats.knowledge,
    endurance: stats.endurance,
    luck: stats.luck,
    wisdom: stats.wisdom,
  };
}

const IGNORED_ACTIONS = new Set([
  'lootbox_opened', 'seasonal_lootbox_opened', 'shop_purchase',
  'teacher_gold_grant', 'bp_reward_claimed',
]);

const RARITY_EMOJI: Record<string, string> = {
  common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡',
};
const RARITY_LABEL: Record<string, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};

type ActivityCategory = 'quest' | 'boss' | 'event';

function formatChange(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '-';
}

export function mapActivity(rows: ActivityLogRow[]): ActivityEntry[] {
  return rows
    .map((log): ActivityEntry | null => {
      if (IGNORED_ACTIONS.has(log.action)) return null;

      const meta = (log.metadata && typeof log.metadata === 'object' ? log.metadata : {}) as Record<string, unknown>;
      let category: ActivityCategory = 'event';
      let questName = '⚙️ Событие';
      let resultMsg = '⚙️ Событие';
      const msgs: string[] = [];

      if (log.action === 'quest_completed' || log.action === 'quest_complete') {
        category = 'quest';
        questName = String(meta.quest ?? 'Квест');
        resultMsg = '✅ Успех';
        if (Array.isArray(meta.pipeline)) msgs.push(...(meta.pipeline as string[]));

      } else if (log.action === 'teacher_xp_grant') {
        category = 'quest';
        questName = String(meta.reason ?? 'Награда учителя');
        const subj = meta.subject ? ` (${meta.subject})` : '';
        resultMsg = `🌟 Награда${subj}`;
        if (Array.isArray(meta.pipeline)) msgs.push(...(meta.pipeline as string[]));
        if (log.xp_change > 0) msgs.unshift(`⭐ Получено XP: +${log.xp_change}`);
        if (log.gold_change > 0) msgs.unshift(`💰 Получено золота: +${log.gold_change}`);

      } else if (log.action === 'grant_xp') {
        questName = String(meta.reason ?? 'Начисление XP');
        resultMsg = '⭐ XP';
        if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);

      } else if (log.action === 'grant_gold') {
        questName = String(meta.reason ?? 'Начисление золота');
        resultMsg = '💰 Золото';
        if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);

      } else if (log.action === 'teacher_damage' || log.action === 'damage') {
        questName = String(meta.reason ?? 'Штраф от учителя');
        resultMsg = `⚠️ Урон (${meta.subject ?? 'Предмет'})`;
        if (Array.isArray(meta.pipeline)) msgs.push(...(meta.pipeline as string[]));

      } else if (log.action === 'boss_kill_reward') {
        category = 'boss';
        const dmgMatch = String(meta.reason ?? '').match(/(\d+)%.*Боссу?\s*\(([^)]+)\)/i);
        if (dmgMatch) {
          questName = `🐉 Босс убит: ${dmgMatch[2]}`;
          const isMvp = String(meta.reason ?? '').includes('MVP');
          const isLastHit = String(meta.reason ?? '').includes('последний');
          resultMsg = `⚔️ ${dmgMatch[1]}% урона${isMvp ? ' 👑' : ''}${isLastHit ? ' 🗡️' : ''}`;
        } else {
          questName = '🐉 Победа над боссом';
          resultMsg = '⚔️ Участвовал';
        }
        if (log.xp_change > 0) msgs.push(`⭐ Опыт: +${log.xp_change}`);
        if (log.gold_change > 0) msgs.push(`💰 Золото: +${log.gold_change}`);
        if (meta.damage_dealt) msgs.push(`⚔️ Нанесено урона: ${meta.damage_dealt}`);
        if (meta.is_mvp) msgs.push(`👑 MVP — наибольший урон в классе!`);
        if (meta.is_last_hit) msgs.push(`🗡️ Последний удар — бонус +1000 XP`);
        if (Array.isArray(meta.level_ups) && (meta.level_ups as number[]).length > 0) {
          (meta.level_ups as number[]).forEach((lvl) => msgs.push(`🆙 Уровень повышен до ${lvl}!`));
        }

      } else if (log.action === 'artifact_drop') {
        const rar = String(meta.rarity ?? 'common');
        questName = `🎁 ${meta.artifact ?? 'Артефакт'}`;
        resultMsg = `${RARITY_EMOJI[rar] ?? '⚪'} ${RARITY_LABEL[rar] ?? rar}`;
        const srcLabel = meta.source === 'boss_kill' ? 'убийства босса' : 'задания';
        msgs.push(`Выпал из ${srcLabel}`);

      } else if (log.action === 'potion_used') {
        questName = `⚗️ ${meta.item ?? meta.artifact ?? 'Расходник'}`;
        resultMsg = '✨ Эффект применён';
        if (meta.effect) msgs.push(`Эффект: ${meta.effect}`);

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

      } else if (log.action === 'streak_bonus' || log.action === 'streak_reward' || log.action === 'streak_update') {
        const days = meta.days ?? meta.streak ?? '?';
        questName = `🔥 Стрик: ${days} дней`;
        resultMsg = '🏅 Награда за стрик';
        if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);
        if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);

      } else if (log.action === 'boss_damage') {
        category = 'boss';
        const subj = String(meta.subject ?? meta.boss_name ?? 'Босс');
        const dmg = Number(meta.damage_dealt ?? 0);
        questName = `🐉 Атака босса: ${subj}`;
        resultMsg = `⚔️ ${dmg.toLocaleString('ru-RU')} урона`;
        msgs.push(`⚔️ Урон нанесён: ${dmg.toLocaleString('ru-RU')}`);
        if (meta.boss_name) msgs.push(`🐉 Босс: ${meta.boss_name}`);
        if (meta.subject) msgs.push(`📚 Предмет: ${meta.subject}`);

      } else if (log.action === 'quest_graded') {
        category = 'quest';
        const subj = String(meta.subject ?? '');
        const score = Number(meta.score ?? 0);
        questName = subj ? `📝 ${subj}: оценка ${score}` : `📝 Проверено: оценка ${score}`;
        resultMsg = score >= 4 ? '✅ Хорошо' : score === 3 ? '⚠️ Удовл.' : '❌ Плохо';

      } else if (log.action === 'level_up') {
        questName = `🆙 Уровень ${meta.level ?? '?'}!`;
        resultMsg = '✨ Повышение уровня';
      }

      return {
        id: log.id,
        date: new Date(log.created_at).toLocaleDateString('ru-RU'),
        quest: questName,
        result: resultMsg,
        category,
        xp: formatChange(log.xp_change),
        gold: formatChange(log.gold_change),
        messages: msgs,
        action: log.action,
        metadata: meta,
        xpChangeRaw: log.xp_change,
        hpChangeRaw: log.hp_change,
        goldChangeRaw: log.gold_change,
      };
    })
    .filter((x): x is ActivityEntry => x !== null);
}
