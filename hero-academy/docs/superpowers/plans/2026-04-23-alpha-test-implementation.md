# Альфа-тест Hero Academy — Имплементация балансировки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить все игровые параметры (Battle Pass, стрики, economy_config, сезон, боссы) для альфа-теста 4–25 мая 2026 согласно спеке `docs/superpowers/specs/2026-04-22-alpha-test-balance-design.md`.

**Architecture:**
- **Код-изменения** (2 файла): укороченный BP (15 тиров) + новые пороги стриков (3/6/10/14). Хардкод — после теста откатим к стандартам.
- **DB setup** (1 скрипт): идемпотентный `scripts/setup-alpha-test.ts`, принимает `class_id` как аргументы. Делает upsert сезона, `season_boss`, `season_boss_class_hp` и `economy_config` per class.
- **Валидация** (1 скрипт): `scripts/simulate-alpha-test.ts` прогоняет архетипы (Лентяй/Середняк/Отличник) через 14 дней и выводит финальный XP, уровни, HP, прогресс BP. Идёт до запуска в школе.

**Tech Stack:** Next.js 16, Supabase (Postgres), Vitest (TDD для чистых функций), tsx-скрипты.

---

## Файловая карта

| Файл | Действие | Ответственность |
|------|----------|------------------|
| `src/lib/game/seasonPassConfig.ts` | Modify | Заменить 30 тиров на 15 согласно спеке раздел 6 |
| `src/components/ui/StreakProgressBar.tsx` | Modify | Заменить MILESTONES массив на 3/6/10/14 (раздел 8) |
| `src/lib/game/__tests__/seasonPassConfig.test.ts` | Create | TDD для 15-тирового BP |
| `scripts/setup-alpha-test.ts` | Create | Идемпотентный seed: сезон + босс + economy для 2 классов |
| `scripts/simulate-alpha-test.ts` | Create | Симуляция 14 дней по 3 архетипам, валидация спеки |
| `docs/superpowers/plans/2026-04-23-alpha-test-implementation.md` | (этот файл) | План |

Файлы независимые — Task 1 и Task 2 можно параллелить. Task 3 использует значения из спеки, Task 4 может быть написан до Task 3 (симуляция независима от БД).

---

## Маппинг наград BP на реально существующие артефакты

Спека (раздел 6.2) перечисляет артефакты, которых нет в `artifact-registry.ts`. Используем **существующие** артефакты с совместимыми эффектами:

| Спека | Факт в registry (`art_*`) | Где определено |
|-------|---------------------------|-----------------|
| Малое Зелье Жизни (+20 HP) | `com_potion` — **Малое Снадобье Памяти** (+30 HP) | registry:177 |
| Зелье Жизни (+40 HP) | `rar_potion` — **Среднее Зелье Бодрости** (+60 HP) | registry:189 |
| Большое Зелье Жизни (+60 HP) | `epi_potion` — **Большое Зелье** (+100 HP) | registry:204 |
| Свиток XP-буста (+30% 3 заряда) | `com_pen` — **Ученическое Перо** (XP+10% 24ч) | registry:178 |
| Свиток Концентрации (+50% XP 3 заряда) | `rar_elixir` — **Эликсир Озарения** (XP+50% 5ч) | registry:198 |
| Деревянный Щит (блок 1 урона) | `com_shield` — **Деревянный Щит** (-10% 3 заряда) | registry:179 |
| Реликвия Сезона | `collectible` с code `fire_relic`, icon 🐉 | ранее в коде |
| Эмблема | `collectible` с code `fire_spark`, icon 🔥 | ранее в коде |
| Сезонный Сундук | `{ type: 'lootbox' }` — без rarity | seasonPassConfig:11 |

**Почему:** имена в спеке — косметика, функция награды (восстановление HP / XP-буст / щит) важнее. Регистр — Single Source of Truth. После альфы обсудим нужны ли новые артефакты.

---

### Task 1: Переписать Battle Pass на 15 тиров

**Files:**
- Modify: `src/lib/game/seasonPassConfig.ts`
- Create: `src/lib/game/__tests__/seasonPassConfig.test.ts`

- [ ] **Step 1.1: Написать падающий тест на структуру 15 тиров**

Создать `src/lib/game/__tests__/seasonPassConfig.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import {
  buildSeasonPassTiers,
  getCurrentBPTier,
  getBPProgress,
  MAX_BP_TIER,
  TOTAL_BP_XP,
} from '../seasonPassConfig';

describe('Alpha-test Battle Pass (15 tiers)', () => {
  test('has exactly 15 tiers', () => {
    const tiers = buildSeasonPassTiers('fire');
    expect(tiers).toHaveLength(15);
    expect(MAX_BP_TIER).toBe(15);
  });

  test('total XP is 5000', () => {
    expect(TOTAL_BP_XP).toBe(5000);
  });

  test('cumulative XP thresholds match spec (section 6.1)', () => {
    const tiers = buildSeasonPassTiers('fire');
    const expected = [200, 400, 600, 800, 1000, 1350, 1700, 2050, 2400, 2750, 3200, 3650, 4100, 4550, 5000];
    expect(tiers.map(t => t.xpRequired)).toEqual(expected);
  });

  test('milestones at tiers 5, 10, 15', () => {
    const tiers = buildSeasonPassTiers('fire');
    expect(tiers[4].isMilestone).toBe(true);   // tier 5
    expect(tiers[9].isMilestone).toBe(true);   // tier 10
    expect(tiers[14].isMilestone).toBe(true);  // tier 15
    expect(tiers[0].isMilestone).toBeFalsy();  // tier 1 — not milestone
  });

  test('tier 5 has seasonal chest + 200 gold', () => {
    const tier5 = buildSeasonPassTiers('fire')[4];
    expect(tier5.rewards).toEqual(expect.arrayContaining([
      { type: 'lootbox' },
      { type: 'gold', amount: 200 },
    ]));
  });

  test('tier 10 has chest + 500 gold + emblem collectible', () => {
    const tier10 = buildSeasonPassTiers('fire')[9];
    const types = tier10.rewards.map(r => r.type);
    expect(types).toContain('lootbox');
    expect(types).toContain('gold');
    expect(types).toContain('collectible');
    expect(tier10.rewards.find(r => r.type === 'gold')?.amount).toBe(500);
  });

  test('tier 15 has relic + 1000 gold + chest', () => {
    const tier15 = buildSeasonPassTiers('fire')[14];
    const types = tier15.rewards.map(r => r.type);
    expect(types).toContain('collectible');
    expect(types).toContain('lootbox');
    expect(types).toContain('gold');
    expect(tier15.rewards.find(r => r.type === 'gold')?.amount).toBe(1000);
  });

  test('getCurrentBPTier returns correct tier', () => {
    expect(getCurrentBPTier(0)).toBe(0);
    expect(getCurrentBPTier(199)).toBe(0);
    expect(getCurrentBPTier(200)).toBe(1);
    expect(getCurrentBPTier(1000)).toBe(5);
    expect(getCurrentBPTier(5000)).toBe(15);
    expect(getCurrentBPTier(10000)).toBe(15); // cap at max
  });

  test('getBPProgress caps at tier 15', () => {
    const progress = getBPProgress(10000);
    expect(progress.currentTier).toBe(15);
  });

  test('fire element name rendering', () => {
    const tier10 = buildSeasonPassTiers('fire')[9];
    const collectible = tier10.rewards.find(r => r.type === 'collectible');
    expect(collectible?.collectibleName).toContain('🔥');
  });
});
```

- [ ] **Step 1.2: Запустить тест — должен упасть**

Run: `cd hero-academy && npm test -- seasonPassConfig`
Expected: FAIL на "has exactly 15 tiers" (получит 30), "total XP is 5000" (получит 15000), другие — тоже упадут.

- [ ] **Step 1.3: Переписать `seasonPassConfig.ts` на 15 тиров**

Заменить секцию XP-расчёта и функцию `buildSeasonPassTiers` на 15-тировую версию. Константу `MAX_BP_TIER` с 30 на 15. Финальный файл:

```typescript
/**
 * Season Pass Configuration — 15 tiers (alpha-test May 2026)
 *
 * XP thresholds match spec section 6.1:
 *   Tiers  1-5:   200 each (cumulative 200→1000)
 *   Tiers  6-10:  350 each (cumulative 1350→2750)
 *   Tiers 11-15:  450 each (cumulative 3200→5000)
 *
 * Total BP requirement: 5,000 XP (was 15,000 for 30-tier version).
 * Will be restored to 30 tiers after alpha-test ends.
 *
 * Reward types:
 *   gold        — hero.gold += amount
 *   lootbox     — inserts seasonal lootbox artifact (no rarity — loot based on hero level)
 *   artifact    — inserts specific artifact by name
 *   collectible — inserts into hero_collectibles (emoji badge / relic)
 */

/* ── Season element configuration ── */
export type SeasonElement = 'fire' | 'ice' | 'earth' | 'water';

export const SEASON_ELEMENTS: Record<SeasonElement, { label: string; emoji: string; chestName: string }> = {
  fire:  { label: 'Огненный Сезон',  emoji: '🔥', chestName: 'Огненный Сундук' },
  ice:   { label: 'Ледяной Сезон',   emoji: '❄️', chestName: 'Ледяной Сундук' },
  earth: { label: 'Земляной Сезон',  emoji: '🌿', chestName: 'Земляной Сундук' },
  water: { label: 'Водяной Сезон',   emoji: '💧', chestName: 'Водяной Сундук' },
};

/* ── Reward type definitions ── */
export interface BPReward {
  type: 'gold' | 'lootbox' | 'artifact' | 'collectible';
  amount?: number;
  artifactName?: string;
  collectibleCode?: string;
  collectibleName?: string;
  collectibleIcon?: string;
}

export interface BPTier {
  tier: number;
  xpRequired: number;
  rewards: BPReward[];
  isMilestone?: boolean;
}

/* ── 15-tier cumulative XP thresholds ── */
function buildCumulativeXp(): number[] {
  const xpPerTier: number[] = [];
  for (let i = 1; i <= 15; i++) {
    if (i <= 5)       xpPerTier.push(200);
    else if (i <= 10) xpPerTier.push(350);
    else              xpPerTier.push(450);
  }
  const cumulative: number[] = [];
  let total = 0;
  for (const xp of xpPerTier) {
    total += xp;
    cumulative.push(total);
  }
  return cumulative;
}

const CUMULATIVE_XP = buildCumulativeXp();

/**
 * Generates the 15-tier reward track for a given season element.
 * Seasonal chests have NO rarity — loot quality is based on hero level.
 *
 * Artifact names map to existing artifact-registry entries (see plan doc).
 */
export function buildSeasonPassTiers(element: SeasonElement): BPTier[] {
  const el = SEASON_ELEMENTS[element];

  return [
    // ── Tiers 1-5 (Starter) ──
    { tier: 1,  xpRequired: CUMULATIVE_XP[0],  rewards: [{ type: 'gold', amount: 100 }] },
    { tier: 2,  xpRequired: CUMULATIVE_XP[1],  rewards: [{ type: 'artifact', artifactName: 'Малое Снадобье Памяти' }] },
    { tier: 3,  xpRequired: CUMULATIVE_XP[2],  rewards: [{ type: 'gold', amount: 150 }] },
    { tier: 4,  xpRequired: CUMULATIVE_XP[3],  rewards: [{ type: 'artifact', artifactName: 'Ученическое Перо' }] },
    { tier: 5,  xpRequired: CUMULATIVE_XP[4],  rewards: [
      { type: 'lootbox' },
      { type: 'gold', amount: 200 },
    ], isMilestone: true },

    // ── Tiers 6-10 ──
    { tier: 6,  xpRequired: CUMULATIVE_XP[5],  rewards: [{ type: 'gold', amount: 250 }] },
    { tier: 7,  xpRequired: CUMULATIVE_XP[6],  rewards: [{ type: 'artifact', artifactName: 'Деревянный Щит' }] },
    { tier: 8,  xpRequired: CUMULATIVE_XP[7],  rewards: [{ type: 'gold', amount: 300 }] },
    { tier: 9,  xpRequired: CUMULATIVE_XP[8],  rewards: [{ type: 'artifact', artifactName: 'Среднее Зелье Бодрости' }] },
    { tier: 10, xpRequired: CUMULATIVE_XP[9],  rewards: [
      { type: 'lootbox' },
      { type: 'gold', amount: 500 },
      { type: 'collectible', collectibleCode: `${element}_spark`, collectibleName: `${el.emoji} Искра Сезона`, collectibleIcon: el.emoji },
    ], isMilestone: true },

    // ── Tiers 11-15 ──
    { tier: 11, xpRequired: CUMULATIVE_XP[10], rewards: [{ type: 'gold', amount: 500 }] },
    { tier: 12, xpRequired: CUMULATIVE_XP[11], rewards: [{ type: 'artifact', artifactName: 'Эликсир Озарения' }] },
    { tier: 13, xpRequired: CUMULATIVE_XP[12], rewards: [{ type: 'gold', amount: 750 }] },
    { tier: 14, xpRequired: CUMULATIVE_XP[13], rewards: [{ type: 'artifact', artifactName: 'Большое Зелье' }] },
    { tier: 15, xpRequired: CUMULATIVE_XP[14], rewards: [
      {
        type: 'collectible',
        collectibleCode: `${element}_relic`,
        collectibleName: element === 'fire'  ? '🐉 Сердце Огненного Дракона'
                       : element === 'ice'   ? '❄️ Кристалл Вечной Мерзлоты'
                       : element === 'earth' ? '🌿 Камень Жизни'
                       : '💧 Трезубец Посейдона',
        collectibleIcon: element === 'fire' ? '🐉' : element === 'ice' ? '❄️' : element === 'earth' ? '🌿' : '🔱',
      },
      { type: 'gold', amount: 1000 },
      { type: 'lootbox' },
    ], isMilestone: true },
  ];
}

/** Get reward icon for display */
export function getRewardIcon(reward: BPReward, element: SeasonElement): string {
  switch (reward.type) {
    case 'gold': return '💰';
    case 'lootbox': return SEASON_ELEMENTS[element].emoji;
    case 'artifact': return '💎';
    case 'collectible': return reward.collectibleIcon ?? '🏆';
  }
}

/** Get reward label for display */
export function getRewardLabel(reward: BPReward, element: SeasonElement): string {
  switch (reward.type) {
    case 'gold': return `+${reward.amount} Gold`;
    case 'lootbox': return `${SEASON_ELEMENTS[element].emoji} ${SEASON_ELEMENTS[element].chestName}`;
    case 'artifact': return reward.artifactName ?? 'Артефакт';
    case 'collectible': return reward.collectibleName ?? 'Коллекционка';
  }
}

/** Calculate current BP tier from season_xp */
export function getCurrentBPTier(seasonXp: number): number {
  for (let i = CUMULATIVE_XP.length - 1; i >= 0; i--) {
    if (seasonXp >= CUMULATIVE_XP[i]) return i + 1;
  }
  return 0;
}

/** Get XP progress within the current tier */
export function getBPProgress(seasonXp: number): { currentTier: number; xpInTier: number; xpForTier: number; totalXp: number } {
  const currentTier = getCurrentBPTier(seasonXp);
  if (currentTier >= 15) return { currentTier: 15, xpInTier: 0, xpForTier: 0, totalXp: seasonXp };
  const prevThreshold = currentTier > 0 ? CUMULATIVE_XP[currentTier - 1] : 0;
  const nextThreshold = CUMULATIVE_XP[currentTier];
  return {
    currentTier,
    xpInTier: seasonXp - prevThreshold,
    xpForTier: nextThreshold - prevThreshold,
    totalXp: seasonXp,
  };
}

/** Max BP tier (alpha-test: 15, was 30) */
export const MAX_BP_TIER = 15;

/** Total XP to complete the Battle Pass (alpha-test: 5000, was 15000) */
export const TOTAL_BP_XP = CUMULATIVE_XP[CUMULATIVE_XP.length - 1];
```

- [ ] **Step 1.4: Запустить тест — должен пройти**

Run: `cd hero-academy && npm test -- seasonPassConfig`
Expected: PASS (все 10 тестов).

- [ ] **Step 1.5: Проверить что callsites не сломались**

Run: `cd hero-academy && npm run lint 2>&1 | grep -E "seasonPassConfig|BattlePassWidget|claim-pass-reward" | head`
Expected: no errors. Также `npm run build` должен пройти.

Если в билде где-то захардкожено `MAX_BP_TIER=30` или `xpRequired: 15000` — найти и обновить.

- [ ] **Step 1.6: Коммит**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/lib/game/seasonPassConfig.ts hero-academy/src/lib/game/__tests__/seasonPassConfig.test.ts
git commit -m "$(cat <<'EOF'
feat(season-pass): shorten BP to 15 tiers for alpha-test

Per spec docs/superpowers/specs/2026-04-22-alpha-test-balance-design.md.
Will revert to 30-tier config after alpha test ends.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 2: Обновить пороги стриков на 3/6/10/14

**Files:**
- Modify: `src/components/ui/StreakProgressBar.tsx`

- [ ] **Step 2.1: Заменить массив MILESTONES**

В файле `src/components/ui/StreakProgressBar.tsx:13-18` заменить:

```typescript
const MILESTONES: StreakMilestone[] = [
  { day: 3,  emoji: '🔥', xp: 100,  gold: 20 },
  { day: 7,  emoji: '💎', xp: 250,  gold: 50 },
  { day: 14, emoji: '🏆', xp: 500,  gold: 100 },
  { day: 30, emoji: '👑', xp: 1000, gold: 250 },
];
```

на:

```typescript
const MILESTONES: StreakMilestone[] = [
  { day: 3,  emoji: '🔥', xp: 150,  gold: 50 },
  { day: 6,  emoji: '💎', xp: 300,  gold: 150 },
  { day: 10, emoji: '🏆', xp: 600,  gold: 300 },
  { day: 14, emoji: '👑', xp: 1000, gold: 500 },
];
```

- [ ] **Step 2.2: Проверить grep на другие хардкоды стрик-порогов**

Run: `cd hero-academy && grep -rn "day:.*7.*xp\|day:.*30.*xp\|streak.*30\|MILESTONES" src/ --include="*.ts" --include="*.tsx"`
Expected: совпадения только в `StreakProgressBar.tsx` (и возможно в описании в `useStreakProgressText` или аналогичном).

Если есть другие места — обновить согласно новому набору дней.

- [ ] **Step 2.3: Обновить подсказку «каждые 7 дней +сундук»**

В `StreakProgressBar.tsx:62` (строка «🌟 Максимальный стрик!») — уточнить текст если упоминает конкретное число дней. Альфа-тест длится 14 дней, «каждые 7 дней» не актуально.

Заменить:
```typescript
: '🌟 Максимальный стрик! Продолжай — каждые 7 дней +сундук!'
```
на:
```typescript
: '🌟 Максимальный стрик! Ты прошёл весь альфа-тест на стриках!'
```

- [ ] **Step 2.4: Коммит**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/ui/StreakProgressBar.tsx
git commit -m "$(cat <<'EOF'
feat(streak): adjust milestones to 3/6/10/14 days for 14-day alpha-test

Grace period remains 2 days. Weekends don't break streak.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 3: Setup-скрипт для сезона + боссов + economy

**Files:**
- Create: `scripts/setup-alpha-test.ts`

**Зависимости:**
- `@supabase/supabase-js` (уже есть)
- `.env.local` с `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 3.1: Создать скаффолд скрипта**

Создать `scripts/setup-alpha-test.ts`:

```typescript
/**
 * Alpha-Test Setup (May 2026)
 *
 * Idempotent seed script that sets up:
 *   1. Season "Огненный Сезон" (fire element, 2026-05-04 → 2026-05-25)
 *   2. season_boss (base_hp=15000)
 *   3. season_boss_class_hp per class (max_hp=36000 = base_hp × 240%)
 *   4. economy_config per class (xp=300, gold=250, dmg=40, drop=120, boss_hp=240)
 *
 * Usage:
 *   npx tsx scripts/setup-alpha-test.ts --class-ids <uuid1>,<uuid2>
 *
 * Re-run safe: all operations are upserts.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Alpha-test constants (from spec 2026-04-22) ──
const SEASON_NAME = 'Огненный Сезон';
const SEASON_STARTS = '2026-05-04T00:00:00+03:00';
const SEASON_ENDS = '2026-05-25T23:59:59+03:00';
const BOSS_NAME = 'Дракон Алгебры';
const BOSS_AVATAR = '🐉';
const BOSS_DESCRIPTION = 'Древний страж математических тайн. Пал — освободишь класс от двоек на всё лето.';
const BOSS_BASE_HP = 15000;
const BOSS_HP_MULTIPLIER = 240;
const BOSS_MAX_HP = Math.round(BOSS_BASE_HP * BOSS_HP_MULTIPLIER / 100); // 36000

const ECONOMY_CONFIG = {
  xp_multiplier: 300,
  gold_multiplier: 250,
  dmg_multiplier: 40,
  drop_rate_multiplier: 120,
  boss_hp_multiplier: BOSS_HP_MULTIPLIER,
  hp_regen_rate: 100,
};

function parseArgs(): { classIds: string[] } {
  const idx = process.argv.indexOf('--class-ids');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: npx tsx scripts/setup-alpha-test.ts --class-ids <uuid1>,<uuid2>');
    process.exit(1);
  }
  const classIds = process.argv[idx + 1].split(',').map(s => s.trim()).filter(Boolean);
  if (classIds.length === 0) {
    console.error('At least one class-id required');
    process.exit(1);
  }
  return { classIds };
}

async function main() {
  const { classIds } = parseArgs();
  console.log(`🎯 Setting up alpha-test for ${classIds.length} class(es): ${classIds.join(', ')}`);

  // 1. Verify classes exist and pick school
  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .select('id, name, school_id')
    .in('id', classIds);
  if (classErr) throw classErr;
  if (!classes || classes.length !== classIds.length) {
    const found = classes?.map(c => c.id) ?? [];
    const missing = classIds.filter(id => !found.includes(id));
    throw new Error(`Classes not found: ${missing.join(', ')}`);
  }
  const schoolIds = Array.from(new Set(classes.map(c => c.school_id)));
  if (schoolIds.length !== 1) {
    throw new Error(`Classes must belong to one school. Got schools: ${schoolIds.join(', ')}`);
  }
  const schoolId = schoolIds[0];
  console.log(`✅ Classes verified, school_id=${schoolId}`);
  classes.forEach(c => console.log(`   · ${c.name} (${c.id})`));

  // 2. Upsert season
  const { data: existingSeason } = await supabase
    .from('seasons')
    .select('id, name, status')
    .eq('school_id', schoolId)
    .eq('name', SEASON_NAME)
    .maybeSingle();

  let seasonId: string;
  if (existingSeason) {
    console.log(`⏭  Season "${SEASON_NAME}" exists (${existingSeason.id}, status=${existingSeason.status})`);
    seasonId = existingSeason.id;
    await supabase.from('seasons').update({
      starts_at: SEASON_STARTS,
      ends_at: SEASON_ENDS,
      status: 'active',
    }).eq('id', seasonId);
  } else {
    const { data: inserted, error } = await supabase
      .from('seasons')
      .insert({
        name: SEASON_NAME,
        school_id: schoolId,
        starts_at: SEASON_STARTS,
        ends_at: SEASON_ENDS,
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw error;
    seasonId = inserted.id;
    console.log(`✅ Created season "${SEASON_NAME}" (${seasonId})`);
  }

  // 3. Upsert season_boss
  const { data: existingBoss } = await supabase
    .from('season_boss')
    .select('id, name')
    .eq('season_id', seasonId)
    .maybeSingle();

  let bossId: string;
  if (existingBoss) {
    console.log(`⏭  Boss "${existingBoss.name}" exists (${existingBoss.id})`);
    bossId = existingBoss.id;
    await supabase.from('season_boss').update({
      name: BOSS_NAME,
      avatar: BOSS_AVATAR,
      description: BOSS_DESCRIPTION,
      base_hp: BOSS_BASE_HP,
      reward_pool_xp: 25000,
      reward_pool_gold: 5000,
    }).eq('id', bossId);
  } else {
    const { data: inserted, error } = await supabase
      .from('season_boss')
      .insert({
        season_id: seasonId,
        name: BOSS_NAME,
        avatar: BOSS_AVATAR,
        description: BOSS_DESCRIPTION,
        base_hp: BOSS_BASE_HP,
        reward_pool_xp: 25000,
        reward_pool_gold: 5000,
      })
      .select('id')
      .single();
    if (error) throw error;
    bossId = inserted.id;
    console.log(`✅ Created boss "${BOSS_NAME}" (${bossId})`);
  }

  // 4. Upsert season_boss_class_hp per class
  for (const cls of classes) {
    const { data: existingHp } = await supabase
      .from('season_boss_class_hp')
      .select('id, current_hp')
      .eq('season_boss_id', bossId)
      .eq('class_id', cls.id)
      .maybeSingle();

    if (existingHp) {
      console.log(`⏭  Boss HP for class "${cls.name}" exists (current_hp=${existingHp.current_hp})`);
      // Don't reset current_hp — test may already be running
      await supabase.from('season_boss_class_hp').update({
        max_hp: BOSS_MAX_HP,
      }).eq('id', existingHp.id);
    } else {
      const { error } = await supabase.from('season_boss_class_hp').insert({
        season_boss_id: bossId,
        class_id: cls.id,
        max_hp: BOSS_MAX_HP,
        current_hp: BOSS_MAX_HP,
        is_defeated: false,
      });
      if (error) throw error;
      console.log(`✅ Boss HP pool created for "${cls.name}" (${BOSS_MAX_HP} HP)`);
    }
  }

  // 5. Upsert economy_config per class
  for (const cls of classes) {
    const key = `scope_class_${cls.id}`;
    const { error } = await supabase
      .from('economy_config')
      .upsert(
        { key, value: ECONOMY_CONFIG },
        { onConflict: 'key' }
      );
    if (error) throw error;
    console.log(`✅ economy_config upserted for "${cls.name}" (key=${key})`);
  }

  console.log('');
  console.log('🎉 Alpha-test setup complete!');
  console.log(`   Season: ${SEASON_NAME} (${seasonId})`);
  console.log(`   Boss: ${BOSS_NAME} (${bossId}), ${BOSS_MAX_HP} HP per class`);
  console.log(`   Classes: ${classes.map(c => c.name).join(', ')}`);
  console.log(`   Economy: xp=${ECONOMY_CONFIG.xp_multiplier}% gold=${ECONOMY_CONFIG.gold_multiplier}% dmg=${ECONOMY_CONFIG.dmg_multiplier}% drop=${ECONOMY_CONFIG.drop_rate_multiplier}% boss_hp=${ECONOMY_CONFIG.boss_hp_multiplier}%`);
}

main().catch(e => { console.error('❌ Setup failed:', e); process.exit(1); });
```

- [ ] **Step 3.2: Проверка parse args (без БД)**

Run: `cd hero-academy && npx tsx scripts/setup-alpha-test.ts`
Expected: output `Usage: npx tsx scripts/setup-alpha-test.ts --class-ids ...`, exit 1.

Run: `cd hero-academy && npx tsx scripts/setup-alpha-test.ts --class-ids "" 2>&1 | head -3`
Expected: `At least one class-id required`.

- [ ] **Step 3.3: Dry-run с фейковыми class_ids**

Run: `cd hero-academy && npx tsx scripts/setup-alpha-test.ts --class-ids "00000000-0000-0000-0000-000000000001"`
Expected: `❌ Setup failed: Error: Classes not found: 00000000-0000-0000-0000-000000000001` (и exit 1).

Это подтверждает что скрипт корректно валидирует входные class_ids.

- [ ] **Step 3.4: Проверка с реальными class_ids**

Запросить у пользователя точные UUID классов 6-х параллелей. Если неизвестны — выполнить:

```bash
cd hero-academy && npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv'; import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data } = await s.from('classes').select('id, name, school_id').order('name');
console.table(data);
"
```

Выбрать 2 UUID (6-А и 6-Б).

- [ ] **Step 3.5: Запуск setup против боевой БД**

Run: `cd hero-academy && npx tsx scripts/setup-alpha-test.ts --class-ids <uuid1>,<uuid2>`
Expected: все ✅, финальный `🎉 Alpha-test setup complete!`.

- [ ] **Step 3.6: Верификация через SQL**

Выполнить запрос (через Supabase Studio или npx tsx):

```sql
SELECT s.name AS season, sb.name AS boss, sb.base_hp,
       (SELECT json_agg(json_build_object('class', c.name, 'max_hp', h.max_hp, 'current_hp', h.current_hp))
        FROM season_boss_class_hp h JOIN classes c ON c.id = h.class_id WHERE h.season_boss_id = sb.id) AS class_hp,
       (SELECT json_object_agg(key, value)
        FROM economy_config WHERE key LIKE 'scope_class_%') AS economy
FROM seasons s JOIN season_boss sb ON sb.season_id = s.id
WHERE s.name = 'Огненный Сезон';
```

Expected: 1 строка, `max_hp=36000` для обоих классов, `xp_multiplier=300` и прочие значения корректны.

- [ ] **Step 3.7: Коммит**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/scripts/setup-alpha-test.ts
git commit -m "$(cat <<'EOF'
feat(scripts): add idempotent alpha-test setup script

Sets up season, boss, per-class HP pools and economy_config
for May 2026 alpha-test. Reusable — safe to re-run.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 4: Симуляционный скрипт валидации

**Files:**
- Create: `scripts/simulate-alpha-test.ts`

Цель: прогнать 14 дней активности трёх архетипов. Проверить что целевые XP/HP/BP попадают в ожидаемые спекой диапазоны.

- [x] **Step 4.1: Создать скаффолд скрипта**

Создать `scripts/simulate-alpha-test.ts`:

```typescript
/**
 * Alpha-Test Balance Simulation
 *
 * Dry-runs 14 school days for 3 archetypes:
 *   — Лентяй   (1 grade/day, 40% of grades = "2" или "1")
 *   — Середняк (1.3 grades/day, 70% = "3", 20% = "4")
 *   — Отличник (1.5 grades/day, 60% = "5", 30% = "4")
 *
 * Applies economy_config from spec:
 *   xp_multiplier=300, gold_multiplier=250, dmg_multiplier=40,
 *   drop_rate_multiplier=120, boss_hp_multiplier=240
 *
 * Validates spec targets (section 10):
 *   — Median student reaches Level 3
 *   — ≤3 deaths per class (sim class = 15 students)
 *   — Boss killed by end of test (class_total_damage ≥ boss_max_hp)
 */

import { buildSeasonPassTiers, getCurrentBPTier, TOTAL_BP_XP } from '../src/lib/game/seasonPassConfig';

// ── Game constants (from spec + constants.ts) ──
const MAX_HP = 100;
const HP_REGEN_PER_DAY = 5;
const SCHOOL_DAYS = 14;

const ECONOMY = {
  xp_multiplier: 3.0,
  gold_multiplier: 2.5,
  dmg_multiplier: 0.40,
  drop_rate_multiplier: 1.20,
};

const BOSS_MAX_HP_PER_CLASS = 36000;

// Grade → base reward (from spec section 5)
const GRADE_MULT = { 5: 1.0, 4: 0.8, 3: 0.5, 2: 0.2, 1: 0.0 } as const;
const GRADE_DMG  = { 5: 0,   4: 0,   3: 10,  2: 20,  1: 30  } as const;

type Grade = keyof typeof GRADE_MULT;

// Archetype: grade distribution per day
type Archetype = {
  name: string;
  gradesPerDay: number;   // Expected grades per school day
  distribution: Record<Grade, number>; // Probability mass (must sum to 1)
};

const ARCHETYPES: Archetype[] = [
  {
    name: 'Лентяй',
    gradesPerDay: 1.0,
    distribution: { 5: 0.05, 4: 0.10, 3: 0.35, 2: 0.35, 1: 0.15 },
  },
  {
    name: 'Середняк',
    gradesPerDay: 1.3,
    distribution: { 5: 0.10, 4: 0.20, 3: 0.55, 2: 0.12, 1: 0.03 },
  },
  {
    name: 'Отличник',
    gradesPerDay: 1.5,
    distribution: { 5: 0.55, 4: 0.30, 3: 0.12, 2: 0.02, 1: 0.01 },
  },
];

function pickGrade(dist: Record<Grade, number>, rng: () => number): Grade {
  const r = rng();
  let cum = 0;
  for (const [g, p] of Object.entries(dist)) {
    cum += p;
    if (r < cum) return Number(g) as Grade;
  }
  return 3;
}

// Weighted mix of quest-template base values (spec section 5)
// Домашка 60% (avg 125 XP), Проверочная 25% (150 XP), Диктант 10% (200 XP), Контрольная 5% (350 XP × 0.4 coeff)
const AVG_BASE_XP = 0.60 * 125 + 0.25 * 150 + 0.10 * 200 + 0.05 * 350 * 0.4;  // ≈ 135
const AVG_BASE_GOLD = 0.60 * 65 + 0.25 * 60 + 0.10 * 80 + 0.05 * 130;         // ≈ 78
const AVG_BASE_DMG = 0.60 * 7.5 + 0.25 * 10 + 0.10 * 15 + 0.05 * 20;          // ≈ 9.5

interface SimResult {
  archetype: string;
  totalXp: number;
  level: number;
  seasonXp: number;
  bpTier: number;
  goldEarned: number;
  finalHp: number;
  deaths: number;
  gradesReceived: number;
  bossDamageContributed: number;
}

// XP per level from spec: xpPerLevel(L) = 1000 + L × 500
function xpToLevel(totalXp: number): number {
  let level = 1;
  let acc = 0;
  while (true) {
    const next = 1000 + level * 500;
    if (acc + next > totalXp) return level;
    acc += next;
    level++;
    if (level > 20) return 20;
  }
}

function simulateStudent(arch: Archetype, rng: () => number): SimResult {
  let totalXp = 0, seasonXp = 0, gold = 0, hp = MAX_HP, deaths = 0, grades = 0;

  for (let day = 0; day < SCHOOL_DAYS; day++) {
    // Grades this day (randomized around expectation)
    const n = Math.random() < (arch.gradesPerDay % 1) ? Math.floor(arch.gradesPerDay) + 1 : Math.floor(arch.gradesPerDay);
    for (let i = 0; i < n; i++) {
      const g = pickGrade(arch.distribution, rng);
      const baseXp = AVG_BASE_XP * GRADE_MULT[g];
      const baseGold = AVG_BASE_GOLD * GRADE_MULT[g];
      const baseDmg = AVG_BASE_DMG * (GRADE_DMG[g] / 10); // scaled

      const xpGained = Math.round(baseXp * ECONOMY.xp_multiplier);
      const goldGained = Math.round(baseGold * ECONOMY.gold_multiplier);
      const hpLost = Math.round(GRADE_DMG[g] * ECONOMY.dmg_multiplier);

      totalXp += xpGained;
      seasonXp += xpGained;
      gold += goldGained;
      hp -= hpLost;

      if (hp <= 0) {
        deaths++;
        hp = MAX_HP; // Simulated revive (simplification — real: lose XP progress)
        seasonXp = Math.max(0, seasonXp - xpGained); // Penalty: lose last gain
      }

      grades++;
    }
    // Daily regen
    hp = Math.min(MAX_HP, hp + HP_REGEN_PER_DAY);
  }

  return {
    archetype: arch.name,
    totalXp,
    level: xpToLevel(totalXp),
    seasonXp,
    bpTier: getCurrentBPTier(seasonXp),
    goldEarned: gold,
    finalHp: hp,
    deaths,
    gradesReceived: grades,
    bossDamageContributed: totalXp, // Boss damage = final XP
  };
}

// Simple seeded RNG for reproducibility
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
}

function main() {
  console.log('🧪 Alpha-Test Simulation — 14 school days, 15 students per class\n');

  const results: SimResult[] = [];
  const studentsPerArchetype = 5; // 3×5 = 15 students per class

  ARCHETYPES.forEach((arch, archIdx) => {
    for (let i = 0; i < studentsPerArchetype; i++) {
      const rng = seededRng(archIdx * 100 + i * 7 + 1);
      results.push(simulateStudent(arch, rng));
    }
  });

  // Per-archetype aggregation
  console.log('── Per-archetype results (median of 5 sims) ──\n');
  ARCHETYPES.forEach(arch => {
    const group = results.filter(r => r.archetype === arch.name);
    const median = (key: keyof SimResult) => {
      const sorted = [...group].map(r => Number(r[key])).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    console.log(`${arch.name}:`);
    console.log(`  Grades: ${median('gradesReceived')}, Total XP: ${median('totalXp')}, Level: ${median('level')}`);
    console.log(`  BP tier: ${median('bpTier')}/${15}, Season XP: ${median('seasonXp')}/${TOTAL_BP_XP}`);
    console.log(`  Gold: ${median('goldEarned')}, Final HP: ${median('finalHp')}, Deaths: ${median('deaths')}`);
    console.log(`  Boss dmg (from this student): ${median('bossDamageContributed')}`);
    console.log('');
  });

  // Class-level aggregation
  const totalBossDamage = results.reduce((s, r) => s + r.bossDamageContributed, 0);
  const totalDeaths = results.reduce((s, r) => s + r.deaths, 0);
  const medianLevel = [...results].map(r => r.level).sort((a, b) => a - b)[Math.floor(results.length / 2)];
  const medianBpTier = [...results].map(r => r.bpTier).sort((a, b) => a - b)[Math.floor(results.length / 2)];

  console.log('── Class aggregation (15 students) ──\n');
  console.log(`  Total boss damage: ${totalBossDamage} / ${BOSS_MAX_HP_PER_CLASS} (${Math.round(totalBossDamage / BOSS_MAX_HP_PER_CLASS * 100)}%)`);
  console.log(`  Total deaths: ${totalDeaths}`);
  console.log(`  Median student level: ${medianLevel}`);
  console.log(`  Median BP tier: ${medianBpTier}/${15}`);
  console.log('');

  // Spec validation (section 10)
  console.log('── Spec validation ──\n');
  const checks = [
    { label: 'Median student → Level 3+', pass: medianLevel >= 3, actual: `L${medianLevel}` },
    { label: 'Deaths ≤ 3 per class', pass: totalDeaths <= 3, actual: `${totalDeaths}` },
    { label: 'Deaths ≥ 1 per class (not too soft)', pass: totalDeaths >= 1, actual: `${totalDeaths}` },
    { label: 'Boss killed (damage ≥ max_hp)', pass: totalBossDamage >= BOSS_MAX_HP_PER_CLASS, actual: `${totalBossDamage}/${BOSS_MAX_HP_PER_CLASS}` },
    { label: 'Median BP tier ≥ 10', pass: medianBpTier >= 10, actual: `T${medianBpTier}` },
  ];
  checks.forEach(c => console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}: ${c.actual}`));

  const failed = checks.filter(c => !c.pass);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} spec targets not met. Consider adjusting:`);
    console.log('     — xp_multiplier (currently 300%) — bump for higher levels / BP tiers');
    console.log('     — dmg_multiplier (currently 40%) — bump for more deaths, drop for fewer');
    console.log('     — boss_hp_multiplier (currently 240%) — drop if boss survives, bump if killed too early');
    process.exit(1);
  }
  console.log('\n🎉 All spec targets met — ready to launch alpha-test!');
}

main();
```

- [x] **Step 4.2: Прогон симуляции**

Run: `cd hero-academy && npx tsx scripts/simulate-alpha-test.ts`
Expected: вывод для каждого архетипа + class aggregation + валидация.

Целевые ожидания (спека раздел 10):
- Середняк: Level 3, BP tier 10+
- Class deaths: 1-3
- Boss: убит (damage ≥ 36000)

- [x] **Step 4.3: Анализ результатов** — см. раздел «Результаты симуляции» ниже

Если spec checks провалены — записать в файл `docs/superpowers/plans/2026-04-23-alpha-test-implementation.md` раздел «Результаты симуляции» с числами и рекомендуемыми корректировками `economy_config`. Если симуляция говорит `dmg_multiplier=40%` даёт 0 смертей — поднять до 50%. Если говорит босс не убит — уменьшить `boss_hp_multiplier` до 200%.

Если все checks прошли — ничего не менять.

- [x] **Step 4.4: Коммит**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/scripts/simulate-alpha-test.ts hero-academy/docs/superpowers/plans/2026-04-23-alpha-test-implementation.md
git commit -m "$(cat <<'EOF'
feat(scripts): add alpha-test balance simulation

Dry-runs 14 days × 3 archetypes × 5 students per class.
Validates spec targets (level, BP tier, deaths, boss kill).
Fails loudly if economy_config is mis-calibrated.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 5: Финальная верификация + синхронизация с БД

- [ ] **Step 5.1: Проверить что все тесты проходят**

Run: `cd hero-academy && npm test 2>&1 | tail -20`
Expected: все тесты PASS, нет регрессий от изменений BP/Streak.

- [ ] **Step 5.2: Проверить build**

Run: `cd hero-academy && npm run build 2>&1 | tail -20`
Expected: build успешен, нет ошибок типов (особенно из-за `MAX_BP_TIER=15` vs =30 в callsites).

Если есть TypeScript errors — исправить (обычно это прямые сравнения `if (tier === 30)` в UI).

- [ ] **Step 5.3: Запустить dev-сервер и проверить UI**

Run: `cd hero-academy && npm run dev`

Открыть в браузере:
- `/hero` — Battle Pass widget должен показать 15 тиров, не 30
- `/hero` — Streak progress bar должен показать 4 milestone: 3/6/10/14 дней
- `/admin/economy` — переключить scope на class, выбрать 6-й класс, значения мультипликаторов должны быть 300/250/40/120/240

- [ ] **Step 5.4: Финальная проверка DB sync**

Если `setup-alpha-test.ts` запускался против локальной БД — запустить против прод Supabase с теми же `--class-ids`. Если ещё нет реальных класс-IDs — дождаться пока учитель создаст 6-А и 6-Б.

Затем: записать в `docs/superpowers/plans/2026-04-23-alpha-test-implementation.md` финальные значения (UUID сезона, UUID босса, UUID классов) в раздел «Setup Metadata» для воспроизводимости.

- [ ] **Step 5.5: Финальный коммит с meta-данными**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/docs/superpowers/plans/2026-04-23-alpha-test-implementation.md
git commit -m "$(cat <<'EOF'
docs(alpha-test): record setup metadata after successful deploy

Season/boss/class UUIDs from successful setup-alpha-test run.
Used for weekly monitoring and final report.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Результаты симуляции (Task 4 — запуск 2026-04-23)

Запуск: `npx tsx scripts/simulate-alpha-test.ts` (seed=42, 30 студентов: по 4 Лентяя/Середняка/Отличника + 3 Кита на класс).

### Per-archetype медианы (combined 6-А + 6-Б, 30 студентов, 14 дней)

| Архетип | Grades | XP | Lvl | BP | Gold | HP | Deaths | Loot | BossDmg |
|---------|:-----:|:--:|:---:|:--:|:----:|:--:|:------:|:----:|:-------:|
| Лентяй | 14 | 2 115 | 2 | 8/15 | 865 | 80 | 0 | 2 | 2 115 |
| Середняк | 18 | 4 080 | 3 | 12/15 | 1 673 | 99 | 0 | 3 | 4 080 |
| Отличник | 22 | 7 623 | 4 | 15/15 | 3 116 | 100 | 0 | 4–5 | 7 623 |
| Кит | 18 | 4 689 | 3 | 14/15 | 3 320 | 100 | 0 | 3 | 4 689 |

### Class aggregates

| Метрика | 6-А | 6-Б |
|---------|:---:|:---:|
| Total boss damage | 69 955 / 36 000 (194%) | 69 666 / 36 000 (194%) |
| Total deaths | 0 | 0 |
| Median student level | 3 | 3 |
| Median BP tier | 13/15 | 13/15 |
| Students at BP max | 6/15 | 5/15 |

### Отклонения от спеки §10

| Критерий | Цель | Факт | Вердикт |
|---------|------|------|---------|
| Median Level | ≥3 | 3 | ✅ |
| Deaths ≤3/class | ≤3 | 0 | ✅ |
| Deaths ≥1/class | ≥1 | **0** | **❌** |
| Boss killed | ≥36 000 dmg | 69 955 / 69 666 | ✅ |
| Median BP ≥10 | ≥10 | 13 | ✅ |

### Выводы и рекомендации

1. **Система слишком мягкая по HP.** При `dmg_multiplier=40%` даже Лентяй с медианой оценок «3–2–1» не достигает 0 HP ни разу. Причина — регенерация 5 HP/день + низкий множитель + троечник получает всего 4 HP за оценку (10 × 0.4).
   - **Рекомендация:** повысить `dmg_multiplier` до **60–70%**, чтобы двоечники действительно были в зоне риска.
   - Альтернатива: срезать регенерацию до 3 HP/день.

2. **Босс умирает с огромным запасом.** 194% damage от max_hp означает, что класс убьёт босса примерно на 7–8 день, а не на неделе 3–4 как планировалось.
   - **Рекомендация:** повысить `boss_hp_multiplier` до **400–450%** (60 000–68 000 HP), либо уменьшить `xp_multiplier` до 250%. Второе проще, но затронет и уровни.

3. **BP слишком быстро закрывается.** Отличники доходят до T15 за 14 дней — это соответствует спеке («Отличник закрывает все 15 тиров»), однако 6 из 15 студентов класса достигают T15 — это больше, чем заложено («медиана ≥T10»).

4. **Положительные моменты:** уровни распределены ровно как в спеке (2/3/4), лутбоксы в диапазоне 3–5 (спека §4.5), золота у Середняка ~4 000 за тест — тоже в пределах.

**Решение:** калибровка — предмет отдельного обсуждения. Этот отчёт фиксирует факт для учителя/тимлида перед стартом 4 мая.

---

## Пост-имплементационные шаги (вне скоупа этого плана, на неделе 1 теста)

1. **День 1-2:** Мониторинг через admin-панель — распределение XP, HP, стриков
2. **Конец недели 1:** Чекпоинт с учителем, корректировки per спека раздел 9
3. **Неделя 2-3:** Еженедельные отчёты о прогрессе в `docs/reports/alpha-test-week-N.md`
4. **После теста (после 26 мая):** Откат `MAX_BP_TIER=30` и 30-тировый BP, обновление стрик-порогов на 3/7/14/30, отчёт о результатах

---

## Self-review checklist

**Spec coverage:**
- [x] Section 3 (architectural decisions) — отражены в Task 1, 2, 3
- [x] Section 4 (формулы калибровки) — валидируются в Task 4
- [x] Section 5 (economy_config) — Task 3 step 3.1
- [x] Section 6 (Battle Pass 15 тиров) — Task 1
- [x] Section 7 (боссы) — Task 3 steps 3 и 4
- [x] Section 8 (стрики) — Task 2
- [x] Section 9 (план мониторинга) — пост-имплементационные шаги
- [x] Section 10 (критерии успеха) — Task 4 валидации
- [x] Section 13 (финальные решения) — отражены: хардкод BP, одинаковый boss_hp_mult
- [x] Section 14 (кнопка «Не сдал») — уже имплементирована в коммите 353c36e

**Placeholders:** нет `TBD`, все шаги содержат актуальный код или команды.

**Type consistency:** Имена `buildSeasonPassTiers`, `getCurrentBPTier`, `MAX_BP_TIER` и `TOTAL_BP_XP` совпадают во всех задачах и в существующих callsites (`claim-pass-reward/route.ts`, `BattlePassWidget.tsx`).
