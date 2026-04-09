/**
 * Diagnostic: list seasons grouped by school + status, and show
 * active/non-active counts. Also lists schools with NO active season
 * and the teacher → school mapping.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: schools, error: schErr } = await supabase
    .from('schools')
    .select('id, name');
  if (schErr) throw schErr;

  const { data: seasons, error: seaErr } = await supabase
    .from('seasons')
    .select('id, school_id, name, status, starts_at, ends_at');
  if (seaErr) throw seaErr;

  const schoolName = new Map((schools ?? []).map(s => [s.id, s.name]));

  const bySchool = new Map<string, typeof seasons>();
  for (const s of seasons ?? []) {
    if (!bySchool.has(s.school_id)) bySchool.set(s.school_id, []);
    bySchool.get(s.school_id)!.push(s);
  }

  console.log(`\nSchools: ${schools?.length ?? 0}, seasons: ${seasons?.length ?? 0}\n`);

  for (const sch of schools ?? []) {
    const list = bySchool.get(sch.id) ?? [];
    const active = list.filter(s => s.status === 'active');
    const tag = active.length > 0 ? '✅' : '❌';
    console.log(`${tag} SCHOOL ${sch.name} [${sch.id}] — ${list.length} seasons, ${active.length} active`);
    for (const s of list) {
      console.log(`     · ${s.status.padEnd(8)} ${s.name} (${s.starts_at} → ${s.ends_at})`);
    }
  }

  const { data: teachers } = await supabase
    .from('users')
    .select('id, display_name, school_id, subjects')
    .eq('role', 'teacher');

  console.log(`\n─── Teachers (${teachers?.length ?? 0}) ───`);
  for (const t of teachers ?? []) {
    const sn = schoolName.get(t.school_id) ?? '???';
    const list = bySchool.get(t.school_id) ?? [];
    const active = list.filter(s => s.status === 'active');
    const flag = active.length > 0 ? '✅ active season' : '❌ NO ACTIVE SEASON';
    const subjs = (t.subjects ?? []).join(', ') || '(empty)';
    console.log(`  ${t.display_name} [${t.id}]`);
    console.log(`     school: ${sn} [${t.school_id}] → ${flag}`);
    console.log(`     subjects: ${subjs}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
