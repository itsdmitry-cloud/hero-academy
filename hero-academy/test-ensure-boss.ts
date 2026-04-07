import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: teacher } = await admin.from('users').select('*').eq('role', 'teacher').limit(1).single();
  const { data: cls } = await admin.from('classes').select('*').eq('school_id', teacher.school_id).limit(1).single();
  
  const subjects = ['Алгебра', 'Биология'];
  
  const res = await fetch('http://localhost:3000/api/bosses/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId: cls.id, subjects })
  });
  
  const result = await res.json();
  console.log('Ensure Bosses result:', JSON.stringify(result, null, 2));
}
run();
