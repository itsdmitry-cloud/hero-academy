require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncBosses() {
  const seasonId = 'e83392dd-541e-4475-bfa7-5510fba6992f'; // Active season
  const schoolId = 'a30ba6f9-1b52-4fd9-a1f7-2fb6073dd98c';
  
  const { data: classes } = await supabase.from('classes').select('id').eq('school_id', schoolId);
  const subjects = ['География', 'Английский язык', 'Алгебра'];
  
  for (const cls of classes) {
    for (const sub of subjects) {
      const { data: boss } = await supabase.from('subject_bosses')
        .select('id')
        .eq('season_id', seasonId)
        .eq('class_id', cls.id)
        .eq('subject_id', sub)
        .maybeSingle();
        
      if (!boss) {
        console.log(`Inserting ${sub} for class ${cls.id}`);
        await supabase.from('subject_bosses').insert({
          season_id: seasonId,
          class_id: cls.id,
          subject_id: sub,
          name: `Босс: ${sub}`,
          avatar: '🐉',
          max_hp: 10000,
          current_hp: 10000
        });
      }
    }
  }
  console.log('All done.');
  process.exit();
}
syncBosses();
