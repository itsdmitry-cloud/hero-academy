#!/usr/bin/env node
/**
 * Direct PostgreSQL script — runs SQL from terminal without SQL Editor.
 * 
 * Usage:
 *   node scripts/db.mjs "SELECT count(*) FROM artifacts;"
 *   node scripts/db.mjs --file scripts/migrations/some.sql
 *
 * No psql needed — uses Node.js + pg package directly.
 */

import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const DB_URL = 'postgresql://postgres.gjezmurskhjngbostltn:vWp7Q94BaZ7Jz3kU@aws-1-eu-north-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// Parse args
let sql;
const args = process.argv.slice(2);

if (args[0] === '--file' && args[1]) {
  sql = readFileSync(args[1], 'utf-8');
  console.log(`📂 Running file: ${args[1]}\n`);
} else if (args[0]) {
  sql = args[0];
} else {
  // stdin
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  sql = Buffer.concat(chunks).toString();
}

if (!sql?.trim()) {
  console.error('Usage:\n  node scripts/db.mjs "SQL"\n  node scripts/db.mjs --file path/to/file.sql');
  process.exit(1);
}

try {
  const result = await client.query(sql);
  
  if (Array.isArray(result)) {
    // Multiple statements
    result.forEach((r, i) => {
      console.log(`\n--- Statement ${i + 1} ---`);
      console.log(`Command: ${r.command}, Rows: ${r.rowCount ?? 0}`);
      if (r.rows?.length) {
        console.table(r.rows);
      }
    });
  } else {
    console.log(`✅ ${result.command} — ${result.rowCount ?? 0} rows`);
    if (result.rows?.length) {
      console.table(result.rows);
    }
  }
} catch (err) {
  console.error('❌ SQL Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
