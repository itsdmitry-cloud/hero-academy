/**
 * One-off cleanup for leftover schools from aborted runs of
 * `test-delete-school.ts`. All test schools are tagged `tdel*`.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { cascadeDeleteSchool } from '../src/lib/server/delete-school';

config({ path: resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data } = await admin.from('schools').select('id,name').like('name', 'tdel%');
  console.log(`leftover schools: ${data?.length ?? 0}`);
  for (const s of data ?? []) {
    console.log(`  cleaning ${s.name}`);
    const r = await cascadeDeleteSchool(admin, s.id);
    console.log(`    → deleted_users: ${r.deleted_users}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
