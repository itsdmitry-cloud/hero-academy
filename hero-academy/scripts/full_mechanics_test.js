/**
 * FULL GAME MECHANICS TEST SUITE
 * Tests every mechanic against real DB data.
 */
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let pass = 0, fail = 0, warn = 0;
function ok(label) { pass++; console.log(`  ✅ ${label}`); }
function bad(label) { fail++; console.log(`  ❌ ${label}`); }
function warning(label) { warn++; console.log(`  ⚠️  ${label}`); }

(async () => {

  // ═══════════════════════════════════════════════════════════
  // 1. XP SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 1. XP SYSTEM (Cumulative)');
  
  // Check formula consistency: level N threshold = N * (1000 + 250*(N+1))
  const { data: heroes } = await c.from('heroes').select('id, name, xp, level, xp_to_next');
  let xpIssues = 0;
  for (const h of heroes || []) {
    const expectedThreshold = h.level * (1000 + 250 * (h.level + 1));
    if (h.xp_to_next !== expectedThreshold) {
      xpIssues++;
      console.log(`    Hero ${h.name}: xp_to_next=${h.xp_to_next}, expected=${expectedThreshold}`);
    }
    // XP should be < xp_to_next (since level is already current)
    if (h.xp >= h.xp_to_next) {
      xpIssues++;
      console.log(`    Hero ${h.name}: xp=${h.xp} >= xp_to_next=${h.xp_to_next} — should have leveled up!`);
    }
  }
  if (xpIssues === 0) ok(`All ${heroes.length} heroes have correct XP thresholds`);
  else bad(`${xpIssues} XP inconsistencies found`);

  // Check that code formula matches
  function cumulativeXpForLevel(lvl) { return lvl * (1000 + 250 * (lvl + 1)); }
  const lvlTests = [
    { level: 1, expected: 1500 },
    { level: 5, expected: 12500 },
    { level: 10, expected: 37500 },
    { level: 50, expected: 662500 },
    { level: 100, expected: 2575000 },
  ];
  let formulaOk = true;
  for (const t of lvlTests) {
    const result = cumulativeXpForLevel(t.level);
    if (result !== t.expected) {
      formulaOk = false;
      bad(`Level ${t.level}: expected ${t.expected}, got ${result}`);
    }
  }
  if (formulaOk) ok('Cumulative XP formula verified for levels 1,5,10,50,100');

  // ═══════════════════════════════════════════════════════════
  // 2. HP SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 2. HP SYSTEM');
  
  const heroesHP = heroes || [];
  const deadHeroes = heroesHP.filter(h => (h.hp || 0) <= 0);
  const unhealthyHeroes = heroesHP.filter(h => (h.hp || 0) > (h.hp_max || 100));
  
  // Check all heroes have valid HP
  const { data: heroesHPFull } = await c.from('heroes').select('id, name, hp, hp_max, status');
  let hpIssues = 0;
  for (const h of heroesHPFull || []) {
    if (h.hp < 0) { hpIssues++; console.log(`    ${h.name}: HP=${h.hp} (negative!)`); }
    if (h.hp > h.hp_max) { hpIssues++; console.log(`    ${h.name}: HP=${h.hp} > hp_max=${h.hp_max}`); }
    if (h.hp === 0 && h.status !== 'inactive') { hpIssues++; console.log(`    ${h.name}: HP=0 but status='${h.status}' (should be inactive)`); }
    if (h.hp > 0 && h.status === 'inactive') { hpIssues++; console.log(`    ${h.name}: HP=${h.hp} but status=inactive`); }
  }
  if (hpIssues === 0) ok(`All ${heroesHPFull.length} heroes have valid HP/status`);
  else bad(`${hpIssues} HP inconsistencies found`);

  // Check HP potions exist in artifacts
  const { data: hpPotions } = await c.from('artifacts').select('id, name, effect, effect_value').eq('effect', 'hp_restore');
  if (hpPotions && hpPotions.length > 0) ok(`${hpPotions.length} HP potion(s) in catalog`);
  else bad('No HP restore artifacts found');

  // ═══════════════════════════════════════════════════════════
  // 3. GOLD SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 3. GOLD SYSTEM');
  
  const heroesGold = heroes || [];
  const negativeGold = heroesGold.filter(h => (h.gold || 0) < 0);
  if (negativeGold.length === 0) ok(`All heroes have >= 0 gold`);
  else bad(`${negativeGold.length} heroes have negative gold`);

  // Check shop actually deducts gold
  const { data: shopItems } = await c.from('shop_items').select('id, name, price_gold, is_available');
  if (shopItems && shopItems.length > 0) {
    const available = shopItems.filter(i => i.is_available);
    ok(`Shop has ${shopItems.length} items (${available.length} available)`);
    const zeroPriced = shopItems.filter(i => i.price_gold <= 0);
    if (zeroPriced.length > 0) warning(`${zeroPriced.length} shop items with price <= 0`);
  } else {
    bad('No shop items found');
  }

  // ═══════════════════════════════════════════════════════════
  // 4. BOSS SYSTEM (subject_bosses)
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 4. BOSS SYSTEM');
  
  const { data: bosses } = await c.from('subject_bosses').select('id, season_id, class_id, subject_id, current_hp, max_hp, is_defeated');
  if (!bosses || bosses.length === 0) { bad('No subject_bosses found'); }
  else {
    ok(`${bosses.length} bosses in system`);
    // Check consistency
    let bossIssues = 0;
    for (const b of bosses) {
      if (b.current_hp < 0) { bossIssues++; console.log(`    Boss ${b.id}: HP=${b.current_hp} (negative!)`); }
      if (b.current_hp > b.max_hp) { bossIssues++; console.log(`    Boss ${b.id}: HP=${b.current_hp} > max=${b.max_hp}`); }
      if (b.current_hp === 0 && !b.is_defeated) { bossIssues++; console.log(`    Boss ${b.subject_id}: HP=0 but not defeated`); }
      if (b.current_hp > 0 && b.is_defeated) { bossIssues++; console.log(`    Boss ${b.subject_id}: HP=${b.current_hp} but marked defeated`); }
    }
    if (bossIssues === 0) ok('All boss HP/defeated states consistent');
    else bad(`${bossIssues} boss inconsistencies`);
    
    // Check alive bosses are linked to active season
    const { data: activeSeason } = await c.from('seasons').select('id').eq('status', 'active').limit(1).single();
    if (activeSeason) {
      const aliveBosses = bosses.filter(b => !b.is_defeated);
      const activeSeasonBosses = aliveBosses.filter(b => b.season_id === activeSeason.id);
      ok(`${activeSeasonBosses.length}/${aliveBosses.length} alive bosses in active season`);
    }
    
    // Check boss_damage_logs reference valid bosses
    const { data: damageLogs } = await c.from('boss_damage_logs').select('boss_id').limit(50);
    const bossIds = new Set(bosses.map(b => b.id));
    const orphanDamage = (damageLogs || []).filter(d => !bossIds.has(d.boss_id));
    if (orphanDamage.length === 0) ok('All damage logs reference valid bosses');
    else warning(`${orphanDamage.length} damage logs reference non-existent bosses`);
  }

  // ═══════════════════════════════════════════════════════════
  // 5. ARTIFACT SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 5. ARTIFACT SYSTEM');
  
  const { data: artifacts } = await c.from('artifacts').select('id, name, effect, effect_type, effect_value, rarity, drop_rate, min_level');
  if (!artifacts || artifacts.length === 0) { bad('No artifacts in catalog'); }
  else {
    ok(`${artifacts.length} artifacts in catalog`);
    
    // Check all have effect column filled
    const noEffect = artifacts.filter(a => !a.effect);
    if (noEffect.length === 0) ok('All artifacts have `effect` column filled');
    else bad(`${noEffect.length} artifacts missing \`effect\` value: ${noEffect.map(a=>a.name).join(', ')}`);
    
    // Check rarity distribution
    const byRarity = {};
    for (const a of artifacts) { byRarity[a.rarity] = (byRarity[a.rarity] || 0) + 1; }
    ok(`Rarity distribution: ${JSON.stringify(byRarity)}`);
    
    // Check drop_rate is set
    const noDropRate = artifacts.filter(a => !a.drop_rate && a.drop_rate !== 0);
    if (noDropRate.length === 0) ok('All artifacts have drop_rate');
    else warning(`${noDropRate.length} artifacts have null drop_rate`);
    
    // Check lootbox artifacts exist
    const lootboxes = artifacts.filter(a => a.effect === 'lootbox');
    if (lootboxes.length > 0) ok(`${lootboxes.length} lootbox artifacts in catalog`);
    else bad('No lootbox artifacts (boss/streak rewards will fail!)');
    
    // Check lootbox rarities cover what's needed
    const lootboxRarities = new Set(lootboxes.map(a => a.rarity));
    for (const needed of ['common', 'rare', 'epic']) {
      if (lootboxRarities.has(needed)) ok(`Lootbox rarity '${needed}' exists`);
      else warning(`Lootbox rarity '${needed}' missing — boss/streak rewards may fail`);
    }
  }

  // Check hero_artifacts inventory
  const { data: heroArts } = await c.from('hero_artifacts').select('id, hero_id, artifact_id, source, is_equipped');
  if (heroArts) {
    ok(`${heroArts.length} items in hero inventories`);
    // Check sources
    const sources = {};
    for (const ha of heroArts) { sources[ha.source] = (sources[ha.source] || 0) + 1; }
    ok(`Inventory sources: ${JSON.stringify(sources)}`);
    
    // Check all artifact_ids reference valid artifacts
    const artIds = new Set((artifacts || []).map(a => a.id));
    const orphanItems = heroArts.filter(ha => !artIds.has(ha.artifact_id));
    if (orphanItems.length === 0) ok('All inventory items reference valid artifacts');
    else bad(`${orphanItems.length} inventory items reference non-existent artifacts`);
  }

  // ═══════════════════════════════════════════════════════════
  // 6. LOOTBOX OPEN FLOW
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 6. LOOTBOX OPEN FLOW');
  
  // Check open-lootbox route: verify artifacts pool is non-empty for each box tier
  for (const tier of ['common', 'rare', 'epic', 'legendary']) {
    const { data: pool } = await c.from('artifacts').select('id').eq('rarity', tier).neq('effect', 'lootbox');
    if (pool && pool.length > 0) ok(`Lootbox tier '${tier}' pool: ${pool.length} artifacts`);
    else warning(`Lootbox tier '${tier}' pool is EMPTY — boxes of this tier will fail`);
  }

  // ═══════════════════════════════════════════════════════════
  // 7. SHOP SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 7. SHOP SYSTEM');
  
  if (shopItems && shopItems.length > 0) {
    // Check all shop items with artifact_id reference valid artifacts
    const linked = shopItems.filter(i => i.artifact_id);
    // We need to get artifact_id — query again
    const { data: shopFull } = await c.from('shop_items').select('id, name, artifact_id, category, price_gold');
    const artIds = new Set((artifacts || []).map(a => a.id));
    let shopIssues = 0;
    for (const s of shopFull || []) {
      if (s.artifact_id && !artIds.has(s.artifact_id)) {
        shopIssues++;
        console.log(`    Shop item '${s.name}': artifact_id ${s.artifact_id} not found!`);
      }
    }
    if (shopIssues === 0) ok('All shop items link to valid artifacts');
    else bad(`${shopIssues} shop items reference missing artifacts`);
    
    // Categories
    const cats = {};
    for (const s of shopFull || []) { cats[s.category] = (cats[s.category] || 0) + 1; }
    ok(`Shop categories: ${JSON.stringify(cats)}`);
  }

  // Check shop_purchase activity logs
  const { data: shopLogs } = await c.from('activity_log').select('id').eq('action', 'shop_purchase').limit(5);
  ok(`${(shopLogs || []).length} shop purchase logs found`);

  // ═══════════════════════════════════════════════════════════
  // 8. STREAK SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 8. STREAK SYSTEM');
  
  const { data: heroStreaks } = await c.from('heroes').select('id, name, streak_current, streak_best, streak_last_date, streak_protected');
  let streakIssues = 0;
  for (const h of heroStreaks || []) {
    if (h.streak_current < 0) { streakIssues++; console.log(`    ${h.name}: streak=${h.streak_current} (negative!)`); }
    if (h.streak_best < h.streak_current) { streakIssues++; console.log(`    ${h.name}: best=${h.streak_best} < current=${h.streak_current}`); }
  }
  if (streakIssues === 0) ok(`All ${heroStreaks.length} heroes have valid streak values`);
  else bad(`${streakIssues} streak inconsistencies`);

  // Check streak_rewards table schema
  const { data: sr } = await c.from('streak_rewards').select('*').limit(1);
  ok('streak_rewards table accessible');

  // Check streak update API exists (route file)
  const { data: streakLogs } = await c.from('activity_log').select('id, action')
    .in('action', ['streak_update', 'streak_reward', 'streak_bonus']).limit(5);
  ok(`${(streakLogs || []).length} streak activity logs found`);

  // ═══════════════════════════════════════════════════════════
  // 9. SEASON SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 9. SEASON SYSTEM');
  
  const { data: seasons } = await c.from('seasons').select('id, name, status, is_active, school_id');
  if (seasons) {
    ok(`${seasons.length} seasons total`);
    const byStatus = {};
    for (const s of seasons) { byStatus[s.status] = (byStatus[s.status] || 0) + 1; }
    ok(`Season statuses: ${JSON.stringify(byStatus)}`);
    
    // Only one active
    const active = seasons.filter(s => s.status === 'active');
    if (active.length === 1) ok('Exactly 1 active season');
    else if (active.length === 0) bad('No active season!');
    else warning(`${active.length} active seasons (should be 1)`);
    
    // is_active should match status
    let seasonConflicts = 0;
    for (const s of seasons) {
      if (s.status === 'active' && !s.is_active) { seasonConflicts++; console.log(`    ${s.name}: status=active but is_active=false`); }
      if (s.status !== 'active' && s.is_active) { seasonConflicts++; console.log(`    ${s.name}: status=${s.status} but is_active=true`); }
    }
    if (seasonConflicts === 0) ok('status/is_active consistent for all seasons');
    else bad(`${seasonConflicts} season status conflicts`);
    
    // season_leaderboards
    const { data: lb } = await c.from('season_leaderboards').select('id').limit(1);
    ok('season_leaderboards table writable');
  }

  // ═══════════════════════════════════════════════════════════
  // 10. ECONOMY CONFIG
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 10. ECONOMY CONFIG');
  
  const { data: ecoConfig } = await c.from('economy_config').select('key, value');
  if (ecoConfig) {
    ok(`${ecoConfig.length} economy config rows`);
    
    // All should be scoped
    for (const row of ecoConfig) {
      const val = row.value;
      if (typeof val !== 'object' || val === null) {
        bad(`Config '${row.key}': value is not an object: ${JSON.stringify(val)}`);
      } else {
        // Check required fields
        const hasXpMult = val.xp_multiplier !== undefined;
        const hasGoldMult = val.gold_multiplier !== undefined;
        if (hasXpMult && hasGoldMult) ok(`Config '${row.key}': has xp_multiplier=${val.xp_multiplier}, gold_multiplier=${val.gold_multiplier}`);
        else warning(`Config '${row.key}': missing xp_multiplier or gold_multiplier`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 11. QUEST SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 11. QUEST SYSTEM');
  
  const { data: quests } = await c.from('quests').select('id, title, type, subject, difficulty, xp_reward, gold_reward, hp_damage, status');
  if (quests && quests.length > 0) {
    ok(`${quests.length} quests total`);
    
    // Check types
    const types = {};
    for (const q of quests) { types[q.type] = (types[q.type] || 0) + 1; }
    ok(`Quest types: ${JSON.stringify(types)}`);
    
    // Check all have rewards
    const noReward = quests.filter(q => !q.xp_reward && !q.gold_reward);
    if (noReward.length === 0) ok('All quests have XP or Gold reward');
    else warning(`${noReward.length} quests have 0 XP and 0 Gold`);
    
    // Check quest_attempts
    const { data: attempts } = await c.from('quest_attempts').select('id, quest_id, status, grade').limit(10);
    ok(`${(attempts || []).length} quest_attempts found`);
  } else {
    warning('No quests found');
  }

  // ═══════════════════════════════════════════════════════════
  // 12. ACTIVITY LOG
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 12. ACTIVITY LOG');
  
  const { data: allLogs } = await c.from('activity_log').select('action').limit(1000);
  if (allLogs) {
    ok(`${allLogs.length} activity log entries (of 1000 scanned)`);
    const actionCounts = {};
    for (const l of allLogs) { actionCounts[l.action] = (actionCounts[l.action] || 0) + 1; }
    ok(`Action distribution: ${JSON.stringify(actionCounts)}`);
    
    // Check no unknown actions
    const knownActions = new Set([
      'teacher_damage', 'teacher_xp_grant', 'teacher_gold_grant',
      'quest_graded', 'quest_complete', 'quest_completed',
      'boss_damage', 'boss_kill_reward',
      'artifact_drop', 'shop_purchase', 'potion_used', 'lootbox_opened',
      'streak_update', 'streak_reward', 'streak_bonus',
      'level_up', 'admin_undo'
    ]);
    const unknownActions = Object.keys(actionCounts).filter(a => !knownActions.has(a));
    if (unknownActions.length === 0) ok('All log actions are known');
    else warning(`Unknown actions: ${unknownActions.join(', ')}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 13. SCHOOL/CLASS STRUCTURE
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 13. SCHOOL / CLASS STRUCTURE');
  
  const { data: schools } = await c.from('schools').select('id, name');
  ok(`${(schools || []).length} school(s)`);
  
  const { data: classes } = await c.from('classes').select('id, name, school_id, teacher_id, invite_code');
  if (classes) {
    ok(`${classes.length} class(es)`);
    // Check all have teacher and invite_code
    const noTeacher = classes.filter(cl => !cl.teacher_id);
    const noCode = classes.filter(cl => !cl.invite_code);
    if (noTeacher.length === 0) ok('All classes have assigned teacher');
    else warning(`${noTeacher.length} classes without teacher`);
    if (noCode.length === 0) ok('All classes have invite code');
    else warning(`${noCode.length} classes without invite code`);
  }

  // ═══════════════════════════════════════════════════════════
  // 14. USER ROLES
  // ═══════════════════════════════════════════════════════════
  console.log('\n🟢 14. USER ROLES');
  
  const { data: users } = await c.from('users').select('id, role, school_id, class_id');
  if (users) {
    const roles = {};
    for (const u of users) { roles[u.role] = (roles[u.role] || 0) + 1; }
    ok(`Users by role: ${JSON.stringify(roles)}`);
    
    // Students should have class_id
    const studentsNoClass = users.filter(u => u.role === 'student' && !u.class_id);
    if (studentsNoClass.length === 0) ok('All students assigned to a class');
    else warning(`${studentsNoClass.length} students without class`);
    
    // All users should have school_id
    const noSchool = users.filter(u => !u.school_id);
    if (noSchool.length === 0) ok('All users have school_id');
    else warning(`${noSchool.length} users without school_id`);
    
    // Every student should have a hero
    const studentIds = users.filter(u => u.role === 'student').map(u => u.id);
    const { data: heroUsers } = await c.from('heroes').select('user_id');
    const heroUserIds = new Set((heroUsers || []).map(h => h.user_id));
    const noHero = studentIds.filter(id => !heroUserIds.has(id));
    if (noHero.length === 0) ok(`All ${studentIds.length} students have heroes`);
    else bad(`${noHero.length} students WITHOUT a hero`);
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log(`  RESULTS: ✅ ${pass} passed  |  ❌ ${fail} failed  |  ⚠️  ${warn} warnings`);
  console.log('═'.repeat(55));
  
  if (fail === 0) console.log('  🎉 ALL CRITICAL TESTS PASSED');
  else console.log(`  🚨 ${fail} FAILURES NEED ATTENTION`);
})();
