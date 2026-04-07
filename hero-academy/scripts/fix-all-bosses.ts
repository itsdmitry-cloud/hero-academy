import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: schools } = await admin.from('schools').select('id');
  if (!schools) return;

  for (const s of schools) {
    const { data: seasons } = await admin.from('seasons')
      .select('id')
      .eq('school_id', s.id)
      .order('created_at', { ascending: false }).limit(1);
    
    if (seasons && seasons.length > 0) {
      const sId = seasons[0].id;
      console.log('Activating season', sId, 'for school', s.id);
      await admin.from('seasons').update({ status: 'active' }).eq('id', sId);
      
      const { data: classes } = await admin.from('classes').select('id').eq('school_id', s.id);
      if (classes) {
         const cIds = classes.map((c: any) => c.id);
         const { data: bosses } = await admin.from('subject_bosses').update({ season_id: sId }).in('class_id', cIds).select('id');
         console.log('Moved', bosses?.length, 'bosses to season', sId);
      }
    }
  }
}
run();
