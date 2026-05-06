import { config } from 'dotenv';
import { Client } from 'pg';

async function main() {
  config({ path: '.env.local' });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('class_buffs', 'hero_collectibles', 'hero_season_rewards')
    ORDER BY tablename, policyname;
  `);
  for (const row of res.rows) {
    console.log(`\n--- ${row.tablename}.${row.policyname} (${row.cmd}) ---`);
    console.log('USING:', row.qual);
    if (row.with_check) console.log('WITH CHECK:', row.with_check);
  }
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
