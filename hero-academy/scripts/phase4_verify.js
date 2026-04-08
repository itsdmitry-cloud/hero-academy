const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1. Verify season_leaderboards exists
  console.log('=== TEST 1: season_leaderboards table ===');
  const { data: sl, error: slErr } = await c.from('season_leaderboards').select('*').limit(1);
  if (slErr) console.log('FAIL:', slErr.message);
  else console.log('OK: table exists, rows:', sl.length);

  // 2. Verify economy_config cleaned
  console.log('\n=== TEST 2: economy_config (no old rows) ===');
  const { data: eco } = await c.from('economy_config').select('key');
  const keys = eco.map(r => r.key);
  const oldKeys = ['xp_per_quest_easy', 'boss_reward_xp'];
  const hasOld = oldKeys.some(k => keys.includes(k));
  console.log(hasOld ? 'FAIL: old rows still exist' : 'OK: only scoped rows remain (' + keys.length + ')');

  // 3. Verify seasons is_active fixed
  console.log('\n=== TEST 3: upcoming seasons is_active ===');
  const { data: ups } = await c.from('seasons').select('id,status,is_active').eq('status', 'upcoming');
  const badOnes = (ups || []).filter(s => s.is_active === true);
  console.log(badOnes.length === 0 ? 'OK: no upcoming with is_active=true' : 'FAIL: ' + badOnes.length + ' upcoming still active');

  // 4. Verify active season exists
  console.log('\n=== TEST 4: active season ===');
  const { data: act } = await c.from('seasons').select('id,name,status').eq('status', 'active');
  console.log(act && act.length > 0 ? 'OK: active season: ' + act[0].name : 'FAIL: no active season');

  // 5. Verify subject_bosses have data
  console.log('\n=== TEST 5: subject_bosses ===');
  const { data: sb } = await c.from('subject_bosses').select('id,subject_id,current_hp,is_defeated');
  console.log('OK:', sb.length, 'bosses total,', sb.filter(b => !b.is_defeated).length, 'alive');

  // 6. Check boss_damage_logs recent
  console.log('\n=== TEST 6: recent boss damage ===');
  const { data: bl } = await c.from('boss_damage_logs').select('id').order('created_at', { ascending: false }).limit(5);
  console.log('OK:', bl.length, 'recent damage logs');

  // 7. Check quest_attempts table accessible
  console.log('\n=== TEST 7: quest_attempts ===');
  const { data: qa, error: qaE } = await c.from('quest_attempts').select('id').limit(1);
  console.log(qaE ? 'FAIL: ' + qaE.message : 'OK: table accessible, rows: ' + qa.length);

  // 8. Check streak_rewards table accessible
  console.log('\n=== TEST 8: streak_rewards ===');
  const { data: sr, error: srE } = await c.from('streak_rewards').select('id').limit(1);
  console.log(srE ? 'FAIL: ' + srE.message : 'OK: table accessible, rows: ' + sr.length);

  // 9. Test: insert + delete from season_leaderboards
  console.log('\n=== TEST 9: season_leaderboards write test ===');
  const { data: actSeason } = await c.from('seasons').select('id').eq('status', 'active').limit(1).single();
  const { data: testHero } = await c.from('heroes').select('id, user_id').limit(1).single();
  if (actSeason && testHero) {
    const { data: ins, error: insErr } = await c.from('season_leaderboards').insert({
      season_id: actSeason.id, hero_id: testHero.id, user_id: testHero.user_id,
      hero_name: '__test__', rank: 999, xp: 0, level: 1, gold: 0
    }).select('id').single();
    if (insErr) {
      console.log('FAIL:', insErr.message);
    } else {
      console.log('OK: inserted test row, deleting...');
      await c.from('season_leaderboards').delete().eq('id', ins.id);
      console.log('OK: cleanup done');
    }
  } else {
    console.log('SKIP: no active season or hero to test');
  }
})();
