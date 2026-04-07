require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MALE_EXCEPTIONS = [
  'илья', 'никита', 'данила', 'саша', 'леша', 'лёша', 
  'паша', 'миша', 'гриша', 'коля', 'вася', 'женя', 
  'петя', 'вова', 'тёма', 'рома', 'витя', 'дима', 
  'ваня', 'гоша', 'илюша', 'андрюша', 'сережа'
];

async function updateGenders() {
  const { data: heroes, error } = await supabase.from('heroes').select('id, name, gender');
  if (error || !heroes) {
    console.error('Error fetching heroes:', error);
    return;
  }

  let updatedCount = 0;

  for (const hero of heroes) {
    const nameLower = hero.name.split(' ')[0].trim().toLowerCase(); // Use first name if they have a title
    let isFemale = false;

    // Basic heuristic: Russian female names usually end with 'а' or 'я'
    if (nameLower.endsWith('а') || nameLower.endsWith('я')) {
      isFemale = true;
      // Filter out male diminutives that also end in 'a'/'я'
      for (const exc of MALE_EXCEPTIONS) {
         if (nameLower === exc) {
           isFemale = false;
           break;
         }
      }
    }
    
    // Explicit cases 
    if (['любовь', 'асель', 'айгуль'].includes(nameLower)) isFemale = true;
    
    // Test cases shown in the DB earlier: name = 'Аня', 'Мила', 'Соня'
    if (['аня', 'мила', 'соня', 'даша', 'маша', 'настя', 'катюша', 'катя', 'оля', 'света'].includes(nameLower)) {
      isFemale = true;
    }

    const newGender = isFemale ? 'female' : 'male';
    
    // Default to update ALL records just to be sure we clear out incorrect ones
    if (hero.gender !== newGender || hero.gender === 'male' || !hero.gender) {
        console.log(`[Update] ${hero.name} -> ${newGender}`);
        const { error: updErr } = await supabase
           .from('heroes')
           .update({ gender: newGender })
           .eq('id', hero.id);
        
        if (updErr) console.error(`Failed to update ${hero.name}`, updErr);
        else updatedCount++;
    }
  }

  console.log(`Success! Updated ${updatedCount} heroes with a matching gender.`);
}

updateGenders();
