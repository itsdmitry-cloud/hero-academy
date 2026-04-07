const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function checkSeasons() {
  const { data } = await admin.from('seasons').select('*');
  console.log('Seasons:', data);
}
checkSeasons();
