import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: heroes } = await supabase.from('heroes').select('id, name, unlocked_slots');
  const hero = heroes?.find(h => h.name.includes('Аня') || h.name.includes('anna'));
  
  if (!hero) return console.log('Аня не найдена');
  console.log(`Герой: ${hero.name}, слотов было: ${hero.unlocked_slots}`);

  // 1. Расширяем полку до 6
  await supabase.from('heroes').update({ unlocked_slots: 6 }).eq('id', hero.id);
  
  // 2. Ищем ID наших трёх артефактов (которые мы уже выдали ей в таблице hero_artifacts, или просто в таблице artifacts)
  const { data: arts } = await supabase.from('artifacts')
    .select('id')
    .in('name', ['Младшее Перо Феникса', 'Крест Возрождения', 'Огненное Перо']);
  
  const artIds = arts?.map(a => a.id) || [];
  
  // 3. Отключаем Ане ВСЕ артефакты (is_equipped = false)
  await supabase.from('hero_artifacts')
    .update({ is_equipped: false })
    .eq('hero_id', hero.id);

  // 4. Экипируем назад только эти три
  if (artIds.length > 0) {
    await supabase.from('hero_artifacts')
      .update({ is_equipped: true })
      .eq('hero_id', hero.id)
      .in('artifact_id', artIds);
  }

  console.log('Готово: слотов стало 6, другие артефакты убраны в инвентарь, экипированы только артефакты выживания.');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
