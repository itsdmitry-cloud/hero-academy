import { ARTIFACT_REGISTRY } from '../src/lib/game/artifact-registry';
import { calculateQuestResult, HeroState, PlayerArtifact, QuestResult } from '../src/lib/utils/artifacts';
import { applyXpGain } from '../src/lib/game/math';

const DB_CATALOG = ARTIFACT_REGISTRY;

// --- Simplified Drop Logic ---
function simulateRoll(heroLevel: number, difficulty: number) {
  const dropChance = 0.08 + (Math.max(1, Math.min(5, difficulty)) - 1) * 0.02; 
  const finalChance = dropChance * 1.5;

  if (Math.random() > finalChance) return null;

  const weights = [60, 30, 8, 2]; 
  const rarities = ['common', 'rare', 'epic', 'legendary'];
  let r = Math.random() * 100;
  let rarity = 'common';
  for (let i = 0; i < rarities.length; i++) {
    r -= weights[i];
    if (r <= 0) { rarity = rarities[i]; break; }
  }

  let catalog = DB_CATALOG.filter(a => a.rarity === rarity && a.req_level <= heroLevel);

  // Симуляция логики Контрольных (difficulty >= 4)
  if (difficulty >= 4) {
    catalog = catalog.filter(a => a.effect_type === 'lootbox');
  } else {
    catalog = catalog.filter(a => a.effect_type !== 'lootbox' && a.effect !== 'lootbox');
  }
  if (!catalog.length) return null;

  const totalW = catalog.reduce((sum, a) => sum + (Number(a.drop_rate) || 0.1), 0);
  let rW = Math.random() * totalW;
  let pick = catalog[0];
  for (const a of catalog) {
    rW -= (Number(a.drop_rate) || 0.1);
    if (rW <= 0) { pick = a; break; }
  }
  return pick;
}

// --- Defines ---
interface Student {
  name: string;
  archetypeId: 'xp_hoarder' | 'safe_player' | 'gold_digger';
  state: HeroState;
  inventory: PlayerArtifact[];
  stats: {
    deaths: number;
    questsDone: number;
    tasksMissed: number;
    itemsDropped: string[];
    potionsBought: number;
  };
}

function createStudent(name: string, archetypeId: 'xp_hoarder' | 'safe_player' | 'gold_digger'): Student {
  return {
    name,
    archetypeId,
    state: { hp: 100, xp: 0, gold: 0, level: 1, streak: 0, activeArtifacts: [] },
    inventory: [],
    stats: { deaths: 0, questsDone: 0, tasksMissed: 0, itemsDropped: [], potionsBought: 0 }
  };
}

function getArtifactScore(defId: string, arch: string): number {
  const def = DB_CATALOG.find(d => d.key === defId);
  if (!def) return 0;
  
  let score = 10;
  if (def.rarity === 'legendary') score += 50;
  if (def.rarity === 'epic') score += 20;

  if (arch === 'xp_hoarder' && (def.effect_type === 'xp_boost' || def.effect_code.includes('XP') || def.effect_code.includes('BOSS_MULT'))) {
    score += 500;
  }
  if (arch === 'safe_player' && (def.effect_type === 'hp_shield' || def.effect_type === 'damage_reduce' || def.effect_type === 'streak_protect' || def.effect_code.includes('DEATH'))) {
    score += 500;
  }
  if (arch === 'gold_digger' && (def.effect_type === 'gold_bonus' || def.effect_code.includes('GOLD'))) {
    score += 500;
  }

  return score;
}

async function main() {
  const students = [
    createStudent('Трайхард (Гонится за XP) - 95% Успех', 'xp_hoarder'),
    createStudent('Казуал (Бережет HP и Стрик) - 75% Успех', 'safe_player'),
    createStudent('Лентяй (Догоняет Золотом) - 50% Успех', 'gold_digger'),
  ];

  const POTION_COST = 50;
  const SUBJECTS = ['Математика', 'Русский', 'Английский'];

  console.log('═════════════════════════════════════════════════════════');
  console.log('🎒 ADVANCED ARCHETYPE SIMULATOR (90 Дней | 3 Предмета)');
  console.log('═════════════════════════════════════════════════════════');

  for (let day = 1; day <= 90; day++) {
    const isBoss = (day === 45 || day === 90);
    const isDungeon = (!isBoss && day % 7 === 0);
    
    // В день Босса или Контрольной - особый график, но для простоты симуляции:
    // Пусть 3 урока проводятся каждый день. Просто сложность меняется в зависимости от дня.
    const difficulty = isBoss ? 5 : isDungeon ? 3 : 1;

    for (const student of students) {
      // 1. Утренний чек: Если мертв, пытаемся купить зелье
      if (student.state.hp <= 0) {
        if (student.state.gold >= POTION_COST) {
          student.state.gold -= POTION_COST;
          student.state.hp = 50;
          student.stats.potionsBought++;
        } else {
          student.state.streak = 0;
          student.stats.tasksMissed += 3;
          continue; // Пропускает весь день!
        }
      }

      // 2. Настройка Экипировки (Студенты надевают лучшие предметы под свою роль)
      // Сортируем инвентарь по привлекательности предмета для архетипа
      student.inventory.sort((a, b) => getArtifactScore(b.defId, student.archetypeId) - getArtifactScore(a.defId, student.archetypeId));
      
      // Надеваем Топ-5
      student.state.activeArtifacts = student.inventory.slice(0, 5).map(i => i.id);

      for (const subject of SUBJECTS) {
        if (student.state.hp <= 0) break; // Умер на предыдущем уроке за сегодня

        const baseQuest: QuestResult = {
          baseXp: isBoss ? 500 : isDungeon ? 100 : 30 + (student.state.level * 2), // Базовый опыт растет!
          baseGold: isBoss ? 150 : isDungeon ? 30 : 10,
          baseDamage: 0,
          isBossType: isBoss,
        };

        let doQuest = false;
        let successRate = 1.0;

        if (student.archetypeId === 'xp_hoarder')  { doQuest = Math.random() < 0.95; successRate = 0.90; }
        else if (student.archetypeId === 'safe_player') { doQuest = Math.random() < 0.70; successRate = 0.75; }
        else if (student.archetypeId === 'gold_digger') { doQuest = Math.random() < 0.40; successRate = 0.50; }

        if (!doQuest && !isBoss) {
          student.state.streak = 0;
          student.stats.tasksMissed++;
          continue;
        }

        const success = Math.random() < successRate;
        let quest = { ...baseQuest };

        if (!success) {
          quest.baseXp = 0;
          quest.baseGold = 0;
          quest.baseDamage = 10 + (difficulty * 5); // 15 to 35 dmg
          quest.isCriticalMistake = Math.random() < 0.10; 
        }

        const result = calculateQuestResult(student.state, quest, student.inventory);

        // Apply Results
        if (success && !result.protectedStreak) student.state.streak += 1;
        else if (!success && !result.protectedStreak) student.state.streak = 0;

        // Level / XP changes
        const leveled = applyXpGain(student.state.xp, student.state.level, null, result.finalXp);
        student.state.xp = leveled.xp;
        student.state.level = leveled.level;
        student.state.gold += result.finalGold;
        
        // Damage
        if (result.preventedDeath) {
          student.state.hp = result.finalDamage; 
          student.stats.deaths++; 
        } else {
          student.state.hp = Math.max(0, student.state.hp - result.finalDamage);
        }
        
        if (student.state.hp <= 0 && !result.preventedDeath) {
          student.stats.deaths++;
          student.state.streak = 0;
        }
        student.stats.questsDone++;

        // Drop Check
        if (success) {
          const drop = simulateRoll(student.state.level, difficulty);
          if (drop) {
            student.stats.itemsDropped.push(drop.name);
            student.inventory.push({
              id: Math.random().toString(),
              defId: drop.key,
              is_equipped: true,
              charges_left: drop.max_charges || undefined,
            });
          }
        }

        // Remove consumed items
        student.inventory = student.inventory.filter(art => !result.artifactsUsed.includes(art.id));
      }
    }
  }

  // --- REPORT ---
  for (const s of students) {
    console.log(`\n👨‍🎓 ${s.name}`);
    console.log(`  🎖️ Итог: Уровень ${s.state.level} (${s.state.xp.toLocaleString()} XP)`);
    console.log(`  💰 Золото: ${s.state.gold.toLocaleString()} 🪙`);
    console.log(`  🩸 Смертей (опусканий до 0 HP): ${s.stats.deaths} | Куплено зелий: ${s.stats.potionsBought} | Осталось HP: ${s.state.hp}`);
    console.log(`  📈 Квестов (Уроков) выполнено: ${s.stats.questsDone} | Прогуляно: ${s.stats.tasksMissed}`);
    
    // Group dropped items
    const drops = s.stats.itemsDropped.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const dropArr = Object.entries(drops).sort((a,b) => b[1]-a[1]).map(x => `${x[0]}: ${x[1]}`);
    console.log(`  🎒 Выпало артефактов (${s.stats.itemsDropped.length} всего):`);
    console.log(`     ${dropArr.slice(0, 5).join(' | ')}${dropArr.length > 5 ? ' ...' : ''}`);

    const activeDefIds = s.state.activeArtifacts.map(id => s.inventory.find(inv => inv.id === id)?.defId).filter(Boolean);
    const activeNames = activeDefIds.map(defId => DB_CATALOG.find(d => d.key === defId)?.name);
    console.log(`  🔧 Любимая (Текущая) Экипировка Топ-5:`);
    console.log(`     ${activeNames.length > 0 ? activeNames.join(', ') : 'Инвентарь пуст'}`);
    
    if (s.state.hp <= 0 && s.state.gold < POTION_COST) {
       console.log(`  🚨 СТУДЕНТ ВЫПАЛ ИЗ ИГРЫ (0 HP, нет золота на настойку)`);
    }
  }

  console.log('\n✅ Отчет продвинутого симулятора готов.\n');
}

main();
