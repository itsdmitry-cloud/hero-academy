import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: users } = await admin.from('users').select('display_name, role, subjects, class_id').eq('role', 'student').limit(10);
  console.log('Students:', JSON.stringify(users, null, 2));
}
run();
