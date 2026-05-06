import { config } from 'dotenv';
import { Client } from 'pg';

async function main() {
  config({ path: '.env.local' });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT tablename, policyname,
           CASE WHEN regexp_replace(qual, '\\s+', ' ', 'g') LIKE '%( SELECT auth.uid() AS uid)%' THEN 'OPTIMIZED'
                WHEN qual LIKE '%auth.uid()%' THEN 'NOT_OPTIMIZED'
                ELSE 'NO_AUTH' END AS status
    FROM pg_policies
    WHERE schemaname = 'public' AND qual LIKE '%auth.uid()%'
    ORDER BY status DESC, tablename;
  `);
  const counts = res.rows.reduce((a: Record<string,number>, r: {status: string}) => {
    a[r.status] = (a[r.status] || 0) + 1; return a;
  }, {});
  console.log('Сводка:', counts);
  const notOptimized = res.rows.filter((r: {status: string}) => r.status === 'NOT_OPTIMIZED');
  if (notOptimized.length > 0) {
    console.log('Не оптимизированы:');
    console.table(notOptimized);
  } else {
    console.log('✓ Все политики оптимизированы');
  }
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
