// Симулятор баланса сезонного босса

const CLASS_SIZE = 30;
const SEASON_DAYS = 90;
const TASKS_PER_DAY_PER_STUDENT = 3;

// Мок уровней учеников (для расчета урона боссу)
// Предположим базовый урон боссу = 50 + (уровень * 2) - это мы возьмем из логики grade-batch
function classDamagePerAction(level: number, dropM: number, bossHpM: number) {
  // Упрощенная модель реального урона из grade-batch
  const baseDamage = 30 + Math.floor(Math.random() * 20); // 30-50 базовый
  let totalDmg = baseDamage + (level * 2);
  
  // Примерно 20% шанс, что ученик ударит артефактом на доп урон (например 100)
  if (Math.random() < 0.2) {
    totalDmg += 100;
  }
  
  return totalDmg;
}

function simulateBossSeason(label: string, config: { dmgMultiplier: number; bossHpMultiplier: number; dropRateMultiplier: number }) {
  console.log(`\n▶ Симуляция Босса: ${label}`);
  console.log(`  Множитель HP Босса: ${config.bossHpMultiplier}%`);
  
  const HP_BASE = 5000;
  // По формуле создания сезонного босса: BASE * (учеников / 5) * (дней / 7) * множитель
  const classCountWeight = Math.max(1, CLASS_SIZE / 5); // 30/5 = 6
  const seasonDurationWeight = Math.max(1, SEASON_DAYS / 7); // 90/7 = 12.8
  
  const startingBossHp = Math.floor(HP_BASE * classCountWeight * seasonDurationWeight * (config.bossHpMultiplier / 100));
  let currentHp = startingBossHp;
  let dayKilled: number | null = null;
  
  let totalDmgDealt = 0;

  for (let day = 1; day <= SEASON_DAYS; day++) {
    let dailyDamage = 0;
    
    // Каждый ученик решает задачи
    for (let u = 0; u < CLASS_SIZE; u++) {
      const studentLevel = 10 + Math.floor(Math.random() * 20); // 10-30 lvl
      
      for (let t = 0; t < TASKS_PER_DAY_PER_STUDENT; t++) {
        // Успешное выполнение с шансом 85% (не все идеально решают)
        if (Math.random() <= 0.85) {
           dailyDamage += classDamagePerAction(studentLevel, config.dropRateMultiplier, config.bossHpMultiplier);
        }
      }
    }
    
    currentHp -= dailyDamage;
    totalDmgDealt += dailyDamage;

    if (currentHp <= 0 && dayKilled === null) {
      dayKilled = day;
      break; 
    }
  }

  console.log(`  🩸 Изначальное HP Босса: ${startingBossHp.toLocaleString()}`);
  console.log(`  ⚔️ Урон класса за всю четверть: ${totalDmgDealt.toLocaleString()}`);
  if (dayKilled) {
    console.log(`  💀 Босс УБИТ на ${dayKilled} день из ${SEASON_DAYS}!`);
    if (dayKilled < SEASON_DAYS / 2) {
       console.log('     ⚠️ ВНИМАНИЕ: Босс слишком слабый. Класс убьет его за пол-четверти.');
    }
  } else {
    console.log(`  🛡️ Босс ВЫЖИЛ! Осталось HP: ${Math.floor(currentHp).toLocaleString()} (${((currentHp/startingBossHp)*100).toFixed(1)}%)`);
    console.log('     ⚠️ ВНИМАНИЕ: Босс слишком жирный. Ученики демотивированы.');
  }
}

function main() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('👾 BOSS HP SIMULATOR (Синтетический стресс-тест)');
  console.log('═════════════════════════════════════════════════════════');

  simulateBossSeason('Стандартный Баланс (Школа Обычная)', {
    dmgMultiplier: 100,
    bossHpMultiplier: 100,
    dropRateMultiplier: 100,
  });

  simulateBossSeason('Лёгкий пресет (Boss HP x50%)', {
    dmgMultiplier: 50,
    bossHpMultiplier: 50,
    dropRateMultiplier: 200,
  });

  simulateBossSeason('Хардкор пресет (Boss HP x200%)', {
    dmgMultiplier: 200,
    bossHpMultiplier: 200,
    dropRateMultiplier: 50,
  });

  console.log('\n✅ Тестирование завершено.\n');
}

main();
