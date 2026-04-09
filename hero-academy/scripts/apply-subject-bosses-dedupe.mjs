/**
 * Применяет миграцию 20260409214924_subject_bosses_dedupe.sql
 * Перед применением и после — печатает статистику дубликатов,
 * чтобы видно было, что именно починилось.
 *
 * Usage: node scripts/apply-subject-bosses-dedupe.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const envContent = readFileSync(join(projectRoot, '.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
}
const DATABASE_URL = env.DATABASE_URL;

async function stats(client, label) {
  console.log(`\n📊 ${label}`);
  const total = await client.query(`SELECT count(*)::int AS c FROM public.subject_bosses`);
  console.log(`   subject_bosses rows total: ${total.rows[0].c}`);

  const dupes = await client.query(`
    SELECT season_id, class_id, LOWER(subject_id) AS lower_subject,
           count(*) AS n, array_agg(DISTINCT subject_id) AS variants
    FROM public.subject_bosses
    GROUP BY season_id, class_id, LOWER(subject_id)
    HAVING count(*) > 1
    ORDER BY n DESC
    LIMIT 20;
  `);
  console.log(`   duplicate (season,class,lower(subject)) groups: ${dupes.rowCount}`);
  for (const row of dupes.rows) {
    console.log(`     · class=${row.class_id} lower=${row.lower_subject} n=${row.n} variants=${JSON.stringify(row.variants)}`);
  }

  const trimmy = await client.query(`
    SELECT id, subject_id
    FROM public.subject_bosses
    WHERE subject_id <> regexp_replace(btrim(subject_id), '\\s+', ' ', 'g')
    LIMIT 20;
  `);
  console.log(`   subject_id rows needing trim: ${trimmy.rowCount}`);
  for (const row of trimmy.rows) {
    console.log(`     · ${row.id} [${JSON.stringify(row.subject_id)}]`);
  }

  const teacherDirty = await client.query(`
    SELECT count(*)::int AS c
    FROM public.users
    WHERE role = 'teacher'
      AND subjects IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(subjects) AS e
        WHERE e <> regexp_replace(btrim(e), '\\s+', ' ', 'g')
      );
  `);
  console.log(`   teachers with un-trimmed subjects[]: ${teacherDirty.rows[0].c}`);
}

async function main() {
  console.log('🚀 Applying subject_bosses dedupe migration');
  console.log(`   Target: ${DATABASE_URL.replace(/:[^@]+@/, ':***@')}`);

  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('   ✅ Connected');

  await stats(client, 'BEFORE');

  const sql = readFileSync(
    join(projectRoot, 'supabase/migrations/20260409214924_subject_bosses_dedupe.sql'),
    'utf-8',
  );

  console.log('\n🔧 Executing migration...');
  try {
    await client.query(sql);
    console.log('   ✅ Migration applied');
  } catch (e) {
    console.error(`   ❌ Migration failed: ${e.message}`);
    await client.end();
    process.exit(1);
  }

  await stats(client, 'AFTER');

  // Проверяем, что уникальный индекс создан
  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'subject_bosses'
      AND indexname = 'uniq_subject_bosses_season_class_subject_ci';
  `);
  console.log(`\n🔐 UNIQUE index: ${idx.rowCount > 0 ? '✅ present' : '❌ MISSING'}`);

  await client.end();
  console.log('\n🏁 Done.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
