require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) { console.log('Missing env variables'); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHero() {
  const { data, error } = await supabase.from('heroes').select('name, level, xp, xp_to_next').limit(5);
  console.log('Heroes:', data, error);
}

checkHero();
