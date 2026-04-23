/**
 * Alpha-Test Setup (May 2026)
 *
 * Idempotent seed script that sets up:
 *   1. Season "Огненный Сезон" (fire element, 2026-05-04 → 2026-05-25)
 *   2. season_boss (base_hp=15000)
 *   3. season_boss_class_hp per class (max_hp=63000 = base_hp × 420%)
 *   4. economy_config per class (xp=300, gold=250, dmg=65, drop=120, boss_hp=420)
 *
 * Usage:
 *   npx tsx scripts/setup-alpha-test.ts --class-ids <uuid1>,<uuid2>
 *
 * Re-run safe: all operations are upserts.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const SEASON_NAME = 'Огненный Сезон';
const SEASON_STARTS = '2026-05-04T00:00:00+03:00';
const SEASON_ENDS = '2026-05-25T23:59:59+03:00';
const BOSS_NAME = 'Дракон Алгебры';
const BOSS_AVATAR = '🐉';
const BOSS_DESCRIPTION = 'Древний страж математических тайн. Пал — освободишь класс от двоек на всё лето.';
const BOSS_BASE_HP = 15000;
const BOSS_HP_MULTIPLIER = 420;
const BOSS_MAX_HP = Math.round(BOSS_BASE_HP * BOSS_HP_MULTIPLIER / 100);
const BOSS_REWARD_POOL_XP = 25000;
const BOSS_REWARD_POOL_GOLD = 5000;
const UUID_REGEX = /^[0-9a-f-]{36}$/i;

const ECONOMY_CONFIG = {
  xp_multiplier: 300,
  gold_multiplier: 250,
  dmg_multiplier: 65,
  drop_rate_multiplier: 120,
  boss_hp_multiplier: BOSS_HP_MULTIPLIER,
  hp_regen_rate: 100,
};

function parseArgs(): { classIds: string[] } {
  const idx = process.argv.indexOf('--class-ids');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: npx tsx scripts/setup-alpha-test.ts --class-ids <uuid1>,<uuid2>');
    process.exit(1);
  }
  const classIds = process.argv[idx + 1].split(',').map(s => s.trim()).filter(Boolean);
  if (classIds.length === 0) {
    console.error('At least one class-id required');
    process.exit(1);
  }
  const invalidIds = classIds.filter(id => !UUID_REGEX.test(id));
  if (invalidIds.length > 0) {
    console.error(`❌ Неверный формат UUID для class-id: ${invalidIds.join(', ')}`);
    console.error('   Ожидается формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 символов)');
    process.exit(1);
  }
  return { classIds };
}

async function main() {
  const { classIds } = parseArgs();
  console.log(`🎯 Setting up alpha-test for ${classIds.length} class(es): ${classIds.join(', ')}`);

  // 1. Verify classes and get school
  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .select('id, name, school_id')
    .in('id', classIds);
  if (classErr) throw classErr;
  if (!classes || classes.length !== classIds.length) {
    const found = classes?.map(c => c.id) ?? [];
    const missing = classIds.filter(id => !found.includes(id));
    throw new Error(`Classes not found: ${missing.join(', ')}`);
  }
  const schoolIds = Array.from(new Set(classes.map(c => c.school_id)));
  if (schoolIds.length !== 1) {
    throw new Error(`Classes must belong to one school. Got schools: ${schoolIds.join(', ')}`);
  }
  const schoolId = schoolIds[0];
  console.log(`✅ Classes verified, school_id=${schoolId}`);
  classes.forEach(c => console.log(`   · ${c.name} (${c.id})`));

  // 2. Upsert season
  const { data: existingSeason, error: seasonSelectErr } = await supabase
    .from('seasons')
    .select('id, name, status')
    .eq('school_id', schoolId)
    .eq('name', SEASON_NAME)
    .maybeSingle();
  if (seasonSelectErr) throw seasonSelectErr;

  let seasonId: string;
  if (existingSeason) {
    console.log(`⏭  Season "${SEASON_NAME}" exists (${existingSeason.id}, status=${existingSeason.status})`);
    seasonId = existingSeason.id;
    const { error: seasonUpdateErr } = await supabase.from('seasons').update({
      starts_at: SEASON_STARTS,
      ends_at: SEASON_ENDS,
      status: 'active',
    }).eq('id', seasonId);
    if (seasonUpdateErr) throw seasonUpdateErr;
  } else {
    const { data: inserted, error } = await supabase
      .from('seasons')
      .insert({
        name: SEASON_NAME,
        school_id: schoolId,
        starts_at: SEASON_STARTS,
        ends_at: SEASON_ENDS,
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw error;
    seasonId = inserted.id;
    console.log(`✅ Created season "${SEASON_NAME}" (${seasonId})`);
  }

  // 3. Upsert season_boss
  const { data: existingBoss, error: bossSelectErr } = await supabase
    .from('season_boss')
    .select('id, name')
    .eq('season_id', seasonId)
    .maybeSingle();
  if (bossSelectErr) throw bossSelectErr;

  let bossId: string;
  if (existingBoss) {
    console.log(`⏭  Boss "${existingBoss.name}" exists (${existingBoss.id})`);
    bossId = existingBoss.id;
    const { error: bossUpdateErr } = await supabase.from('season_boss').update({
      name: BOSS_NAME,
      avatar: BOSS_AVATAR,
      description: BOSS_DESCRIPTION,
      base_hp: BOSS_BASE_HP,
      reward_pool_xp: BOSS_REWARD_POOL_XP,
      reward_pool_gold: BOSS_REWARD_POOL_GOLD,
    }).eq('id', bossId);
    if (bossUpdateErr) throw bossUpdateErr;
  } else {
    const { data: inserted, error } = await supabase
      .from('season_boss')
      .insert({
        season_id: seasonId,
        name: BOSS_NAME,
        avatar: BOSS_AVATAR,
        description: BOSS_DESCRIPTION,
        base_hp: BOSS_BASE_HP,
        reward_pool_xp: BOSS_REWARD_POOL_XP,
        reward_pool_gold: BOSS_REWARD_POOL_GOLD,
      })
      .select('id')
      .single();
    if (error) throw error;
    bossId = inserted.id;
    console.log(`✅ Created boss "${BOSS_NAME}" (${bossId})`);
  }

  // 4. Upsert season_boss_class_hp per class
  for (const cls of classes) {
    const { data: existingHp, error: hpSelectErr } = await supabase
      .from('season_boss_class_hp')
      .select('id, current_hp')
      .eq('season_boss_id', bossId)
      .eq('class_id', cls.id)
      .maybeSingle();
    if (hpSelectErr) throw hpSelectErr;

    if (existingHp) {
      console.log(`⏭  Boss HP for class "${cls.name}" exists (current_hp=${existingHp.current_hp})`);
      // Don't reset current_hp — test may already be running
      const { error: hpUpdateErr } = await supabase.from('season_boss_class_hp').update({
        max_hp: BOSS_MAX_HP,
      }).eq('id', existingHp.id);
      if (hpUpdateErr) throw hpUpdateErr;
    } else {
      const { error } = await supabase.from('season_boss_class_hp').insert({
        season_boss_id: bossId,
        class_id: cls.id,
        max_hp: BOSS_MAX_HP,
        current_hp: BOSS_MAX_HP,
        is_defeated: false,
      });
      if (error) throw error;
      console.log(`✅ Boss HP pool created for "${cls.name}" (${BOSS_MAX_HP} HP)`);
    }
  }

  // 5. Upsert economy_config per class
  for (const cls of classes) {
    const key = `scope_class_${cls.id}`;
    const { error } = await supabase
      .from('economy_config')
      .upsert(
        { key, value: ECONOMY_CONFIG },
        { onConflict: 'key' }
      );
    if (error) throw error;
    console.log(`✅ economy_config upserted for "${cls.name}" (key=${key})`);
  }

  console.log('');
  console.log('🎉 Alpha-test setup complete!');
  console.log(`   Season: ${SEASON_NAME} (${seasonId})`);
  console.log(`   Boss: ${BOSS_NAME} (${bossId}), ${BOSS_MAX_HP} HP per class`);
  console.log(`   Classes: ${classes.map(c => c.name).join(', ')}`);
  console.log(`   Economy: xp=${ECONOMY_CONFIG.xp_multiplier}% gold=${ECONOMY_CONFIG.gold_multiplier}% dmg=${ECONOMY_CONFIG.dmg_multiplier}% drop=${ECONOMY_CONFIG.drop_rate_multiplier}% boss_hp=${ECONOMY_CONFIG.boss_hp_multiplier}%`);
}

main().catch(e => { console.error('❌ Setup failed:', e); process.exit(1); });
