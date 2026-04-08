require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Boss damage artifact IDs from DB
const BOSS_ARTIFACT_IDS = [
  '2483a7d7-01eb-4db3-adf3-61003722c623', // ☄️ Метеоритный Дождь — 3000 урона боссу
  '8f75b9eb-50f9-40bf-9c0a-7c1488d11064', // 💎 Кристалл Охотника — +200 XP за босс (1 заряд)
  '608b2eac-1f90-4b52-8ea4-3129e85fb392', // 🐲 Коготь Дракона — +20% урона боссу постоянно
  'e57da44e-e1db-49a2-87df-8c5f75075099', // 📜 Свиток Истины — Урон боссу ×3 (1 заряд)
  '3d5af2bd-1b5d-46ee-b62f-683fdbab862d', // 🪨 Угольный Камень — 500 урона боссу
  '16bb3029-83ab-4614-8277-b1894d155843', // 🧪 Зелье Берсерка — 100 урона боссу
  'a670549e-7c31-4585-a345-d86c4adfd9c1', // 🔥 Огненный Натиск — +20% боссу классу 24ч
];

const HERO_USER_ID = '4c24c480-ba64-4705-87b5-52ad359defbb'; // Аня Федорова

(async () => {
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, level')
    .eq('user_id', HERO_USER_ID)
    .single();

  if (!hero) { console.log('❌ Герой не найден'); return; }
  console.log(`✅ Герой: ${hero.name} (lvl ${hero.level})`);

  const { data: artifacts } = await supabase
    .from('artifacts')
    .select('id, name, max_charges, duration_hours')
    .in('id', BOSS_ARTIFACT_IDS);

  console.log(`\n📦 Артефактов для выдачи: ${artifacts.length}`);
  artifacts.forEach(a => console.log(`   - ${a.name}`));

  // Check existing
  const { data: existing } = await supabase
    .from('hero_artifacts')
    .select('artifact_id')
    .eq('hero_id', hero.id)
    .in('artifact_id', BOSS_ARTIFACT_IDS);

  const existingIds = new Set((existing || []).map(e => e.artifact_id));
  const toInsert = artifacts
    .filter(a => !existingIds.has(a.id))
    .map(a => ({
      hero_id: hero.id,
      artifact_id: a.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: a.max_charges || null,
      expires_at: a.duration_hours
        ? new Date(Date.now() + a.duration_hours * 3_600_000).toISOString()
        : null,
      source: 'teacher_gift',
    }));

  if (toInsert.length === 0) {
    console.log('\n⚠️ Все артефакты уже есть');
    return;
  }

  console.log(`\n🎁 Выдаю ${toInsert.length} артефактов...`);
  const { error } = await supabase.from('hero_artifacts').insert(toInsert);
  if (error) {
    console.error('❌ Ошибка:', error.message);
  } else {
    console.log(`✅ Готово! ${toInsert.length} босс-артефактов выдано Ане Федоровой`);
    if (existingIds.size > 0) {
      console.log(`   (${existingIds.size} уже были — пропущены)`);
    }
  }
})();
