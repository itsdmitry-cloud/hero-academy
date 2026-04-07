require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: hero } = await supabase.from('heroes').select('id').limit(1).single();
  if (!hero) { console.log('Hero not found'); return; }
  
  const { data: artifacts } = await supabase.from('artifacts').select('*').in('rarity', ['common', 'rare']);
  console.log('Found ' + (artifacts ? artifacts.length : 0) + ' common/rare artifacts.');
  
  if (artifacts && artifacts.length > 0) {
    const inserts = artifacts.map(a => ({
      hero_id: hero.id,
      artifact_id: a.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: a.max_charges || null,
      source: 'shop'
    }));
    
    const { error } = await supabase.from('hero_artifacts').insert(inserts);
    if (error) {
      console.error('Error adding artifacts:', error.message);
    } else {
      console.log('Successfully added to inventory!');
    }
  }
})();
