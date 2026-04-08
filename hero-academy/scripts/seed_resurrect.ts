import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: heroes, error: hErr } = await supabase.from('heroes').select('id, name');
  const hero = heroes?.find(h => h.name.includes('Аня') || h.name.includes('anna'));
  if (!hero) return console.log('Hero missing', heroes?.map(x=>x.name));
  
  console.log('Found:', hero.name);
  
  const { data: arts } = await supabase.from('artifacts').select('id, max_charges, name').in('name', ['Младшее Перо Феникса', 'Крест Возрождения', 'Огненное Перо']);
  if (!arts) return console.log('No arts.');

  for (const a of arts) {
    await supabase.from('hero_artifacts').delete().eq('hero_id', hero.id).eq('artifact_id', a.id);
    await supabase.from('hero_artifacts').insert({
      hero_id: hero.id,
      artifact_id: a.id,
      is_equipped: true,
      charges_remaining: a.max_charges || 10
    });
    console.log('Granted', a.name);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
