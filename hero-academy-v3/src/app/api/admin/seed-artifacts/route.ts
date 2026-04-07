import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Seed all 45+ artifacts from GAME_MECHANICS.md
 * POST /api/admin/seed-artifacts
 */

interface ArtifactSeed {
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  effect_type: string;       // e.g. 'hp_restore', 'xp_boost', 'dmg_reduce', 'gold_boost', etc.
  effect_value: number;      // percentage or flat value
  effect: string;            // machine-readable effect tag for pipeline
  duration_hours: number;    // 0 = instant/charges only
  max_charges: number;       // 0 = duration-based
  drop_rate: number;         // relative weight (0-1)
  stackable: boolean;
  is_shopable: boolean;
  min_level: number;         // required hero level to equip
  artifact_type: 'consumable' | 'passive';
}

const ARTIFACTS: ArtifactSeed[] = [
  // ═══════ 🟢 COMMON (10) ═══════
  { name: 'Малое Снадобье Памяти', description: 'Мгновенно восстанавливает 30 HP.', rarity: 'common', icon: '🧪', effect_type: 'hp_restore', effect_value: 30, effect: 'hp_restore_30', duration_hours: 0, max_charges: 1, drop_rate: 0.3, stackable: true, is_shopable: true, min_level: 1, artifact_type: 'consumable' },
  { name: 'Ученическое Перо', description: '+10% XP за все задания. 24 часа.', rarity: 'common', icon: '🪶', effect_type: 'xp_boost', effect_value: 10, effect: 'xp_boost', duration_hours: 24, max_charges: 0, drop_rate: 0.25, stackable: false, is_shopable: true, min_level: 1, artifact_type: 'passive' },
  { name: 'Деревянный Щит', description: 'Снижает HP урон на 10%. Заряды: 3.', rarity: 'common', icon: '🛡️', effect_type: 'dmg_reduce', effect_value: 10, effect: 'dmg_reduce', duration_hours: 0, max_charges: 3, drop_rate: 0.25, stackable: false, is_shopable: true, min_level: 1, artifact_type: 'passive' },
  { name: 'Рваный Пергамент', description: '+10% Gold за все задания. 24 часа.', rarity: 'common', icon: '📜', effect_type: 'gold_boost', effect_value: 10, effect: 'gold_boost', duration_hours: 24, max_charges: 0, drop_rate: 0.25, stackable: false, is_shopable: true, min_level: 1, artifact_type: 'passive' },
  { name: 'Медная Монета', description: '+5 бонусных Gold за квест. Заряды: 3.', rarity: 'common', icon: '🪙', effect_type: 'gold_flat', effect_value: 5, effect: 'extra_gold', duration_hours: 0, max_charges: 3, drop_rate: 0.2, stackable: false, is_shopable: true, min_level: 1, artifact_type: 'passive' },
  { name: 'Свиток Концентрации', description: '-50% HP урона от одной ошибки. Заряд: 1.', rarity: 'common', icon: '📋', effect_type: 'dmg_reduce', effect_value: 50, effect: 'dmg_reduce', duration_hours: 0, max_charges: 1, drop_rate: 0.15, stackable: false, is_shopable: true, min_level: 2, artifact_type: 'passive' },
  { name: 'Бронзовое Кольцо', description: '+5% Gold постоянно (пока надето).', rarity: 'common', icon: '💍', effect_type: 'gold_boost', effect_value: 5, effect: 'gold_boost', duration_hours: 0, max_charges: 0, drop_rate: 0.15, stackable: false, is_shopable: true, min_level: 2, artifact_type: 'passive' },
  { name: 'Флакон Чернил', description: '-5 HP абсолютное снижение урона. Заряды: 5.', rarity: 'common', icon: '🖋️', effect_type: 'dmg_flat_reduce', effect_value: 5, effect: 'dmg_reduce', duration_hours: 0, max_charges: 5, drop_rate: 0.15, stackable: false, is_shopable: true, min_level: 3, artifact_type: 'passive' },
  { name: 'Плащ Новичка', description: '+5% XP и +5% Gold. 12 часов.', rarity: 'common', icon: '🧥', effect_type: 'combo_boost', effect_value: 5, effect: 'xp_boost,gold_boost', duration_hours: 12, max_charges: 0, drop_rate: 0.15, stackable: false, is_shopable: true, min_level: 3, artifact_type: 'passive' },
  { name: 'Магнит Жадности', description: '+20% Gold. 6 часов.', rarity: 'common', icon: '🧲', effect_type: 'gold_boost', effect_value: 20, effect: 'gold_boost', duration_hours: 6, max_charges: 0, drop_rate: 0.1, stackable: false, is_shopable: true, min_level: 4, artifact_type: 'passive' },

  // ═══════ 🔵 RARE (10) ═══════
  { name: 'Среднее Зелье Бодрости', description: 'Мгновенно восстанавливает 60 HP.', rarity: 'rare', icon: '⚗️', effect_type: 'hp_restore', effect_value: 60, effect: 'hp_restore_60', duration_hours: 0, max_charges: 1, drop_rate: 0.15, stackable: true, is_shopable: true, min_level: 5, artifact_type: 'consumable' },
  { name: 'Броня Усидчивости', description: '-30% урона по HP. Заряды: 5.', rarity: 'rare', icon: '🦺', effect_type: 'dmg_reduce', effect_value: 30, effect: 'dmg_reduce', duration_hours: 0, max_charges: 5, drop_rate: 0.12, stackable: false, is_shopable: false, min_level: 5, artifact_type: 'passive' },
  { name: 'Кошель Удачи', description: '+30% Gold. 48 часов.', rarity: 'rare', icon: '👛', effect_type: 'gold_boost', effect_value: 30, effect: 'gold_boost', duration_hours: 48, max_charges: 0, drop_rate: 0.12, stackable: false, is_shopable: false, min_level: 5, artifact_type: 'passive' },
  { name: 'Свеча Полуночника', description: 'Защита стрика от сброса. 1 день.', rarity: 'rare', icon: '🕯️', effect_type: 'streak_protect', effect_value: 1, effect: 'streak_protect', duration_hours: 0, max_charges: 1, drop_rate: 0.1, stackable: false, is_shopable: true, min_level: 5, artifact_type: 'passive' },
  { name: 'Перо Калиграфа', description: '+20% XP. 24 часа.', rarity: 'rare', icon: '✒️', effect_type: 'xp_boost', effect_value: 20, effect: 'xp_boost', duration_hours: 24, max_charges: 0, drop_rate: 0.1, stackable: false, is_shopable: false, min_level: 6, artifact_type: 'passive' },
  { name: 'Серебряный Амулет', description: '+15% XP и +15% Gold. 48 часов.', rarity: 'rare', icon: '📿', effect_type: 'combo_boost', effect_value: 15, effect: 'xp_boost,gold_boost', duration_hours: 48, max_charges: 0, drop_rate: 0.08, stackable: false, is_shopable: false, min_level: 7, artifact_type: 'passive' },
  { name: 'Щит Стражника', description: '-50% HP урона. Заряды: 2.', rarity: 'rare', icon: '⚔️', effect_type: 'dmg_reduce', effect_value: 50, effect: 'damage_shield', duration_hours: 0, max_charges: 2, drop_rate: 0.08, stackable: false, is_shopable: false, min_level: 8, artifact_type: 'passive' },
  { name: 'Зелье Фокуса', description: '+100 XP мгновенно.', rarity: 'rare', icon: '🔮', effect_type: 'xp_instant', effect_value: 100, effect: 'xp_instant_100', duration_hours: 0, max_charges: 1, drop_rate: 0.08, stackable: true, is_shopable: true, min_level: 8, artifact_type: 'consumable' },
  { name: 'Плащ Ветра', description: '100% уклонение от урона. Заряд: 1.', rarity: 'rare', icon: '🌬️', effect_type: 'dmg_dodge', effect_value: 100, effect: 'damage_shield', duration_hours: 0, max_charges: 1, drop_rate: 0.06, stackable: false, is_shopable: false, min_level: 9, artifact_type: 'passive' },
  { name: 'Эликсир Озарения', description: '+50% XP. 5 часов.', rarity: 'rare', icon: '💡', effect_type: 'xp_boost', effect_value: 50, effect: 'xp_boost', duration_hours: 5, max_charges: 0, drop_rate: 0.06, stackable: false, is_shopable: false, min_level: 9, artifact_type: 'passive' },

  // ═══════ 🟣 EPIC (10) ═══════
  { name: 'Сфера Архимага', description: '+50% XP за работу у доски. Заряды: 3.', rarity: 'epic', icon: '🔴', effect_type: 'xp_boost_live', effect_value: 50, effect: 'xp_boost', duration_hours: 0, max_charges: 3, drop_rate: 0.05, stackable: false, is_shopable: false, min_level: 15, artifact_type: 'passive' },
  { name: 'Мифриловый Щит', description: '100% поглощение от критической ошибки. Заряды: 2.', rarity: 'epic', icon: '🛡️', effect_type: 'crit_shield', effect_value: 100, effect: 'damage_shield', duration_hours: 0, max_charges: 2, drop_rate: 0.04, stackable: false, is_shopable: false, min_level: 15, artifact_type: 'passive' },
  { name: 'Свиток Выходного Дня', description: 'Пропуск ДЗ без потери HP и Стрика.', rarity: 'epic', icon: '📅', effect_type: 'skip_quest', effect_value: 1, effect: 'skip_quest', duration_hours: 0, max_charges: 1, drop_rate: 0.04, stackable: true, is_shopable: false, min_level: 15, artifact_type: 'consumable' },
  { name: 'Большое Зелье', description: 'Полное восстановление HP (100 HP).', rarity: 'epic', icon: '🍷', effect_type: 'hp_restore', effect_value: 100, effect: 'hp_restore_100', duration_hours: 0, max_charges: 1, drop_rate: 0.04, stackable: true, is_shopable: true, min_level: 1, artifact_type: 'consumable' },
  { name: 'Золотая Чаша', description: '+100% Gold. 48 часов.', rarity: 'epic', icon: '🏆', effect_type: 'gold_boost', effect_value: 100, effect: 'gold_boost', duration_hours: 48, max_charges: 0, drop_rate: 0.03, stackable: false, is_shopable: false, min_level: 16, artifact_type: 'passive' },
  { name: 'Руна Знаний', description: '+50% XP. 48 часов.', rarity: 'epic', icon: '🔷', effect_type: 'xp_boost', effect_value: 50, effect: 'xp_boost', duration_hours: 48, max_charges: 0, drop_rate: 0.03, stackable: false, is_shopable: false, min_level: 17, artifact_type: 'passive' },
  { name: 'Адамантитовый Нагрудник', description: '-70% урона от ошибок. Заряды: 3.', rarity: 'epic', icon: '🦾', effect_type: 'dmg_reduce', effect_value: 70, effect: 'dmg_reduce', duration_hours: 0, max_charges: 3, drop_rate: 0.03, stackable: false, is_shopable: false, min_level: 18, artifact_type: 'passive' },
  { name: 'Кристалл Охотника', description: '+200 XP за победу над Боссом. Заряд: 1.', rarity: 'epic', icon: '💠', effect_type: 'xp_boss_bonus', effect_value: 200, effect: 'xp_boost', duration_hours: 0, max_charges: 1, drop_rate: 0.03, stackable: false, is_shopable: false, min_level: 19, artifact_type: 'passive' },
  { name: 'Кольцо Алхимика', description: '+50% XP и +50% Gold. 24 часа.', rarity: 'epic', icon: '💫', effect_type: 'combo_boost', effect_value: 50, effect: 'xp_boost,gold_boost', duration_hours: 24, max_charges: 0, drop_rate: 0.02, stackable: false, is_shopable: false, min_level: 20, artifact_type: 'passive' },
  { name: 'Младшее Перо Феникса', description: 'Выживание с 30 HP при смерти. Заряд: 1.', rarity: 'epic', icon: '🔥', effect_type: 'death_save', effect_value: 30, effect: 'death_save', duration_hours: 0, max_charges: 1, drop_rate: 0.02, stackable: false, is_shopable: false, min_level: 20, artifact_type: 'passive' },

  // ═══════ 🟡 LEGENDARY (10) ═══════
  { name: 'Корона Академии', description: '+100% XP и +50% Gold. Светящаяся аура. 7 дней.', rarity: 'legendary', icon: '👑', effect_type: 'combo_boost', effect_value: 100, effect: 'xp_boost,gold_boost', duration_hours: 168, max_charges: 0, drop_rate: 0.01, stackable: false, is_shopable: false, min_level: 25, artifact_type: 'passive' },
  { name: 'Песочные Часы Времени', description: 'Отмена последней двойки и полный возврат HP.', rarity: 'legendary', icon: '⏳', effect_type: 'undo_crit', effect_value: 100, effect: 'undo_crit', duration_hours: 0, max_charges: 1, drop_rate: 0.01, stackable: false, is_shopable: false, min_level: 25, artifact_type: 'consumable' },
  { name: 'Крест Возрождения', description: 'Отмена смерти + восстановление 50 HP. Заряд: 1.', rarity: 'legendary', icon: '✝️', effect_type: 'death_save', effect_value: 50, effect: 'death_save', duration_hours: 0, max_charges: 1, drop_rate: 0.008, stackable: false, is_shopable: false, min_level: 26, artifact_type: 'passive' },
  { name: 'Посох Властителя', description: '+200% XP за работу у доски. Заряды: 5.', rarity: 'legendary', icon: '🪄', effect_type: 'xp_boost_live', effect_value: 200, effect: 'xp_boost', duration_hours: 0, max_charges: 5, drop_rate: 0.008, stackable: false, is_shopable: false, min_level: 27, artifact_type: 'passive' },
  { name: 'Золотой Дракон', description: 'Золото ×3. 7 дней.', rarity: 'legendary', icon: '🐲', effect_type: 'gold_boost', effect_value: 200, effect: 'gold_boost', duration_hours: 168, max_charges: 0, drop_rate: 0.005, stackable: false, is_shopable: false, min_level: 28, artifact_type: 'passive' },
  { name: 'Непробиваемая Эгида', description: '100% иммунитет к ошибкам в ДЗ. Заряды: 3 квеста.', rarity: 'legendary', icon: '🏰', effect_type: 'dmg_immune', effect_value: 100, effect: 'damage_shield', duration_hours: 0, max_charges: 3, drop_rate: 0.005, stackable: false, is_shopable: false, min_level: 29, artifact_type: 'passive' },
  { name: 'Эликсир Гения', description: 'Мгновенно повышает уровень на 1.', rarity: 'legendary', icon: '🌟', effect_type: 'level_up', effect_value: 1, effect: 'level_up', duration_hours: 0, max_charges: 1, drop_rate: 0.005, stackable: false, is_shopable: false, min_level: 30, artifact_type: 'consumable' },
  { name: 'Кольцо Всевластия', description: 'Весь класс +10% XP. 7 дней.', rarity: 'legendary', icon: '💍', effect_type: 'class_xp_boost', effect_value: 10, effect: 'xp_boost', duration_hours: 168, max_charges: 0, drop_rate: 0.003, stackable: false, is_shopable: false, min_level: 32, artifact_type: 'passive' },
  { name: 'Свиток Истины', description: '+300% XP с одного Босса. Заряд: 1 битва.', rarity: 'legendary', icon: '📜', effect_type: 'xp_boss_boost', effect_value: 300, effect: 'xp_boost', duration_hours: 0, max_charges: 1, drop_rate: 0.003, stackable: false, is_shopable: false, min_level: 35, artifact_type: 'passive' },
  { name: 'Звезда Академии', description: 'Иммунитет к потере стрика. 30 дней.', rarity: 'legendary', icon: '⭐', effect_type: 'streak_immune', effect_value: 1, effect: 'streak_protect', duration_hours: 720, max_charges: 0, drop_rate: 0.002, stackable: false, is_shopable: false, min_level: 40, artifact_type: 'passive' },

  // ═══════ 👑 ROYAL SET (5) ═══════
  { name: 'Мантия Прогульщика', description: 'Часть Королевского сета. Сама по себе бесполезна.', rarity: 'legendary', icon: '🧙', effect_type: 'royal_set', effect_value: 0, effect: 'royal_set_1', duration_hours: 0, max_charges: 0, drop_rate: 0.001, stackable: false, is_shopable: false, min_level: 1, artifact_type: 'passive' },
  { name: 'Скипетр Отгула', description: 'Часть Королевского сета. Сама по себе бесполезна.', rarity: 'legendary', icon: '🏒', effect_type: 'royal_set', effect_value: 0, effect: 'royal_set_2', duration_hours: 0, max_charges: 0, drop_rate: 0.001, stackable: false, is_shopable: false, min_level: 1, artifact_type: 'passive' },
  { name: 'Держава Лени', description: 'Часть Королевского сета. Сама по себе бесполезна.', rarity: 'legendary', icon: '🌐', effect_type: 'royal_set', effect_value: 0, effect: 'royal_set_3', duration_hours: 0, max_charges: 0, drop_rate: 0.001, stackable: false, is_shopable: false, min_level: 1, artifact_type: 'passive' },
  { name: 'Корона Свободы', description: 'Часть Королевского сета. Сама по себе бесполезна.', rarity: 'legendary', icon: '👑', effect_type: 'royal_set', effect_value: 0, effect: 'royal_set_4', duration_hours: 0, max_charges: 0, drop_rate: 0.001, stackable: false, is_shopable: false, min_level: 1, artifact_type: 'passive' },
  { name: 'Печать Директора', description: 'Часть Королевского сета. Сама по себе бесполезна.', rarity: 'legendary', icon: '🔏', effect_type: 'royal_set', effect_value: 0, effect: 'royal_set_5', duration_hours: 0, max_charges: 0, drop_rate: 0.001, stackable: false, is_shopable: false, min_level: 1, artifact_type: 'passive' },
];

export async function POST() {
  try {

    // Upsert all artifacts by name (so re-running is safe)
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const art of ARTIFACTS) {
      // Check if exists by name
      const { data: existing } = await admin.from('artifacts').select('id').eq('name', art.name).single();
      
      // Map effect_type to valid enum values in DB: xp_boost, damage_reduce, gold_bonus, streak_protect
      const EFFECT_TYPE_MAP: Record<string, string> = {
        'hp_restore': 'damage_reduce',
        'xp_boost': 'xp_boost',
        'dmg_reduce': 'damage_reduce',
        'gold_boost': 'gold_bonus',
        'gold_flat': 'gold_bonus',
        'combo_boost': 'xp_boost',
        'dmg_flat_reduce': 'damage_reduce',
        'streak_protect': 'streak_protect',
        'xp_instant': 'xp_boost',
        'dmg_dodge': 'damage_reduce',
        'xp_boost_live': 'xp_boost',
        'crit_shield': 'damage_reduce',
        'skip_quest': 'streak_protect',
        'death_save': 'damage_reduce',
        'undo_crit': 'damage_reduce',
        'level_up': 'xp_boost',
        'class_xp_boost': 'xp_boost',
        'xp_boss_boost': 'xp_boost',
        'xp_boss_bonus': 'xp_boost',
        'streak_immune': 'streak_protect',
        'dmg_immune': 'damage_reduce',
        'royal_set': 'xp_boost',
        'lootbox': 'xp_boost',
      };

      const record = {
        name: art.name,
        description: art.description,
        rarity: art.rarity,
        icon: art.icon,
        effect_type: EFFECT_TYPE_MAP[art.effect_type] ?? 'xp_boost',
        effect_value: art.effect_value,
        effect: art.effect,
        duration_hours: art.duration_hours,
        max_charges: art.max_charges,
        drop_rate: art.drop_rate,
        stackable: art.stackable,
        is_shopable: art.is_shopable,
        min_level: art.min_level,
        artifact_type: art.artifact_type,
      };

      if (existing) {
        const { error } = await admin.from('artifacts').update(record).eq('id', existing.id);
        if (error) errors.push(`Update ${art.name}: ${error.message}`);
        else updated++;
      } else {
        const { error } = await admin.from('artifacts').insert(record);
        if (error) errors.push(`Insert ${art.name}: ${error.message}`);
        else inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      total: ARTIFACTS.length,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      note: errors.length > 0 
        ? 'Некоторые артефакты не записались. Возможно нужно добавить колонки effect, min_level, artifact_type в таблицу artifacts. Выполните SQL ниже в Supabase SQL Editor.'
        : 'Все 45 артефактов загружены!',
      sql_if_needed: `
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS effect text DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS min_level integer DEFAULT 1;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS artifact_type text DEFAULT 'passive';
      `.trim(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
