/**
 * Alpha-Test Balance Simulation — runner.
 *
 * Dry-runs 14 school days × 4 archetypes × N students for both classes.
 * Validates that spec targets (docs/superpowers/specs/2026-04-22-alpha-test-balance-design.md §10)
 * are met with the configured economy multipliers:
 *   xp=300, gold=250, dmg=40, drop=120, boss_hp=240.
 *
 * Pure game math lives in src/lib/game/alphaSimulation.ts — this file only
 * drives simulations and prints a human-readable report.
 *
 * Run:
 *   npx tsx scripts/simulate-alpha-test.ts [--seed 42] [--per-archetype 4]
 */

import {
  ARCHETYPES,
  BOSS_MAX_HP_PER_CLASS,
  ECONOMY,
  SCHOOL_DAYS,
  seededRng,
  simulateStudent,
  type SimResult,
} from '../src/lib/game/alphaSimulation';
import {
  getCurrentBPTier,
  MAX_BP_TIER,
  TOTAL_BP_XP,
} from '../src/lib/game/seasonPassConfig';

// ── CLI args ───────────────────────────────────────────────────
function arg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) ? n : fallback;
}

const SEED = arg('seed', 42);
// 15 students/class, 4 archetypes: 4 Лентяев, 4 Середняков, 4 Отличников, 3 Кита = 15
const PER_ARCHETYPE = arg('per-archetype', 4);
const KITS_PER_CLASS = 3; // Кит — более редкий архетип

// ── Helpers ────────────────────────────────────────────────────
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function padL(v: string | number, n: number) {
  return String(v).padStart(n, ' ');
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

// ── Class simulation ───────────────────────────────────────────
function simulateClass(classIdx: number, seedOffset: number): SimResult[] {
  const results: SimResult[] = [];
  let studentSeedCounter = 0;

  for (const arch of ARCHETYPES) {
    const count = arch.name === 'Кит' ? KITS_PER_CLASS : PER_ARCHETYPE;
    for (let i = 0; i < count; i++) {
      const rng = seededRng(SEED + classIdx * 10_000 + seedOffset + studentSeedCounter * 37 + 1);
      results.push(simulateStudent(arch, rng));
      studentSeedCounter++;
    }
  }
  return results;
}

// ── Report ─────────────────────────────────────────────────────
function printHeader() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Hero Academy — Alpha-Test Balance Simulation (May 2026)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Period:    ${SCHOOL_DAYS} school days (4–25 May 2026)`);
  console.log(`  Economy:   xp=${Math.round(ECONOMY.xp_multiplier * 100)}% · gold=${Math.round(ECONOMY.gold_multiplier * 100)}% · dmg=${Math.round(ECONOMY.dmg_multiplier * 100)}% · drop=${Math.round(ECONOMY.drop_rate_multiplier * 100)}% · boss_hp=${Math.round(ECONOMY.boss_hp_multiplier * 100)}%`);
  console.log(`  Boss HP:   ${BOSS_MAX_HP_PER_CLASS} per class`);
  console.log(`  BP ceiling: Tier ${MAX_BP_TIER} at ${TOTAL_BP_XP} season XP`);
  console.log(`  Seed:      ${SEED} · Per archetype: ${PER_ARCHETYPE} (Кит: ${KITS_PER_CLASS})`);
  console.log('═══════════════════════════════════════════════════════════════════');
}

function printPerArchetype(results: SimResult[], label: string) {
  console.log('');
  console.log(`── ${label} — per archetype (median of runs) ──`);
  console.log('');
  console.log(
    `  ${padL('Archetype', 10)} | ${padL('Grades', 7)} | ${padL('XP', 7)} | ${padL('Lvl', 4)} | ${padL('BP', 4)} | ${padL('Gold', 6)} | ${padL('HP', 4)} | ${padL('Deaths', 7)} | ${padL('Loot', 5)} | ${padL('BossDmg', 8)}`
  );
  console.log('  ' + '─'.repeat(95));

  for (const arch of ARCHETYPES) {
    const group = results.filter(r => r.archetype === arch.name);
    if (group.length === 0) continue;

    const medianXp      = median(group.map(r => r.totalXp));
    const medianLvl     = median(group.map(r => r.level));
    const medianBp      = median(group.map(r => getCurrentBPTier(r.seasonXp)));
    const medianGold    = median(group.map(r => r.goldEarned));
    const medianHp      = median(group.map(r => r.finalHp));
    const medianDeaths  = median(group.map(r => r.deaths));
    const medianLoot    = median(group.map(r => r.lootboxesDropped));
    const medianDmg     = median(group.map(r => r.bossDamageContributed));
    const medianGrades  = median(group.map(r => r.gradesReceived));

    console.log(
      `  ${padL(arch.name, 10)} | ${padL(medianGrades, 7)} | ${padL(medianXp, 7)} | ${padL(medianLvl, 4)} | ${padL(`${medianBp}/${MAX_BP_TIER}`, 4)} | ${padL(medianGold, 6)} | ${padL(medianHp, 4)} | ${padL(medianDeaths, 7)} | ${padL(medianLoot, 5)} | ${padL(medianDmg, 8)}`
    );
  }
}

function printClassAggregates(results: SimResult[], label: string) {
  const totalBossDamage = results.reduce((s, r) => s + r.bossDamageContributed, 0);
  const totalDeaths     = results.reduce((s, r) => s + r.deaths, 0);
  const totalLoot       = results.reduce((s, r) => s + r.lootboxesDropped, 0);
  const medianLvl       = median(results.map(r => r.level));
  const medianBp        = median(results.map(r => getCurrentBPTier(r.seasonXp)));
  const studentsFinishedBp = results.filter(r => getCurrentBPTier(r.seasonXp) >= MAX_BP_TIER).length;

  console.log('');
  console.log(`── ${label} — class aggregates (${results.length} students) ──`);
  console.log('');
  console.log(`  Total boss damage:     ${totalBossDamage} / ${BOSS_MAX_HP_PER_CLASS} (${pct(totalBossDamage, BOSS_MAX_HP_PER_CLASS)})`);
  console.log(`  Total deaths:          ${totalDeaths}`);
  console.log(`  Total lootbox drops:   ${totalLoot}  (avg ${(totalLoot / results.length).toFixed(1)} per student)`);
  console.log(`  Median student level:  ${medianLvl}`);
  console.log(`  Median BP tier:        ${medianBp}/${MAX_BP_TIER}`);
  console.log(`  Students at BP max:    ${studentsFinishedBp}/${results.length}`);

  return { totalBossDamage, totalDeaths, medianLvl, medianBp };
}

function validate(
  classResults: ReturnType<typeof printClassAggregates>,
  label: string
): boolean {
  console.log('');
  console.log(`── ${label} — spec validation (spec §10) ──`);
  console.log('');
  const checks = [
    { label: 'Median student → Level 3+',         pass: classResults.medianLvl >= 3,                          actual: `L${classResults.medianLvl}` },
    { label: 'Deaths ≤ 3 per class',              pass: classResults.totalDeaths <= 3,                         actual: `${classResults.totalDeaths}` },
    { label: 'Deaths ≥ 1 per class (not too soft)', pass: classResults.totalDeaths >= 1,                       actual: `${classResults.totalDeaths}` },
    { label: 'Boss killed (damage ≥ max_hp)',     pass: classResults.totalBossDamage >= BOSS_MAX_HP_PER_CLASS, actual: `${classResults.totalBossDamage}/${BOSS_MAX_HP_PER_CLASS}` },
    { label: 'Median BP tier ≥ 10',               pass: classResults.medianBp >= 10,                           actual: `T${classResults.medianBp}` },
  ];
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}: ${c.actual}`);
  }
  const failed = checks.filter(c => !c.pass);
  return failed.length === 0;
}

// ── Main ───────────────────────────────────────────────────────
function main() {
  printHeader();

  const classA = simulateClass(0, 0);
  const classB = simulateClass(1, 500);

  // Per-archetype breakdown — combine both classes for more stable medians
  const combined = [...classA, ...classB];
  printPerArchetype(combined, 'Combined (30 students — 6-А + 6-Б)');

  const aggA = printClassAggregates(classA, '6-А');
  const aggB = printClassAggregates(classB, '6-Б');

  const okA = validate(aggA, '6-А');
  const okB = validate(aggB, '6-Б');

  // Overall summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  const totalDmg = aggA.totalBossDamage + aggB.totalBossDamage;
  const totalDeaths = aggA.totalDeaths + aggB.totalDeaths;
  console.log(`  Overall — both classes:`);
  console.log(`    Total boss damage:    ${totalDmg} (${pct(totalDmg, BOSS_MAX_HP_PER_CLASS * 2)})`);
  console.log(`    Total deaths:         ${totalDeaths}`);
  console.log(`    Both bosses killed:   ${okA && okB ? '✅ yes' : '❌ no'}`);

  const mean14Xp = mean(combined.map(r => r.totalXp));
  const mean14Gold = mean(combined.map(r => r.goldEarned));
  console.log(`    Mean XP per student:  ${Math.round(mean14Xp)}`);
  console.log(`    Mean gold per student: ${Math.round(mean14Gold)}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (okA && okB) {
    console.log('');
    console.log('🎉 All spec targets met — ready to launch alpha-test.');
    process.exit(0);
  } else {
    console.log('');
    console.log('⚠️  Some spec targets not met. Suggested knobs:');
    console.log('     — xp_multiplier  (currently 300%): bump for higher level / BP tier');
    console.log('     — dmg_multiplier (currently  65%): bump for more deaths, drop for fewer');
    console.log('     — boss_hp_multiplier (currently 420%): drop if boss survives, bump if dying too soon');
    process.exit(1);
  }
}

main();
