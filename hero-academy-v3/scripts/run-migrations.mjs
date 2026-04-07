#!/usr/bin/env node

/**
 * Hero Academy — Migration Runner
 * Executes SQL migration files against Supabase PostgreSQL
 * 
 * Usage: node scripts/run-migrations.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const seedFile = path.join(__dirname, '..', 'supabase', 'seed.sql');

// Supabase connection via pg_meta API (requires service_role key)
const SUPABASE_URL = 'https://gjezmurskhjngbostltn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

async function executeSql(sql, label) {
  console.log(`\n⏳ Executing: ${label}...`);
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Failed: ${label}`);
    console.error(`   Status: ${res.status}`);
    console.error(`   Body: ${text.substring(0, 500)}`);
    return false;
  }

  console.log(`✅ Done: ${label}`);
  return true;
}

async function main() {
  console.log('🏰 Hero Academy — Migration Runner\n');

  // Get migration files sorted
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files + seed.sql\n`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const success = await executeSql(sql, file);
    if (!success) {
      console.error(`\n💥 Migration stopped at: ${file}`);
      console.error('Fix the error above and re-run.');
      process.exit(1);
    }
  }

  // Run seed data
  if (fs.existsSync(seedFile)) {
    const seedSql = fs.readFileSync(seedFile, 'utf8');
    await executeSql(seedSql, 'seed.sql');
  }

  console.log('\n🎉 All migrations completed successfully!');
}

main().catch(console.error);
