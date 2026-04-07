import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ARTIFACTS = [
  { name: 'Свиток Мудрости',    description: 'XP +50% на 24 часа',                   rarity: 'common',    icon: '📜', effect_type: 'xp_boost',       effect_value: 50,  duration_hours: 24, drop_rate: 0.25, req_level: 1,  stackable: false, max_charges: 3, is_shopable: true  },
  { name: 'Амулет Стойкости',   description: 'Защищает стрик один раз',               rarity: 'common',    icon: '📿', effect_type: 'streak_protect', effect_value: 1,   duration_hours: 0,  drop_rate: 0.20, req_level: 1,  stackable: false, max_charges: 1, is_shopable: true  },
  { name: 'Щит Мудреца',        description: '-30% урон от ошибок',                   rarity: 'rare',      icon: '🛡️', effect_type: 'damage_reduce',  effect_value: 30,  duration_hours: 0,  drop_rate: 0.10, req_level: 3,  stackable: false, max_charges: 5, is_shopable: true  },
  { name: 'Монета Мидаса',      description: 'x2 Gold за следующий квест',            rarity: 'rare',      icon: '🪙', effect_type: 'gold_bonus',     effect_value: 100, duration_hours: 0,  drop_rate: 0.08, req_level: 5,  stackable: false, max_charges: 1, is_shopable: false },
  { name: 'Свиток Пропуска',    description: 'Пропустить задание без HP урона',       rarity: 'common',    icon: '📃', effect_type: 'skip_day',       effect_value: 1,   duration_hours: 0,  drop_rate: 0.15, req_level: 1,  stackable: false, max_charges: 1, is_shopable: true  },
  { name: 'Перо Феникса',       description: 'Полная защита HP на 1 бой',             rarity: 'epic',      icon: '🦜', effect_type: 'hp_shield',      effect_value: 100, duration_hours: 0,  drop_rate: 0.04, req_level: 7,  stackable: false, max_charges: 1, is_shopable: false },
  { name: 'Кристалл XP',        description: '+25% XP пока экипирован',              rarity: 'epic',      icon: '💎', effect_type: 'xp_boost',       effect_value: 25,  duration_hours: 0,  drop_rate: 0.03, req_level: 10, stackable: true,  max_charges: 0, is_shopable: false },
  { name: 'Кольцо Золота',      description: '+20% Gold пока экипирован',             rarity: 'rare',      icon: '💍', effect_type: 'gold_bonus',     effect_value: 20,  duration_hours: 0,  drop_rate: 0.06, req_level: 5,  stackable: true,  max_charges: 0, is_shopable: false },
  { name: 'Эликсир Жизни',     description: 'Вернуть 50 HP прямо сейчас',           rarity: 'common',    icon: '🧪', effect_type: 'hp_shield',      effect_value: 50,  duration_hours: 0,  drop_rate: 0.18, req_level: 1,  stackable: false, max_charges: 1, is_shopable: true  },
  { name: 'Талисман Дракона',   description: 'x1.5 XP на 48 часов',                  rarity: 'legendary', icon: '🐉', effect_type: 'xp_boost',       effect_value: 50,  duration_hours: 48, drop_rate: 0.01, req_level: 15, stackable: false, max_charges: 3, is_shopable: false },
  { name: 'Руна Гнева',         description: '-20% урон и +10% XP навсегда',          rarity: 'legendary', icon: '⚡', effect_type: 'damage_reduce',  effect_value: 20,  duration_hours: 0,  drop_rate: 0.01, req_level: 20, stackable: false, max_charges: 0, is_shopable: false },
  { name: 'Книга Знаний',       description: '+15% XP за все правильные ответы',      rarity: 'epic',      icon: '📚', effect_type: 'xp_boost',       effect_value: 15,  duration_hours: 0,  drop_rate: 0.03, req_level: 8,  stackable: true,  max_charges: 0, is_shopable: false },
];

const ACHIEVEMENTS = [
  { name: 'Первые шаги',      description: 'Выполни 1 квест',             icon: '👣', condition_type: 'quests_completed', condition_value: 1,   xp_reward: 50,  gold_reward: 10  },
  { name: 'Неутомимый',       description: 'Выполни 10 квестов',          icon: '⚔️', condition_type: 'quests_completed', condition_value: 10,  xp_reward: 200, gold_reward: 50  },
  { name: 'Легенда',          description: 'Выполни 50 квестов',          icon: '🏆', condition_type: 'quests_completed', condition_value: 50,  xp_reward: 1000,gold_reward: 200 },
  { name: 'Огонь не гаснет',  description: 'Стрик 3 дня подряд',          icon: '🔥', condition_type: 'streak_days',      condition_value: 3,   xp_reward: 30,  gold_reward: 20  },
  { name: 'Неделя силы',      description: 'Стрик 7 дней подряд',         icon: '💥', condition_type: 'streak_days',      condition_value: 7,   xp_reward: 100, gold_reward: 50  },
  { name: 'Месяц героя',      description: 'Стрик 30 дней подряд',        icon: '👑', condition_type: 'streak_days',      condition_value: 30,  xp_reward: 500, gold_reward: 200 },
  { name: 'Босс повержен!',   description: 'Победи первого босса',         icon: '🐉', condition_type: 'bosses_defeated',  condition_value: 1,   xp_reward: 300, gold_reward: 100 },
  { name: 'Охотник на боссов',description: 'Победи 5 боссов',             icon: '⚡', condition_type: 'bosses_defeated',  condition_value: 5,   xp_reward: 800, gold_reward: 250 },
  { name: 'Богач',            description: 'Накопи 1000 золота',          icon: '💰', condition_type: 'gold_total',       condition_value: 1000,xp_reward: 100, gold_reward: 0   },
  { name: 'Коллекционер',     description: 'Получи 5 артефактов',         icon: '💎', condition_type: 'artifacts_owned',  condition_value: 5,   xp_reward: 150, gold_reward: 50  },
];

const STREAK_REWARDS = [
  { day_threshold: 3,  xp_bonus: 30,  gold_bonus: 20,  description: '3-дневный стрик: небольшой бонус' },
  { day_threshold: 7,  xp_bonus: 100, gold_bonus: 50,  description: '7-дневный стрик: недельный рекорд!' },
  { day_threshold: 14, xp_bonus: 250, gold_bonus: 100, description: '14 дней: две недели без остановки!' },
  { day_threshold: 30, xp_bonus: 700, gold_bonus: 300, description: '30 дней: Легенда месяца!' },
];

async function main() {
  console.log('\n═══ SEED ARTIFACTS, ACHIEVEMENTS, STREAK REWARDS ═══\n');

  // Check existing
  const { data: existingArts } = await supabase.from('artifacts').select('id').limit(1);
  if (existingArts && existingArts.length > 0) {
    console.log('ℹ️  Artifacts already seeded, skipping.');
  } else {
    const { error } = await supabase.from('artifacts').insert(ARTIFACTS);
    if (error) console.error('❌ Artifacts:', error.message);
    else console.log(`✅ Seeded ${ARTIFACTS.length} artifacts`);
  }

  const { data: existingAch } = await supabase.from('achievements').select('id').limit(1);
  if (existingAch && existingAch.length > 0) {
    console.log('ℹ️  Achievements already seeded, skipping.');
  } else {
    const { error } = await supabase.from('achievements').insert(ACHIEVEMENTS);
    if (error) console.error('❌ Achievements:', error.message);
    else console.log(`✅ Seeded ${ACHIEVEMENTS.length} achievements`);
  }

  const { data: existingSR } = await supabase.from('streak_rewards').select('id').limit(1);
  if (existingSR && existingSR.length > 0) {
    console.log('ℹ️  Streak rewards already seeded, skipping.');
  } else {
    const { error } = await supabase.from('streak_rewards').insert(STREAK_REWARDS);
    if (error) console.error('❌ Streak rewards:', error.message);
    else console.log(`✅ Seeded ${STREAK_REWARDS.length} streak rewards`);
  }

  // Add 3 artifacts to student's hero inventory
  const { data: studentHero } = await supabase
    .from('heroes')
    .select('id')
    .eq('user_id', (await supabase.from('users').select('id').eq('role', 'student').order('created_at').limit(1).single()).data?.id)
    .single();

  if (studentHero) {
    const { data: arts } = await supabase.from('artifacts').select('id').limit(3);
    if (arts) {
      for (const a of arts) {
        const { error } = await supabase.from('hero_artifacts').upsert({
          hero_id: studentHero.id,
          artifact_id: a.id,
          quantity: 2,
          charges_remaining: 2,
          is_equipped: false,
          source: 'reward',
        }, { onConflict: 'hero_id,artifact_id' });
        if (error) console.warn('  ⚠️ hero_artifact:', error.message);
      }
      console.log('✅ Added 3 artifacts to student inventory');
    }
  }

  console.log('\n═══════════════════════════════════════\n');
}

main();
