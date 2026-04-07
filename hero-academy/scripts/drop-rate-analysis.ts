#!/usr/bin/env npx tsx
/**
 * Hero Academy — Synthetic Drop Rate Analysis
 * Simulates 10,000 grade events per scenario and tracks drop statistics.
 * Run: npx tsx scripts/drop-rate-analysis.ts
 */

/* ═══════ Constants (copied from src/lib/game/constants.ts) ═══════ */
const QUEST_TYPE_DROP_MULT: Record<string, number> = {
  quest:   0.5,
  dungeon: 1.0,
  boss:    2.0,
};

const RARITY_WEIGHTS: Record<number, number[]> = {
  1: [85, 14, 1,   0],
  2: [70, 25, 4.5, 0.5],
  3: [55, 33, 10,  2],
  4: [40, 35, 19,  6],
  5: [25, 35, 28,  12],
};
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

/* ═══════ Pure Simulation (no DB) ═══════ */
interface SimResult {
  drops: number;
  noDrops: number;
  byRarity: Record<string, number>;
}

function simulateDrops(
  trials: number,
  heroLevel: number,
  questType: string,
  difficulty: number,
  dropRateMultiplier: number = 100,
): SimResult {
  const r: SimResult = { drops: 0, noDrops: 0, byRarity: { common: 0, rare: 0, epic: 0, legendary: 0 } };

  const typeMult = QUEST_TYPE_DROP_MULT[questType] ?? 1.0;
  const levelBonus = 1 + Math.min(heroLevel * 0.01, 0.5);
  const baseDropChance = (0.08 + (difficulty - 1) * 0.02) * (dropRateMultiplier / 100);
  const dropChance = baseDropChance * typeMult * levelBonus;

  const clampedDiff = Math.min(5, Math.max(1, Math.round(difficulty)));
  const weights = RARITY_WEIGHTS[clampedDiff] ?? RARITY_WEIGHTS[1];
  const totalW = weights.reduce((s, w) => s + w, 0);

  for (let i = 0; i < trials; i++) {
    if (Math.random() > dropChance) { r.noDrops++; continue; }
    r.drops++;

    let roll = Math.random() * totalW;
    let chosen = 'common';
    for (let j = 0; j < RARITIES.length; j++) {
      roll -= weights[j];
      if (roll <= 0) { chosen = RARITIES[j]; break; }
    }
    r.byRarity[chosen]++;
  }
  return r;
}

/* ═══════ Formatting ═══════ */
function pct(n: number, total: number): string {
  return total > 0 ? (n / total * 100).toFixed(2) + '%' : '0%';
}

function pad(s: string, n: number): string { return s.padEnd(n); }
function rpad(s: string, n: number): string { return s.padStart(n); }

/* ═══════ Main ═══════ */
const TRIALS = 10_000;

console.log('🎲 Hero Academy — Drop Rate Analysis');
console.log('═'.repeat(90));
console.log(`Симуляций на сценарий: ${TRIALS.toLocaleString()}`);
console.log();

// ── 1. Drop chance by scenario ──
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  📊 ТАБЛИЦА 1: Шанс дропа по сценарию (Level 5, dropRate=100%)                    ║');
console.log('╠═══════════════╦═══════════╦═══════════════╦═══════════════════════════════════════╣');
console.log('║ Тип квеста    ║ Сложность ║ Шанс дропа    ║  Common   Rare    Epic   Legendary   ║');
console.log('╠═══════════════╬═══════════╬═══════════════╬═══════════════════════════════════════╣');

for (const qt of ['quest', 'dungeon', 'boss'] as const) {
  for (const diff of [1, 2, 3, 4, 5]) {
    const sim = simulateDrops(TRIALS, 5, qt, diff);
    const dropRate = pct(sim.drops, TRIALS);
    const c = pct(sim.byRarity.common, sim.drops);
    const r = pct(sim.byRarity.rare, sim.drops);
    const e = pct(sim.byRarity.epic, sim.drops);
    const l = pct(sim.byRarity.legendary, sim.drops);
    const label = qt === 'quest' ? 'ДЗ' : qt === 'dungeon' ? 'Контрольная' : 'Босс';
    console.log(`║ ${pad(label, 13)} ║    ${diff}      ║ ${rpad(dropRate, 12)}  ║ ${rpad(c, 7)}  ${rpad(r, 7)}  ${rpad(e, 7)}  ${rpad(l, 7)}   ║`);
  }
  if (qt !== 'boss') console.log('╠═══════════════╬═══════════╬═══════════════╬═══════════════════════════════════════╣');
}
console.log('╚═══════════════╩═══════════╩═══════════════╩═══════════════════════════════════════╝');

// ── 2. Level impact ──
console.log();
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  📊 ТАБЛИЦА 2: Влияние уровня героя (quest, difficulty=3, dropRate=100%)           ║');
console.log('╠═══════════╦═══════════════╦══════════════════════════════════════════════════╣');
console.log('║ Уровень   ║ Шанс дропа    ║  Common    Rare     Epic    Legendary  ║');
console.log('╠═══════════╬═══════════════╬══════════════════════════════════════════════════╣');

for (const lvl of [1, 5, 10, 20, 30, 50, 75, 100]) {
  const sim = simulateDrops(TRIALS, lvl, 'quest', 3);
  const dropRate = pct(sim.drops, TRIALS);
  const c = pct(sim.byRarity.common, sim.drops);
  const r = pct(sim.byRarity.rare, sim.drops);
  const e = pct(sim.byRarity.epic, sim.drops);
  const l = pct(sim.byRarity.legendary, sim.drops);
  console.log(`║   ${rpad(String(lvl), 5)}   ║ ${rpad(dropRate, 12)}  ║ ${rpad(c, 8)}  ${rpad(r, 8)}  ${rpad(e, 8)}  ${rpad(l, 8)}  ║`);
}
console.log('╚═══════════╩═══════════════╩══════════════════════════════════════════════════╝');

// ── 3. Economy multiplier impact ──
console.log();
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  📊 ТАБЛИЦА 3: Admin dropRate multiplier (quest, lv5, diff=3)                      ║');
console.log('╠═══════════════╦═══════════════╦══════════════════════════════════════════════════╣');
console.log('║ Множитель (%) ║ Шанс дропа    ║  Drops / 10k     ║');
console.log('╠═══════════════╬═══════════════╬══════════════════════════════════════════════════╣');

for (const mult of [50, 75, 100, 150, 200, 300, 500]) {
  const sim = simulateDrops(TRIALS, 5, 'quest', 3, mult);
  const dropRate = pct(sim.drops, TRIALS);
  console.log(`║     ${rpad(String(mult), 5)}     ║ ${rpad(dropRate, 12)}  ║ ${rpad(String(sim.drops), 5)} / ${TRIALS}         ║`);
}
console.log('╚═══════════════╩═══════════════╩══════════════════════════════════════════════════╝');

// ── 4. Massive test: 100k for Boss difficulty 5 at level 50 ──
console.log();
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  🐉 СТРЕСС-ТЕСТ: 100,000 Boss diff=5, Level=50                                    ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════════════╣');

const stress = simulateDrops(100_000, 50, 'boss', 5);
const stressTotal = stress.drops;
console.log(`║  Дропнулось: ${stressTotal} / 100,000 (${pct(stressTotal, 100_000)})`);
console.log(`║  ┌──────────────┬──────────┬─────────┐`);
console.log(`║  │ Редкость     │ Кол-во   │ %       │`);
console.log(`║  ├──────────────┼──────────┼─────────┤`);
for (const rar of RARITIES) {
  console.log(`║  │ ${pad(rar, 12)} │ ${rpad(String(stress.byRarity[rar]), 8)} │ ${rpad(pct(stress.byRarity[rar], stressTotal), 7)} │`);
}
console.log(`║  └──────────────┴──────────┴─────────┘`);
console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝');

// ── 5. Theoretical drop chances (exact formula) ──
console.log();
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  📐 ТЕОРЕТИЧЕСКИЕ ШАНСЫ (формула)                                                  ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════════════╣');
console.log('║  Базовый шанс = (0.08 + (diff-1)*0.02) × questType × (1 + min(level*0.01, 0.5))   ║');
console.log('║  questType: ДЗ=0.5  Контрольная=1.0  Босс=2.0                                     ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════════════╣');

for (const qt of ['quest', 'dungeon', 'boss'] as const) {
  const label = qt === 'quest' ? 'ДЗ (×0.5)' : qt === 'dungeon' ? 'Контр. (×1.0)' : 'Босс (×2.0)';
  const row: string[] = [];
  for (const diff of [1, 2, 3, 4, 5]) {
    const base = (0.08 + (diff - 1) * 0.02);
    const typeMult = QUEST_TYPE_DROP_MULT[qt];
    // At level 5
    const levelBonus = 1 + Math.min(5 * 0.01, 0.5);
    const chance = base * typeMult * levelBonus * 100;
    row.push(`d${diff}=${chance.toFixed(1)}%`);
  }
  console.log(`║  ${pad(label, 14)} ${row.join('  ')}`);
}
console.log('║');
console.log('║  Вес редкости по сложности (W[common, rare, epic, legendary]):');
for (let d = 1; d <= 5; d++) {
  const w = RARITY_WEIGHTS[d];
  console.log(`║    d${d}: [${w.join(', ')}]`);
}
console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝');

// ── 6. Expected drops per 100 quests ──
console.log();
console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  🎯 ОЖИДАЕМЫЙ ДРОП НА 100 КВЕСТОВ (Level 10)                                      ║');
console.log('╠═══════════════╦═══════╦═════════╦═════════════════════════════════════════╣');
console.log('║ Тип + Сложн.  ║ Дропы ║ Common  ║  Rare     Epic    Legendary             ║');
console.log('╠═══════════════╬═══════╬═════════╬═════════════════════════════════════════╣');

for (const qt of ['quest', 'dungeon', 'boss'] as const) {
  for (const diff of [1, 3, 5]) {
    const sim = simulateDrops(100_000, 10, qt, diff);
    const scale = 100 / 100_000;
    const drops = (sim.drops * scale).toFixed(1);
    const c = (sim.byRarity.common * scale).toFixed(1);
    const r = (sim.byRarity.rare * scale).toFixed(1);
    const e = (sim.byRarity.epic * scale).toFixed(2);
    const l = (sim.byRarity.legendary * scale).toFixed(2);
    const label = qt === 'quest' ? 'ДЗ' : qt === 'dungeon' ? 'Контрольная' : 'Босс';
    console.log(`║ ${pad(`${label} d${diff}`, 13)} ║ ${rpad(drops, 5)} ║ ${rpad(c, 7)} ║  ${rpad(r, 7)}  ${rpad(e, 7)}  ${rpad(l, 7)}             ║`);
  }
}
console.log('╚═══════════════╩═══════╩═════════╩═════════════════════════════════════════╝');

console.log('\n✅ Анализ завершён!');
