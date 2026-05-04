import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { allDbRows } from '../src/lib/game/artifact-registry';

const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { 
      const [k, ...v] = l.split('='); 
      return [k.trim(), v.join('=').trim()]; 
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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

// Альфа-тест 4–25 мая 2026: пороги 3/6/10/14 (математика только Пн/Ср/Чт/Пт).
// После альфы откатим к стандартам 3/7/14/30.
const STREAK_REWARDS = [
  { day_threshold: 3,  xp_bonus: 150,  gold_bonus: 50,  description: '3 дня: «поймал ритм» — Common Lootbox' },
  { day_threshold: 6,  xp_bonus: 300,  gold_bonus: 150, description: '6 дней: половина теста — Rare Lootbox' },
  { day_threshold: 10, xp_bonus: 600,  gold_bonus: 300, description: '10 дней: почти весь тест — Epic Lootbox' },
  { day_threshold: 14, xp_bonus: 1000, gold_bonus: 500, description: '14 дней: идеальная серия — Legendary Lootbox' },
];

async function main() {
  console.log('\n═══ SEED ARTIFACTS (V2), ACHIEVEMENTS, STREAK REWARDS ═══\n');

  // Load ARTIFACTS dynamically from the SINGLE SOURCE OF TRUTH (artifact-registry.ts)
  const registryRows = allDbRows();
  console.log(`ℹ️  Found ${registryRows.length} artifacts in the unified registry.`);

  // Upsert artifacts (no deletion to avoid ON DELETE CASCADE destroying user inventories)
  console.log('🧹 Preparing to upsert artifacts configuration (Cascade safe)...');
  
  console.log('📥 Sowing seeds of magic...');
  const { error: artsError } = await supabase.from('artifacts').upsert(registryRows, { onConflict: 'name' });
  if (artsError) {
    console.error('❌ Artifacts DB Insert Error:', artsError.message);
  } else {
    console.log(`✅ Seeded (upserted) ${registryRows.length} artifacts from registry.`);
  }

  // Check achievements
  const { data: existingAch } = await supabase.from('achievements').select('id').limit(1);
  if (existingAch && existingAch.length > 0) {
    console.log('ℹ️  Achievements already seeded, skipping.');
  } else {
    const { error } = await supabase.from('achievements').insert(ACHIEVEMENTS);
    if (error) console.error('❌ Achievements:', error.message);
    else console.log(`✅ Seeded ${ACHIEVEMENTS.length} achievements`);
  }

  // Check streak
  const { data: existingSR } = await supabase.from('streak_rewards').select('id').limit(1);
  if (existingSR && existingSR.length > 0) {
    console.log('ℹ️  Streak rewards already seeded, skipping.');
  } else {
    const { error } = await supabase.from('streak_rewards').insert(STREAK_REWARDS);
    if (error) console.error('❌ Streak rewards:', error.message);
    else console.log(`✅ Seeded ${STREAK_REWARDS.length} streak rewards`);
  }

  // Add 3 random common artifacts to a random physical student's inventory
  const { data: studentHero } = await supabase
    .from('heroes')
    .select('id')
    .eq('user_id', (await supabase.from('users').select('id').eq('role', 'student').order('created_at').limit(1).single()).data?.id)
    .single();

  if (studentHero) {
    const { data: arts } = await supabase.from('artifacts').select('id').eq('rarity', 'common').limit(3);
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
        if (error) console.warn('  ⚠️ hero_artifact upsert failed:', error.message);
      }
      console.log('✅ Added 3 common artifacts to first student inventory');
    }
  }

  console.log('\n═══════════════════════════════════════\n');
}

main();
