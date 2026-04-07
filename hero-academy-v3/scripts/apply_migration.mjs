/**
 * Applies SQL migration and seed files to Supabase via direct PostgreSQL connection.
 * Usage: node scripts/apply_migration.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load env
const envContent = readFileSync(join(projectRoot, '.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
}

const DATABASE_URL = env.DATABASE_URL;

async function runSQLFile(client, label, filePath) {
  console.log(`\n🔧 Applying: ${label}`);
  const sql = readFileSync(filePath, 'utf-8');

  try {
    await client.query(sql);
    console.log(`  ✅ Success!`);
    return true;
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
    // If there's an error, try statement by statement
    console.log(`  🔄 Retrying statement-by-statement...`);
    const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    let ok = 0, fail = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt + ';');
        ok++;
      } catch (e2) {
        const short = stmt.substring(0, 100).replace(/\n/g, ' ');
        console.log(`  ⚠️ ${short}... — ${e2.message}`);
        fail++;
      }
    }
    console.log(`  📊 ${ok} succeeded, ${fail} had issues (may be expected for IF NOT EXISTS)`);
    return fail === 0;
  }
}

async function main() {
  console.log('🚀 Hero Academy — Migration Runner');
  console.log(`   Target: ${DATABASE_URL.replace(/:[^@]+@/, ':***@')}`);

  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('   ✅ Connected to PostgreSQL');

  // 1. Migration
  await runSQLFile(client, '010_season_artifacts.sql', join(projectRoot, 'supabase/migrations/010_season_artifacts.sql'));

  // 2. Seed
  await runSQLFile(client, 'seed_fire_artifacts.sql', join(projectRoot, 'scripts/seed_fire_artifacts.sql'));

  // 3. Verify
  console.log('\n🔍 Verification:');

  const heroColsRes = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'heroes' AND column_name IN ('gold_multiplier','xp_multiplier','boss_dmg_multiplier','hp_shield','protect_streak_active','auto_resurrect_hp')
    ORDER BY column_name
  `);
  console.log(`   Heroes new columns: ${heroColsRes.rows.map(r => r.column_name).join(', ')}`);

  const artCountRes = await client.query(`SELECT count(*) as cnt FROM artifacts WHERE season_pool = 'fire'`);
  console.log(`   Fire season artifacts: ${artCountRes.rows[0].cnt}`);

  const classBuffsRes = await client.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'class_buffs') as exists`);
  console.log(`   class_buffs table: ${classBuffsRes.rows[0].exists ? '✅ exists' : '❌ missing'}`);

  const seasonPoolRes = await client.query(`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'artifacts' AND column_name = 'season_pool') as exists`);
  console.log(`   artifacts.season_pool column: ${seasonPoolRes.rows[0].exists ? '✅ exists' : '❌ missing'}`);

  await client.end();
  console.log('\n🏁 All done!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
