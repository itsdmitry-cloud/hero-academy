import { allDbRows } from '../src/lib/game/artifact-registry';

// ─── Replicating math from constants.ts ────────────────────────

const QUEST_TYPE_DROP_MULT: Record<string, number> = {
  'quest': 1.0,
  'boss': 2.5,
  'dungeon': 1.5,
};

const RARITY_WEIGHTS: Record<number, number[]> = {
  1: [85, 14, 1,   0],
  2: [70, 25, 4.5, 0.5],
  3: [55, 33, 10,  2],
  4: [40, 35, 19,  6],
  5: [25, 35, 28,  12],
};

const RARITIES = ['common', 'rare', 'epic', 'legendary'];

// In-memory DB
const DB_CATALOG = allDbRows();

function simulateRoll(
  heroLevel: number,
  questType: string,
  difficulty: number,
  dropRateMultiplier: number = 100
) {
  // 1. Base drop chance
  const typeMult = QUEST_TYPE_DROP_MULT[questType] ?? 1.0;
  const levelBonus = 1 + Math.min(heroLevel * 0.01, 0.5);
  const baseDropChance = (0.08 + (difficulty - 1) * 0.02) * (dropRateMultiplier / 100);
  const dropChance = baseDropChance * typeMult * levelBonus;

  if (Math.random() > dropChance) return null;

  // 2. Pick rarity
  const clampedDiff = Math.min(5, Math.max(1, Math.round(difficulty)));
  const weights = RARITY_WEIGHTS[clampedDiff] ?? RARITY_WEIGHTS[1];
  const totalW = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * totalW;
  let chosenRarity = 'common';
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { chosenRarity = RARITIES[i]; break; }
  }

  // 3. Filter catalog
  const catalog = DB_CATALOG.filter(a => 
    a.rarity === chosenRarity && 
    a.effect !== 'lootbox' && 
    a.min_level <= heroLevel &&
    !String(a.effect ?? '').startsWith('royal_set')
  );

  if (catalog.length === 0) return null;

  // 4. Weighted random by drop_rate
  const totalDropWeight = catalog.reduce((sum, a) => sum + (Number(a.drop_rate) || 0.1), 0);
  let r = Math.random() * totalDropWeight;
  let pick = catalog[0];
  for (const a of catalog) {
    const w = Number(a.drop_rate) || 0.1;
    r -= w;
    if (r <= 0) {
      pick = a;
      break;
    }
  }

  return pick;
}

function runSimulation(runs: number, level: number, questType: string, diff: number, mult: number) {
  console.log(`\n▶ Симуляция: ${runs.toLocaleString()} квестов`);
  console.log(`  Герой ур.${level} | Квест: ${questType} (сложность ${diff}) | Множитель: ${mult}%`);
  
  let drops = 0;
  const rarityCount: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const itemCounts: Record<string, number> = {};

  for (let i = 0; i < runs; i++) {
    const item = simulateRoll(level, questType, diff, mult);
    if (item) {
      drops++;
      rarityCount[item.rarity]++;
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    }
  }

  console.log(`  📦 Выпало предметов: ${drops} (Шанс: ${((drops / runs) * 100).toFixed(1)}%)`);
  
  if (drops > 0) {
    console.log(`  📊 Редкости: ` + RARITIES.map(r => `${r.toUpperCase()}: ${rarityCount[r]} (${((rarityCount[r]/drops)*100).toFixed(1)}%)`).join(' | '));
    
    // Top 3 most dropped
    const sortedItems = Object.entries(itemCounts).sort((a,b) => b[1] - a[1]);
    console.log(`  🏆 Самые частые:`);
    sortedItems.slice(0, 3).forEach(([name, count]) => {
      console.log(`     - ${name}: ${count} шт.`);
    });
    
    // Bottom 3 rarest (that actually dropped)
    console.log(`  💎 Самые редкие:`);
    sortedItems.slice(-3).forEach(([name, count]) => {
      console.log(`     - ${name}: ${count} шт.`);
    });
  }
}

async function main() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('🔮 DROP RATE SIMULATOR (Взвешенная система из БД)');
  console.log('═════════════════════════════════════════════════════════');

  // Ученик 1 лвл, делает домашку (quest), 1 сложность, 100% Drop Rate (стандарт)
  runSimulation(10000, 1, 'quest', 1, 100);

  // Ученик 15 лвл, делает контрольную (dungeon), 3 сложность
  runSimulation(10000, 15, 'dungeon', 3, 100);

  // Класс валит БОССА! Ученики 30 лвл, 5 сложность, включен Ивент Админа (250% дроп рейт)
  runSimulation(10000, 30, 'boss', 5, 250);

  console.log('\n✅ Моделирование завершено.\n');
}

main();
