require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: teacher, error } = await supabase.from('users').select('id, display_name').eq('role', 'teacher').limit(1).single();
  if (error) {
     console.log('Error finding teacher:', error);
     return;
  }
  if (teacher && teacher.id) {
    const { error: updateError } = await supabase.from('users').update({ subjects: ['Алгебра', 'Геометрия'] }).eq('id', teacher.id);
    if(updateError) {
        console.log('Error updating teacher subjects:', updateError);
    } else {
        console.log('✅ Предметы Алгебра и Геометрия успешно добавлены учителю: ' + teacher.display_name);
    }
  } else {
    console.log('❌ Учитель не найден!');
  }
}
run().catch(console.error);
