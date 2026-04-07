/**
 * Hero Academy — Database Schema Dumper v3
 * Uses Supabase Management API /v1/projects/{ref}/database/query
 *
 * Run: node scripts/dump_schema.js
 */

const https   = require('https');
const fs      = require('fs');
const path    = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !accessToken) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔍 Project:', projectRef);
  console.log('📡 Fetching full schema...\n');

  // 1. All columns with types
  const columns = await query(`
    SELECT
      c.table_name,
      c.ordinal_position,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);

  // 2. All foreign keys
  const fks = await query(`
    SELECT
      tc.table_name        AS from_table,
      kcu.column_name      AS from_column,
      ccu.table_name       AS to_table,
      ccu.column_name      AS to_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  // 3. Existing indexes
  const indexes = await query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  // ── Build Markdown ──────────────────────────────────────────
  let md = `# Hero Academy — Database Schema\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n`;
  md += `> Project ref: \`${projectRef}\`\n\n`;
  md += `---\n\n`;

  // Group columns by table
  const tables = {};
  for (const col of columns) {
    if (!tables[col.table_name]) tables[col.table_name] = [];
    tables[col.table_name].push(col);
  }

  // Group FKs by table
  const fkMap = {};
  for (const fk of fks) {
    if (!fkMap[fk.from_table]) fkMap[fk.from_table] = [];
    fkMap[fk.from_table].push(fk);
  }

  const tableNames = Object.keys(tables).sort();
  console.log(`📊 Tables found: ${tableNames.length}`);

  md += `## Tables (${tableNames.length})\n\n`;
  for (const name of tableNames) {
    md += `- [\`${name}\`](#${name})\n`;
  }
  md += '\n---\n\n';

  for (const name of tableNames) {
    md += `## \`${name}\`\n\n`;
    md += `| Column | Type | Nullable | Default |\n`;
    md += `|--------|------|----------|----------|\n`;
    for (const col of tables[name]) {
      const def = col.column_default
        ? col.column_default.replace(/\|/g, '\\|').slice(0, 40)
        : '—';
      md += `| \`${col.column_name}\` | \`${col.data_type}\` | ${col.is_nullable} | ${def} |\n`;
    }

    const tableFks = fkMap[name] || [];
    if (tableFks.length > 0) {
      md += `\n**Foreign Keys:**\n`;
      for (const fk of tableFks) {
        md += `- \`${fk.from_column}\` → \`${fk.to_table}.${fk.to_column}\`\n`;
      }
    }
    md += '\n';
  }

  // Indexes section
  const indexMap = {};
  for (const idx of indexes) {
    if (idx.indexname.endsWith('_pkey')) continue;
    if (!indexMap[idx.tablename]) indexMap[idx.tablename] = [];
    indexMap[idx.tablename].push(idx.indexname);
  }

  md += `---\n\n## Indexes\n\n`;
  for (const [table, idxs] of Object.entries(indexMap).sort()) {
    md += `**\`${table}\`**: ${idxs.map(i => `\`${i}\``).join(', ')}\n\n`;
  }

  const outPath = path.resolve(__dirname, '../DATABASE_SCHEMA.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ Schema written to: DATABASE_SCHEMA.md`);
  console.log(`📝 Tables: ${tableNames.length}, FKs: ${fks.length}, Indexes: ${indexes.length}`);
}

main().catch(console.error);
