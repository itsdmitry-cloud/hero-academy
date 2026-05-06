import { config } from 'dotenv';
import { Client } from 'pg';

async function main() {
  config({ path: '.env.local' });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'idx_activity_log_hero_created',
        'idx_transactions_hero_created',
        'idx_quests_class_status_created',
        'idx_news_reads_user_news'
      )
    ORDER BY indexname;
  `);
  console.table(res.rows);
  console.log(`Создано: ${res.rows.length} из 4`);
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
