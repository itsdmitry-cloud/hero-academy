require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: schools } = await supabase.from('schools').select('id').limit(1);
  if (!schools || schools.length === 0) return console.log('No schools found');
  const schoolId = schools[0].id;

  const { data: classes } = await supabase.from('classes').select('id').eq('school_id', schoolId).limit(1);
  const classId = classes ? classes[0].id : null;

  // Create season
  const { data: season, error: sErr } = await supabase.from('seasons').insert({
    school_id: schoolId,
    name: 'Весенняя четверть 2026',
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    is_active: true
  }).select('id').single();

  if (sErr) return console.log('Season Error:', sErr);

  if (classId) {
    const { data: hero } = await supabase.from('heroes').select('id, name').limit(1);

    const { data: boss, error: bErr } = await supabase.from('subject_bosses').insert({
      season_id: season.id,
      class_id: classId,
      subject_id: 'Алгебра',
      name: 'Дракон Алгебры',
      avatar: '🐉',
      max_hp: 15000,
      current_hp: 14950
    }).select('id').single();

    if (bErr) return console.log('Boss Error:', bErr);

    if (hero && hero.length > 0) {
      await supabase.from('boss_damage_logs').insert({
        boss_id: boss.id,
        hero_id: hero[0].id,
        damage_dealt: 50,
        action_type: 'lesson_mark'
      });
    }
  }
  console.log('Seeded Boss Successfully!');
}

main().catch(console.error);
