require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: heroes, error: uErr } = await supabase.from('heroes').select('id, name');
  if (uErr) { console.error('uErr', uErr); return; }
  
  const hero = heroes.find(u => u.name && (u.name.includes('Анна') || u.name.includes('Аня') || u.name.includes('Фед')));
  if (!hero) { console.log('Anya hero not found!'); return; }
  
  console.log('Found Hero:', hero.name);
  
  const { data: boxes } = await supabase.from('artifacts').select('*').in('name', [
    'Обычный Сундук', 'Редкий Сундук', 'Эпический Сундук', 'Легендарный Сундук', 'Бронзовое Кольцо', 'Ученическое Перо'
  ]);
  
  for (const b of boxes) {
    await supabase.from('hero_artifacts').insert({
      hero_id: hero.id,
      artifact_id: b.id,
      quantity: 5,
      source: 'teacher_gift',
      charges_remaining: b.max_charges > 0 ? b.max_charges : 1
    });
  }
  console.log('Restored Anya inventory!');
})();
