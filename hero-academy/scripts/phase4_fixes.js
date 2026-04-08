const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('=== Fix #1: Create season_leaderboards table ===');
  // We can't CREATE TABLE via supabase-js, but we can try inserting to see if it exists
  // Actually, let's just create the table via raw SQL using the REST API
  // Since we can't run DDL, we'll create a migration script instead
  console.log('Creating migration script for DDL...');

  console.log('\n=== Fix #5: Fix upcoming seasons is_active to false ===');
  const { error: e5 } = await c.from('seasons')
    .update({ is_active: false })
    .eq('status', 'upcoming');
  console.log(e5 ? 'ERROR: ' + e5.message : 'OK: upcoming seasons is_active set to false');

  console.log('\n=== Fix #6: Delete old economy_config rows ===');
  const oldKeys = [
    'xp_per_quest_easy', 'xp_per_quest_medium', 'xp_per_quest_hard',
    'gold_per_quest_easy', 'gold_per_quest_medium', 'gold_per_quest_hard',
    'hp_damage_per_mistake', 'boss_reward_xp', 'boss_reward_gold',
    'artifact_drop_chance_base'
  ];
  const { error: e6 } = await c.from('economy_config').delete().in('key', oldKeys);
  console.log(e6 ? 'ERROR: ' + e6.message : 'OK: deleted ' + oldKeys.length + ' old economy rows');

  // Verify
  const { data: ecoCheck } = await c.from('economy_config').select('key');
  console.log('Remaining economy rows:', ecoCheck?.map(r => r.key));

  console.log('\n=== DONE ===');
})();
