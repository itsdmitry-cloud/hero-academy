import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

import { getClassAuras } from './src/lib/game/artifact-engine';

async function run() {
  const { data: pete } = await admin.from('heroes').select('id, user_id, name').ilike('name', '%петя%').single();
  const auras = await getClassAuras(pete.id);
  console.log('Pete Auras:', auras);
}
run();
