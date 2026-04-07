import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // 1. Find a teacher
  const { data: teacher } = await admin.from('users').select('id, school_id').eq('role', 'teacher').limit(1).single();
  // 2. Find a class for this teacher
  const { data: classRow } = await admin.from('classes').select('id, school_id').eq('school_id', teacher.school_id).limit(1).single();
  
  // 3. Find active season
  const { data: season } = await admin.from('seasons').select('id, status').eq('school_id', teacher.school_id).eq('status', 'active').limit(1).maybeSingle();
  
  if (!season) {
    console.log('No active season found for school', teacher.school_id);
    return;
  }
  
  console.log('Active Season:', season.id);
  
  // 4. Find bosses
  const { data: bossesData } = await admin
    .from('subject_bosses').select('*')
    .eq('season_id', season.id).eq('class_id', classRow.id)
    .order('created_at', { ascending: true });

  console.log('Bosses Data:', bossesData?.length ? bossesData.map(b => b.name) : 'none');
}
run();
