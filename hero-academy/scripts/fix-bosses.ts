import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: activeSeasons } = await admin.from('seasons').select('id').eq('status', 'active');
  if (!activeSeasons || activeSeasons.length === 0) { console.log('No active season!'); return; }
  const activeSeasonId = activeSeasons[0].id;
  
  console.log('Moving Bosses to Active Season:', activeSeasonId);
  const { data: bosses, error } = await admin.from('subject_bosses').update({ season_id: activeSeasonId }).neq('season_id', activeSeasonId).select('id, name');
  console.log('Moved Bosses:', bosses, error);
}
run();
