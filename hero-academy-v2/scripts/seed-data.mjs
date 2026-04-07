import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjezmurskhjngbostltn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZXptdXJza2hqbmdib3N0bHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDY3MzgsImV4cCI6MjA4ODkyMjczOH0.4XePdTHnE1CWvlWBWI4jaNnd5_9USyryD5n58D3dDUw'
);

// First clean up any bad data from failed attempts
async function cleanUp() {
  await supabase.from('economy_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('shop_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('streak_rewards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('achievements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('artifacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('🧹 Cleaned up existing data');
}

// Seed artifacts
async function seedArtifacts() {
  const { error } = await supabase.from('artifacts').insert([
    { name: 'Зелье опыта', description: 'Увеличивает XP на 50% на 24 часа', rarity: 'common', icon: '/assets/artifacts/xp_potion.png', effect_type: 'xp_boost', effect_value: 50, duration_hours: 24, drop_rate: 0.15, stackable: true, max_charges: 3, is_shopable: true },
    { name: 'Щит стража', description: 'Блокирует 1 урон от ошибки', rarity: 'rare', icon: '/assets/artifacts/shield.png', effect_type: 'hp_shield', effect_value: 1, duration_hours: 0, drop_rate: 0.08, stackable: false, max_charges: 1, is_shopable: true },
    { name: 'Мешок золота', description: '+100 Gold мгновенно', rarity: 'common', icon: '/assets/artifacts/gold_pouch.png', effect_type: 'gold_bonus', effect_value: 100, duration_hours: 0, drop_rate: 0.12, stackable: true, max_charges: 1, is_shopable: true },
    { name: 'Свеча Полуночника', description: 'Защищает стрик на 1 день', rarity: 'rare', icon: '/assets/artifacts/candle.png', effect_type: 'streak_protect', effect_value: 1, duration_hours: 0, drop_rate: 0.06, stackable: false, max_charges: 1, is_shopable: true },
    { name: 'Перо мудрости', description: 'Снижает урон от ошибок на 50% на 24 часа', rarity: 'epic', icon: '/assets/artifacts/quill.png', effect_type: 'damage_reduce', effect_value: 50, duration_hours: 24, drop_rate: 0.04, stackable: false, max_charges: 1, is_shopable: true },
    { name: 'Корона героя', description: 'XP ×2 на 48 часов', rarity: 'legendary', icon: '/assets/artifacts/crown.png', effect_type: 'xp_boost', effect_value: 100, duration_hours: 48, drop_rate: 0.01, stackable: false, max_charges: 1, is_shopable: false },
    { name: 'Малое зелье HP', description: 'Восстанавливает 25 HP', rarity: 'common', icon: '/assets/artifacts/hp_potion_small.png', effect_type: 'hp_shield', effect_value: 25, duration_hours: 0, drop_rate: 0.2, stackable: true, max_charges: 1, is_shopable: true },
    { name: 'Большое зелье HP', description: 'Восстанавливает 50 HP', rarity: 'rare', icon: '/assets/artifacts/hp_potion_large.png', effect_type: 'hp_shield', effect_value: 50, duration_hours: 0, drop_rate: 0.08, stackable: true, max_charges: 1, is_shopable: true },
  ]);
  if (error) console.error('❌ Artifacts:', error.message);
  else console.log('✅ 8 артефактов добавлены');
}

// Seed achievements
async function seedAchievements() {
  const { error } = await supabase.from('achievements').insert([
    { name: 'Первый квест', description: 'Выполни первый квест', icon: '⭐', condition_type: 'quests_completed', condition_value: 1, xp_reward: 50, gold_reward: 10 },
    { name: 'Марафонец', description: 'Выполни 10 квестов', icon: '🏃', condition_type: 'quests_completed', condition_value: 10, xp_reward: 200, gold_reward: 50 },
    { name: 'Мастер', description: 'Выполни 50 квестов', icon: '🏅', condition_type: 'quests_completed', condition_value: 50, xp_reward: 500, gold_reward: 100 },
    { name: 'Огонёк', description: 'Стрик 3 дня', icon: '🔥', condition_type: 'streak_days', condition_value: 3, xp_reward: 100, gold_reward: 20 },
    { name: 'Пламя', description: 'Стрик 7 дней', icon: '🔥', condition_type: 'streak_days', condition_value: 7, xp_reward: 250, gold_reward: 50 },
    { name: 'Инферно', description: 'Стрик 14 дней', icon: '💙', condition_type: 'streak_days', condition_value: 14, xp_reward: 500, gold_reward: 100 },
    { name: 'Истребитель', description: 'Победи 1 босса', icon: '🐉', condition_type: 'bosses_killed', condition_value: 1, xp_reward: 200, gold_reward: 50 },
    { name: 'Коллекционер', description: 'Собери 10 артефактов', icon: '💎', condition_type: 'artifacts_collected', condition_value: 10, xp_reward: 300, gold_reward: 75 },
  ]);
  if (error) console.error('❌ Achievements:', error.message);
  else console.log('✅ 8 достижений добавлены');
}

// Seed streak rewards
async function seedStreakRewards() {
  const { error } = await supabase.from('streak_rewards').insert([
    { day_threshold: 3, xp_bonus: 100, gold_bonus: 20, description: '+100 XP, +20 Gold' },
    { day_threshold: 7, xp_bonus: 250, gold_bonus: 50, description: '+250 XP, +50 Gold' },
    { day_threshold: 14, xp_bonus: 500, gold_bonus: 100, description: '+500 XP, +100 Gold' },
    { day_threshold: 30, xp_bonus: 1000, gold_bonus: 250, description: '+1000 XP, +250 Gold' },
  ]);
  if (error) console.error('❌ Streak rewards:', error.message);
  else console.log('✅ 4 стрик-награды добавлены');
}

// Seed shop items
async function seedShopItems() {
  const { error } = await supabase.from('shop_items').insert([
    { name: 'Малое зелье HP', description: 'Восстанавливает 25 HP', category: 'hp_potion', price_gold: 50, icon: '❤️‍🩹', effect_value: 25, is_available: true },
    { name: 'Большое зелье HP', description: 'Восстанавливает 50 HP', category: 'hp_potion', price_gold: 100, icon: '❤️', effect_value: 50, is_available: true },
    { name: 'Полное восстановление', description: 'HP до максимума', category: 'hp_potion', price_gold: 250, icon: '💖', effect_value: 100, is_available: true },
    { name: 'Свиток опыта', description: '+50% XP на 24 часа', category: 'xp_boost', price_gold: 150, icon: '📜', effect_value: 50, is_available: true },
    { name: 'Щит стража', description: 'Блокирует 1 урон', category: 'artifact', price_gold: 200, icon: '🛡️', effect_value: 1, is_available: true },
    { name: 'Свеча Полуночника', description: 'Защита стрика на 1 день', category: 'artifact', price_gold: 150, icon: '🕯️', effect_value: 1, is_available: true },
  ]);
  if (error) console.error('❌ Shop items:', error.message);
  else console.log('✅ 6 товаров магазина добавлены');
}

// Seed economy config
async function seedEconomyConfig() {
  const { error } = await supabase.from('economy_config').insert([
    { key: 'xp_per_quest_easy', value: { value: 100 } },
    { key: 'xp_per_quest_medium', value: { value: 150 } },
    { key: 'xp_per_quest_hard', value: { value: 250 } },
    { key: 'gold_per_quest_easy', value: { value: 10 } },
    { key: 'gold_per_quest_medium', value: { value: 20 } },
    { key: 'gold_per_quest_hard', value: { value: 40 } },
    { key: 'hp_damage_per_mistake', value: { value: 10 } },
    { key: 'boss_reward_xp', value: { value: 300 } },
    { key: 'boss_reward_gold', value: { value: 50 } },
    { key: 'artifact_drop_chance_base', value: { value: 0.1 } },
  ]);
  if (error) console.error('❌ Economy config:', error.message);
  else console.log('✅ 10 настроек экономики добавлены');
}

async function main() {
  console.log('🏰 Hero Academy — Seeding Data\n');
  await cleanUp();
  await seedArtifacts();
  await seedAchievements();
  await seedStreakRewards();
  await seedShopItems();
  await seedEconomyConfig();
  console.log('\n🎉 Seed data complete!');
}

main();
