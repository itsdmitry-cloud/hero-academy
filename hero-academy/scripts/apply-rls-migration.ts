// Применяет миграцию 20260506_optimize_rls.sql напрямую через pg.
// supabase db push отказывается работать из-за рассинхрона schema_migrations.
//
// Запуск: npx tsx scripts/apply-rls-migration.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });

const MIGRATION_FILE = '20260506_optimize_rls.sql';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL не установлен');

  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', MIGRATION_FILE),
    'utf-8',
  );

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log(`Подключение к ${url.replace(/:[^@]+@/, ':***@')}`);

  try {
    console.log(`Применяю ${MIGRATION_FILE} (${sql.length} байт)...`);
    await client.query(sql);
    console.log('✓ Миграция применена успешно');
  } catch (err) {
    console.error('✗ Ошибка применения миграции:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
