/**
 * One-off: create an active season "Весна 2026" for школа "Успех"
 * so teacher subject-boss metrics start appearing on the dashboard.
 *
 * Idempotent: skips if an active season already exists for the school.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SCHOOL_ID = '99bd1216-75df-4c99-a5fa-cbd7d77010e2'; // Школа "Успех"
const NAME = 'Весна 2026';
const STARTS_AT = '2026-04-08T00:00:00+00:00';
const ENDS_AT = '2026-07-08T23:59:59+00:00';

async function main() {
  const { data: school } = await supabase.from('schools').select('id, name').eq('id', SCHOOL_ID).single();
  if (!school) throw new Error(`School ${SCHOOL_ID} not found`);
  console.log(`Target school: ${school.name} [${school.id}]`);

  const { data: existing } = await supabase
    .from('seasons')
    .select('id, name, status')
    .eq('school_id', SCHOOL_ID)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    console.log(`⏭  Active season already exists: ${existing.name} [${existing.id}] — nothing to do.`);
    return;
  }

  const { data: inserted, error } = await supabase
    .from('seasons')
    .insert({
      name: NAME,
      school_id: SCHOOL_ID,
      starts_at: STARTS_AT,
      ends_at: ENDS_AT,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw error;
  console.log(`✅ Created active season "${inserted.name}" [${inserted.id}] for ${school.name}`);
}

main().catch(e => { console.error(e); process.exit(1); });
