require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function reindex() {
  console.log('--- STARTING REINDEX ---');

  // 1. Reset all Heroes to 100 HP, in case any bugs caused negative HP or inactive statuses incorrectly
  console.log('1. Fixing Hero stats...');
  const { data: heroes } = await supabase.from('heroes').select('id, hp');
  for (const h of heroes || []) {
    if (h.hp <= 0) {
      await supabase.from('heroes').update({ hp: 100, status: 'active' }).eq('id', h.id);
    }
  }

  // 2. Map all Teacher Subjects per School
  console.log('2. Aggregating Teacher Subjects...');
  const { data: teachers } = await supabase.from('users').select('school_id, subjects').eq('role', 'teacher');
  const schoolSubjects = {}; // schoolId -> Set of subjects
  for (const t of teachers || []) {
    if (!t.school_id || !t.subjects) continue;
    if (!schoolSubjects[t.school_id]) schoolSubjects[t.school_id] = new Set();
    t.subjects.forEach(sub => schoolSubjects[t.school_id].add(sub));
  }

  // 3. Process every School
  console.log('3. Reindexing Bosses per Class...');
  const { data: schools } = await supabase.from('schools').select('id');
  
  for (const school of schools || []) {
    const subjectsSet = schoolSubjects[school.id];
    if (!subjectsSet || subjectsSet.size === 0) continue; // No subjects in this school
    const subjects = Array.from(subjectsSet);

    // Get Active Season
    const { data: season } = await supabase.from('seasons')
      .select('id, starts_at, ends_at')
      .eq('school_id', school.id)
      .eq('status', 'active')
      .limit(1).maybeSingle();

    if (!season) {
      console.log(`No active season for school ${school.id}, skipping bosses...`);
      continue;
    }

    // Get Classes
    const { data: classes } = await supabase.from('classes').select('id').eq('school_id', school.id);

    // Calc Duration
    const starts = new Date(season.starts_at);
    const ends = new Date(season.ends_at);
    const weeks = Math.max(1, Math.round((ends.getTime() - starts.getTime()) / (1000 * 60 * 60 * 24 * 7)));

    for (const cls of classes || []) {
      // Find students in this class
      const { count: studentCount } = await supabase.from('users')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id)
        .eq('role', 'student');

      const students = studentCount || 10;
      // Formula: students * lessons_per_week (3) * weeks * avg_dmg_per_lesson (20)
      const calculatedHp = Math.round(students * 3 * weeks * 20);

      for (const subject of subjects) {
        const { data: existingBoss } = await supabase.from('subject_bosses')
          .select('id, max_hp, current_hp, is_defeated')
          .eq('season_id', season.id)
          .eq('class_id', cls.id)
          .eq('subject_id', subject)
          .maybeSingle();

        if (!existingBoss) {
          console.log(`[+] Created new Boss "${subject}" for class ${cls.id} with HP ${calculatedHp}`);
          await supabase.from('subject_bosses').insert({
            season_id: season.id,
            class_id: cls.id,
            subject_id: subject,
            name: `Босс: ${subject}`,
            avatar: '🐉',
            max_hp: calculatedHp,
            current_hp: calculatedHp,
          });
        } else {
          // If boss already exists but has default 10k HP, recalculate it
          // OR if it's currently at exactly max_hp (meaning no damage taken yet), just override it
          if (existingBoss.max_hp === 10000 || existingBoss.max_hp === existingBoss.current_hp) {
             console.log(`[*] Updated Boss "${subject}" for class ${cls.id} to new Calculated HP (${existingBoss.max_hp} -> ${calculatedHp})`);
             await supabase.from('subject_bosses').update({
               max_hp: calculatedHp,
               current_hp: calculatedHp, // Reset current HP too because we're overriding it
             }).eq('id', existingBoss.id);
          }
        }
      }
    }
  }

  console.log('--- REINDEX COMPLETE ---');
}

reindex().catch(console.error);
