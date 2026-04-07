const { createClient } = require('@supabase/supabase-js');
const c = createClient('https://gjezmurskhjngbostltn.supabase.co', 'REMOVED_SECRET');

(async () => {
  const tables = [
    'heroes', 'users', 'artifacts', 'hero_artifacts', 'activity_log',
    'quests', 'quest_attempts', 'seasons', 'classes', 'schools',
    'subject_bosses', 'boss_damage_logs', 'boss_events', 'boss_participants',
    'streak_rewards', 'season_leaderboards', 'economy_config', 'shop_items'
  ];

  for (const t of tables) {
    const { data: row, error: e } = await c.from(t).select('*').limit(1).maybeSingle();
    if (e) { console.log(t + ': ERROR - ' + e.message); continue; }
    if (!row) { console.log(t + ': EMPTY (columns unknown)'); continue; }
    console.log(t + ': ' + Object.keys(row).join(', '));
  }

  // Also check actual effect values in artifacts
  console.log('\n=== DISTINCT EFFECT values in artifacts ===');
  const { data: effects } = await c.from('artifacts').select('effect').order('effect');
  if (effects) {
    const unique = [...new Set(effects.map(e => e.effect))];
    console.log(unique.join(', '));
  }

  // Check distinct actions in activity_log
  console.log('\n=== DISTINCT ACTION values in activity_log ===');
  const { data: actions } = await c.from('activity_log').select('action').limit(1000);
  if (actions) {
    const unique = [...new Set(actions.map(a => a.action))];
    console.log(unique.join(', '));
  }

  // Check hero_artifacts sources
  console.log('\n=== DISTINCT SOURCE values in hero_artifacts ===');
  const { data: sources } = await c.from('hero_artifacts').select('source');
  if (sources) {
    const unique = [...new Set(sources.map(s => s.source))];
    console.log(unique.join(', '));
  }
})();
