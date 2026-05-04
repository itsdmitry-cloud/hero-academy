/**
 * One-shot sync of streak_rewards table to alpha-test thresholds (3/6/10/14).
 * Idempotent: deletes existing rows then re-inserts. Safe to re-run.
 *
 * Run with: npx tsx scripts/sync-streak-rewards-alpha.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALPHA_REWARDS = [
  { day_threshold: 3,  xp_bonus: 150,  gold_bonus: 50,  description: '3 дня: «поймал ритм» — Common Lootbox' },
  { day_threshold: 6,  xp_bonus: 300,  gold_bonus: 150, description: '6 дней: половина теста — Rare Lootbox' },
  { day_threshold: 10, xp_bonus: 600,  gold_bonus: 300, description: '10 дней: почти весь тест — Epic Lootbox' },
  { day_threshold: 14, xp_bonus: 1000, gold_bonus: 500, description: '14 дней: идеальная серия — Legendary Lootbox' },
];

async function main() {
  console.log('═══ SYNC STREAK_REWARDS → ALPHA THRESHOLDS ═══');

  const { data: existing, error: readErr } = await supabase
    .from('streak_rewards')
    .select('id, day_threshold, xp_bonus, gold_bonus');
  if (readErr) {
    console.error('❌ Read failed:', readErr.message);
    process.exit(1);
  }
  console.log(`ℹ️  Existing rows: ${existing?.length ?? 0}`);
  for (const r of existing ?? []) console.log(`   ${JSON.stringify(r)}`);

  // streak_claims has FK on streak_reward_id with ON DELETE CASCADE — claims will go away.
  // For alpha this is OK: there are no production claims yet.
  const { error: delErr } = await supabase.from('streak_rewards').delete().neq('day_threshold', -1);
  if (delErr) {
    console.error('❌ Delete failed:', delErr.message);
    process.exit(1);
  }

  const { error: insErr } = await supabase.from('streak_rewards').insert(ALPHA_REWARDS);
  if (insErr) {
    console.error('❌ Insert failed:', insErr.message);
    process.exit(1);
  }

  const { data: after } = await supabase
    .from('streak_rewards')
    .select('day_threshold, xp_bonus, gold_bonus')
    .order('day_threshold', { ascending: true });
  console.log('✅ New rows:');
  for (const r of after ?? []) console.log(`   ${JSON.stringify(r)}`);
  console.log('═══ DONE ═══');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
