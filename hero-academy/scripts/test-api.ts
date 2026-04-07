import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: schools } = await admin.from('schools').select('id, name').limit(1);
  const schoolId = schools![0].id;
  
  const res = await fetch('http://localhost:3000/api/admin/create-season', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Весна 2026 Admin Test', startDate: '2026-04-01', endDate: '2026-06-01', schoolId }),
  });
  
  const text = await res.text();
  console.log('Status:', res.status, 'Response:', text);
}
run();
