# Уплощение кривой уровней под альфу — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Уплостить кривую уровней так, чтобы за 14 уроков альфы Лентяй открывал 3-й слот (Lv 6), Середняк — 4-й (Lv 10), Отличник — 5-й (Lv 15+).

**Architecture:** Изменение чисто в `hero-academy/src/lib/game/math.ts` — формулы `xpPerLevel` и `cumulativeXpForLevel` (одна функция-подсчёт, одна функция-стоимость). Модель данных, БД, конфиг экономики — не трогаются. Существующие потребители (`alphaSimulation.ts`, API-роуты, store) автоматически получают новые числа через `applyXpGain` / `cumulativeXpForLevel`.

**Tech Stack:** TypeScript, Vitest (unit-тесты), Next.js (runtime), Supabase (только чтение, БД не пишется этой задачей).

**Spec:** [`docs/superpowers/specs/2026-05-05-alpha-level-curve-flatten-design.md`](../specs/2026-05-05-alpha-level-curve-flatten-design.md)

---

## Files Affected

| Файл | Что меняется |
|---|---|
| `hero-academy/src/lib/game/math.ts` | Формулы `xpPerLevel`, `cumulativeXpForLevel` + комментарий-маркер строк 17–20 |
| `hero-academy/src/lib/game/mechanics.test.ts` | Все hard-coded числа в `cumulativeXpForLevel`, `xpPerLevel`, `xpProgress`, `applyXpGain` тестах |
| `hero-academy/src/lib/game/__tests__/alphaSimulation.test.ts` | Hard-coded XP→level пороги в `xpToLevel` тестах (строки 16-33) |
| `hero-academy/src/lib/game/alphaSimulation.ts` | Комментарии-документация (строки 11, 119-121) — формула устарела ещё с коммита `0f3af7b`, чиним заодно |
| `/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/MEMORY.md` + новый `feedback_alpha_curve_revert.md` | Запомнить дату планируемого отката |

**Не трогаем:**
- `hero-academy/src/lib/game/constants.ts` — XP-функции тут только реэкспортятся из math.ts
- БД, миграции, `economy_config` — формула нигде не сериализована
- `applyXpGain` — алгоритм работает с любой монотонной кривой через while-цикл
- `avatarTier` — формула `Math.floor(L/5)+1` корректна на любой шкале

---

## Reference: новые значения

**Формула:** `xpPerLevel(L) = 150 + 100·L`, `cumulativeXpForLevel(L) = (L-1)(150 + 50L)`

| L  | cumul (новое) | L  | cumul (новое) |
|---:|---:|---:|---:|
| 2  | 250   | 8  | 3 850  |
| 3  | 600   | 9  | 4 800  |
| 4  | 1 050 | 10 | 5 850  |
| 5  | 1 600 | 11 | 7 000  |
| 6  | 2 250 | 12 | 8 250  |
| 7  | 3 000 | 15 | 12 600 |

| L | xpPerLevel | L | xpPerLevel |
|---:|---:|---:|---:|
| 1 | 250 | 5 | 650 |
| 2 | 350 | 10 | 1 150 |

---

## Task 1: Pre-flight snapshot

**Files:**
- Read only: `hero-academy/src/lib/game/math.ts`, `hero-academy/src/lib/game/mechanics.test.ts`, `hero-academy/src/lib/game/__tests__/alphaSimulation.test.ts`, `hero-academy/src/lib/game/alphaSimulation.ts`

- [ ] **Step 1: Запустить существующие тесты — убедиться, что всё зелёное на старой кривой**

Run:
```bash
cd "/Users/macbookm/Hero academy/hero-academy" && npm test -- --run src/lib/game/mechanics.test.ts src/lib/game/__tests__/alphaSimulation.test.ts
```
Expected: PASS (все тесты на старой кривой `(L-1)(500 + 125L)`).

- [ ] **Step 2: Зафиксировать текущий git status**

Run: `cd "/Users/macbookm/Hero academy" && git status -s`
Expected: ровно две модификации `hero-academy/src/components/debug/DebugPanel.tsx` и `hero-academy/src/lib/game/constants.ts` (фоновые, не относящиеся к этой задаче — оставляем как есть).

---

## Task 2: TDD Red — переписать unit-тесты в `mechanics.test.ts` под новую кривую

**Files:**
- Modify: `hero-academy/src/lib/game/mechanics.test.ts`

- [ ] **Step 1: Заменить блок `describe('cumulativeXpForLevel')`**

Найти `describe('cumulativeXpForLevel', () => {` (~строка 18) и заменить весь блок на:

```ts
describe('cumulativeXpForLevel', () => {
  it('Level 1 требует 0 XP (начальная точка)', () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
  });

  it('Level 2 требует 250 XP (alpha 2026-05 — кривая ×0.4 от старой)', () => {
    // formula: (2-1) * (150 + 50*2) = 1 * 250 = 250
    expect(cumulativeXpForLevel(2)).toBe(250);
  });

  it('Level 3 требует 600 XP', () => {
    // formula: (3-1) * (150 + 50*3) = 2 * 300 = 600
    expect(cumulativeXpForLevel(3)).toBe(600);
  });

  it('Level 6 требует 2250 XP (3-й слот артефактов — порог Лентяя)', () => {
    // formula: (6-1) * (150 + 50*6) = 5 * 450 = 2250
    expect(cumulativeXpForLevel(6)).toBe(2250);
  });

  it('Level 10 требует 5850 XP (4-й слот — порог Середняка)', () => {
    // formula: (10-1) * (150 + 50*10) = 9 * 650 = 5850
    expect(cumulativeXpForLevel(10)).toBe(5850);
  });

  it('Level 15 требует 12600 XP (5-й слот — порог Отличника)', () => {
    // formula: (15-1) * (150 + 50*15) = 14 * 900 = 12600
    expect(cumulativeXpForLevel(15)).toBe(12600);
  });

  it('Порог на каждый следующий уровень растёт (нет плоских участков)', () => {
    for (let lvl = 2; lvl <= 30; lvl++) {
      expect(cumulativeXpForLevel(lvl)).toBeGreaterThan(cumulativeXpForLevel(lvl - 1));
    }
  });
});
```

- [ ] **Step 2: Заменить блок `describe('xpPerLevel')`**

Найти `describe('xpPerLevel', () => {` (~строка 53) и заменить весь блок на:

```ts
describe('xpPerLevel', () => {
  it('Level 1→2 стоит 250 XP', () => {
    expect(xpPerLevel(1)).toBe(250);
  });

  it('Level 2→3 стоит 350 XP', () => {
    expect(xpPerLevel(2)).toBe(350);
  });

  it('Level 10→11 стоит 1150 XP', () => {
    expect(xpPerLevel(10)).toBe(1150);
  });

  it('Стоимость уровней монотонно растёт', () => {
    for (let i = 1; i < 50; i++) {
      expect(xpPerLevel(i + 1)).toBeGreaterThan(xpPerLevel(i));
    }
  });
});
```

- [ ] **Step 3: Обновить инлайн-комментарии в блоке `describe('xpProgress')`**

Найти `const lvl = 3;` в тесте «50% прогресса» (~строка 92) и заменить три комментария:

```ts
  it('Герой с ровно половиной XP до следующего уровня → 50%', () => {
    const lvl = 3;
    const floor = cumulativeXpForLevel(lvl);     // 600
    const ceil  = cumulativeXpForLevel(lvl + 1); // 1050
    const halfwayXp = floor + (ceil - floor) / 2; // 825
    const { percent } = xpProgress(halfwayXp, lvl);
    expect(percent).toBe(50);
  });
```

(Ассерт `expect(percent).toBe(50)` остаётся — он property-based, корректен на любой кривой.)

- [ ] **Step 4: Заменить блок `describe('applyXpGain')`**

Найти `describe('applyXpGain', () => {` (~строка 117) и заменить весь блок на:

```ts
describe('applyXpGain', () => {
  it('Небольшой XP не вызывает level-up', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 100);
    expect(level).toBe(1);
    expect(levelUps).toHaveLength(0);
  });

  it('Ровно 250 XP поднимает уровень с 1 до 2', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 250);
    expect(level).toBe(2);
    expect(levelUps).toEqual([2]);
  });

  it('600 XP с нуля → сразу уровень 3 (двойной level-up)', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 600);
    expect(level).toBe(3);
    expect(levelUps).toEqual([2, 3]);
  });

  it('XP суммируется нарастающим итогом (не сбрасывается)', () => {
    // Начинаем с 200 XP (почти Lv 2 — порог 250), добавляем 100 → 300 → Lv 2
    const { xp, level } = applyXpGain(200, 1, null, 100);
    expect(xp).toBe(300);
    expect(level).toBe(2);
  });

  it('5850 XP с нуля → ровно Lv 10 (4-й слот артефактов)', () => {
    const { level, levelUps } = applyXpGain(0, 1, null, 5850);
    expect(level).toBe(10);
    expect(levelUps).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('xpNext соответствует cumulativeXpForLevel(level+1)', () => {
    const { level, xpNext } = applyXpGain(0, 1, null, 5000);
    expect(xpNext).toBe(cumulativeXpForLevel(level + 1));
  });
});
```

- [ ] **Step 5: Запустить mechanics.test.ts — должен FAIL (формула ещё старая)**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npm test -- --run src/lib/game/mechanics.test.ts`
Expected: **FAIL** во всех новых ассертах. Например: `expected 750 to be 250` в `cumulativeXpForLevel(2)`.

Это нужный red-state — переходим к Task 3.

---

## Task 3: TDD Red — переписать пороги в `alphaSimulation.test.ts`

**Files:**
- Modify: `hero-academy/src/lib/game/__tests__/alphaSimulation.test.ts`

- [ ] **Step 1: Заменить блок тестов `xpToLevel` (строки 12-40)**

Найти первый `test('xpToLevel: 0 XP → Level 1'` и заменить пять тестов `xpToLevel: …` (включая «caps at reasonable upper bound») на:

```ts
  test('xpToLevel: 0 XP → Level 1', () => {
    expect(xpToLevel(0)).toBe(1);
  });

  test('xpToLevel: 250 XP → Level 2 (alpha 2026-05 — кривая ×0.4 от старой)', () => {
    // cumulativeXpForLevel(2) = 1 × (150 + 100) = 250
    expect(xpToLevel(249)).toBe(1);
    expect(xpToLevel(250)).toBe(2);
  });

  test('xpToLevel: 600 XP → Level 3', () => {
    expect(xpToLevel(599)).toBe(2);
    expect(xpToLevel(600)).toBe(3);
  });

  test('xpToLevel: 2250 XP → Level 6 (3-й слот артефактов)', () => {
    expect(xpToLevel(2249)).toBe(5);
    expect(xpToLevel(2250)).toBe(6);
  });

  test('xpToLevel: 5850 XP → Level 10 (4-й слот артефактов)', () => {
    expect(xpToLevel(5850)).toBe(10);
  });

  test('xpToLevel: 12600 XP → Level 15 (5-й слот артефактов)', () => {
    expect(xpToLevel(12600)).toBe(15);
  });

  test('xpToLevel: caps at reasonable upper bound (huge XP)', () => {
    const lvl = xpToLevel(10_000_000);
    expect(lvl).toBeGreaterThanOrEqual(20);
    expect(lvl).toBeLessThanOrEqual(100);
  });
```

- [ ] **Step 2: Обновить ассерт в тесте «Отличник reaches at least Level 3»**

Найти `test('simulateStudent: Отличник reaches at least Level 3 with top XP'` (~строка 72) и поменять тело на (новая цель — Lv 15, поскольку кривая стала ещё более мягкой):

```ts
  test('simulateStudent: Отличник reaches Lv 15+ (5-й слот артефактов)', () => {
    const otlichnik = ARCHETYPES.find(a => a.name === 'Отличник')!;
    // Seeded rng for reproducibility — shared LCG from alphaSimulation
    const rng = seededRng(42);
    const result = simulateStudent(otlichnik, rng);
    expect(result.level).toBeGreaterThanOrEqual(15);
    expect(result.totalXp).toBeGreaterThan(12600); // alpha 2026-05 — Lv 15 порог
    expect(result.gradesReceived).toBeGreaterThan(10);
  });
```

- [ ] **Step 3: Запустить alphaSimulation.test.ts — должен FAIL**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npm test -- --run src/lib/game/__tests__/alphaSimulation.test.ts`
Expected: **FAIL** на новых ассертах `xpToLevel(250)→Lv 2` (получит Lv 1 при старой формуле, потому что старый порог Lv 2 = 750).

---

## Task 4: TDD Green — обновить формулу в `math.ts`

**Files:**
- Modify: `hero-academy/src/lib/game/math.ts`

- [ ] **Step 1: Обновить формулы и комментарий-маркер (строки 17–32)**

Заменить блок:
```ts
// ─── Level / XP ──────────────────────────────────────────────
// Alpha-test май 2026: кривая урезана вдвое, чтобы за 14 уроков
// ученики достигали Lv 15-18 (визуальная цель — несколько эволюций
// аватара, полное закрытие BP). После альфы откатить на 1000 + L×500.

/** XP cost for ONE level (e.g. level 1→2 costs 750) */
export function xpPerLevel(level: number): number {
  return 500 + level * 250;
}

/** Total cumulative XP needed to REACH a given level.
 *  cumulativeXpForLevel(1) = 0, cumulativeXpForLevel(2) = 750, etc. */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (500 + 125 * level);
}
```

на:

```ts
// ─── Level / XP ──────────────────────────────────────────────
// Alpha-test май 2026 (вторая итерация — spec 2026-05-05):
// кривая ×0.4 от старой, чтобы за 14 уроков Лентяй открывал 3-й слот
// артефактов (Lv 6 = 2 250 XP), Середняк — 4-й (Lv 10 = 5 850 XP),
// Отличник — 5-й (Lv 15 = 12 600 XP).
// После альфы (≥ 2026-05-26) откатить на: 500 + L*250 (предыдущая
// калибровка) или 1000 + L*500 (исходная, до альфы).

/** XP cost for ONE level (e.g. level 1→2 costs 250) */
export function xpPerLevel(level: number): number {
  return 150 + level * 100;
}

/** Total cumulative XP needed to REACH a given level.
 *  cumulativeXpForLevel(1) = 0, cumulativeXpForLevel(2) = 250, etc. */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (150 + 50 * level);
}
```

- [ ] **Step 2: Прогнать оба test-файла — должны PASS**

Run:
```bash
cd "/Users/macbookm/Hero academy/hero-academy" && npm test -- --run src/lib/game/mechanics.test.ts src/lib/game/__tests__/alphaSimulation.test.ts
```
Expected: **PASS** все тесты в обоих файлах. Если что-то падает — пересчитать значения по формуле `(L-1)(150 + 50L)` и поправить.

---

## Task 5: Обновить устаревшие комментарии в `alphaSimulation.ts`

**Files:**
- Modify: `hero-academy/src/lib/game/alphaSimulation.ts`

(Эти комментарии устарели ещё с коммита `0f3af7b` — там кривую урезали, но docstring не обновили. Чиним заодно, пока работаем в этом файле.)

- [ ] **Step 1: Обновить комментарий на строке 11 в JSDoc-блоке**

Найти строку `*   — xpPerLevel(L) = 1000 + L × 500 (см. src/lib/game/math.ts)` (строка 11) и заменить на:

```ts
 *   — xpPerLevel(L) = 150 + L × 100  (alpha 2026-05; см. src/lib/game/math.ts)
```

- [ ] **Step 2: Обновить комментарий перед функцией `xpToLevel` (строки 117-121)**

Найти блок:
```ts
// ── Level calculation ──────────────────────────────────────────
/**
 * Convert total XP to level using the canonical curve.
 * xpPerLevel(L) = 1000 + L × 500  =>  cumulativeXpForLevel(L) = (L-1) × (1000 + 250 × L)
 */
```

Заменить на:
```ts
// ── Level calculation ──────────────────────────────────────────
/**
 * Convert total XP to level using the canonical curve.
 * xpPerLevel(L) = 150 + L × 100  =>  cumulativeXpForLevel(L) = (L-1) × (150 + 50 × L)
 */
```

- [ ] **Step 3: Запустить alphaSimulation.test.ts ещё раз — убедиться, что ничего не сломалось**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npm test -- --run src/lib/game/__tests__/alphaSimulation.test.ts`
Expected: **PASS** (это были только комментарии, на поведение не влияет).

---

## Task 6: Полная проверка — весь test-suite + build + симуляция

**Files:** none (только запуск)

- [ ] **Step 1: Запустить весь vitest**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npm test -- --run`
Expected: **PASS все файлы**. Если что-то ещё в репо хардкодит старые XP-числа (например boss-hp.test.ts или artifacts.test.ts) — будет видно. Если упадёт — посмотреть на failing assert: либо это property-test, который теперь нерелевантен (тогда обновить), либо несвязанный hardcode (поправить число).

- [ ] **Step 2: Запустить production-build**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npm run build`
Expected: **сборка зелёная**, без TypeScript-ошибок. Это страховка от того, что где-то ещё в проде хардкодится формула в комментариях или строковых литералах.

- [ ] **Step 3: Прогнать alpha-симуляцию**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npx tsx scripts/simulate-alpha-test.ts 2>&1 | tail -40`

Если файл `scripts/simulate-alpha-test.ts` отсутствует — найти runner симуляции:
```bash
cd "/Users/macbookm/Hero academy/hero-academy" && grep -l "alphaSimulation" scripts/ -r
```

Expected: средние уровни архетипов (по 20+ seed'ам) попадают в KPI:
- Лентяй: avg ≥ Lv 6
- Середняк: avg ≥ Lv 10
- Отличник: avg ≥ Lv 15

Если средний Лентяй < Lv 6 — это сигнал, что симуляция использует не тот множитель (`ECONOMY.xp_multiplier` в `alphaSimulation.ts:42` = 3.0 = 300%, должно хватить с запасом). Записать фактические числа и принести в спеку как уточнение, не править формулу без согласования с user'ом.

---

## Task 7: Linter

**Files:** none

- [ ] **Step 1: Запустить ESLint**

Run: `cd "/Users/macbookm/Hero academy/hero-academy" && npm run lint`
Expected: **0 errors**. Warnings — игнорируем, если они в файлах, которых мы не трогали в этой задаче.

---

## Task 8: Коммит формулы и тестов

**Files:** уже изменены в Tasks 2-5

- [ ] **Step 1: Проверить git status**

Run: `cd "/Users/macbookm/Hero academy" && git status -s`
Expected: 4 modified файла:
```
 M hero-academy/src/lib/game/math.ts
 M hero-academy/src/lib/game/mechanics.test.ts
 M hero-academy/src/lib/game/__tests__/alphaSimulation.test.ts
 M hero-academy/src/lib/game/alphaSimulation.ts
```
(Плюс старые две модификации `DebugPanel.tsx` и `constants.ts` из Task 1 — НЕ добавлять в этот коммит.)

- [ ] **Step 2: Закоммитить ровно 4 файла этой задачи**

Run:
```bash
cd "/Users/macbookm/Hero academy" && git add \
  hero-academy/src/lib/game/math.ts \
  hero-academy/src/lib/game/mechanics.test.ts \
  hero-academy/src/lib/game/__tests__/alphaSimulation.test.ts \
  hero-academy/src/lib/game/alphaSimulation.ts && \
git commit -m "$(cat <<'EOF'
balance(alpha-v3): кривая уровней ×0.4 — слоты артефактов под 14 уроков

Линейная формула xpPerLevel = 150 + 100·L снижает пороги в ~2.7×
относительно alpha-v2: Lv 6 = 2 250 XP (Лентяй открывает 3-й слот),
Lv 10 = 5 850 XP (Середняк — 4-й), Lv 15 = 12 600 XP (Отличник — 5-й).

Также чиним устаревший docstring в alphaSimulation.ts (был с альфа-v1).

См. spec docs/superpowers/specs/2026-05-05-alpha-level-curve-flatten-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)" && git push
```
Expected: коммит создан и запушен в `main`.

---

## Task 9: Записать в auto-memory дату планируемого отката

**Files:**
- Create: `/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/project_alpha_curve_revert.md`
- Modify: `/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/MEMORY.md`

- [ ] **Step 1: Создать memory-файл `project_alpha_curve_revert.md`**

Записать в `/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/project_alpha_curve_revert.md`:

```markdown
---
name: Откат кривой уровней после альфы
description: Альфа-кривая xpPerLevel = 150 + 100L применена 2026-05-05; откатить после 2026-05-26 на одну из двух предыдущих калибровок
type: project
---
2026-05-05 применена альфа-v3 кривая в `hero-academy/src/lib/game/math.ts`:
- `xpPerLevel(L) = 150 + 100·L`
- `cumulativeXpForLevel(L) = (L-1)·(150 + 50·L)`

**Why:** за 14 уроков альфы (6–25 мая 2026, школа Циркуль) ученикам нужно открыть слоты артефактов на Lv 3/6/9/12/15. Спека: `docs/superpowers/specs/2026-05-05-alpha-level-curve-flatten-design.md`.

**How to apply:** после 2026-05-26 (конец альфы) откатить на одну из двух калибровок:
- `xpPerLevel = 500 + 250·L` (alpha-v2, коммит `0f3af7b` от 2026-04-23) — если бета пройдёт с тем же темпом и небольшим классом.
- `xpPerLevel = 1000 + 500·L` (исходная, до альфы) — если бета будет на полном классе 15+ учеников за полный сезон.

При откате не забыть обновить hard-coded значения в:
- `hero-academy/src/lib/game/mechanics.test.ts` (cumulativeXpForLevel, xpPerLevel, xpProgress, applyXpGain)
- `hero-academy/src/lib/game/__tests__/alphaSimulation.test.ts` (xpToLevel пороги)
- Комментарий-маркер в `math.ts:17-23`
```

- [ ] **Step 2: Добавить ссылку в `MEMORY.md`**

В файл `/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/MEMORY.md` добавить новую строку (в любое логичное место, рядом с другими project-записями про альфу):

```markdown
- [Откат кривой уровней после альфы](project_alpha_curve_revert.md) — 2026-05-05 кривая ×0.4; после 26 мая откатить
```

- [ ] **Step 3: Memory-файлы НЕ коммитятся в репо**

Эти файлы — в `~/.claude/projects/-Users-macbookm-Hero-academy/memory/`, вне git. Просто оставить созданными.

---

## Task 10: Финальный отчёт пользователю

**Files:** none

- [ ] **Step 1: Сводка**

Сообщить user'у:
- Коммит запушен в `main` (хеш + ссылка на PR/коммит).
- Тесты зелёные (`npm test`, `npm run build`, `npm run lint`).
- Симуляция (если запускалась) — результаты по архетипам.
- **Действие со стороны user'а перед стартом 6 мая:** через `/admin/economy` поставить `xp_multiplier ≥ 250%` (текущие 118% не дают Лентяю Lv 6). Это уже было в плане альфы (`project_alpha_test_decision_pending.md`), просто напомнить.
- Запись об откате после 26 мая лежит в auto-memory.

---

## Self-Review Checklist (выполняется ПОСЛЕ написания плана автором, до запуска)

**Spec coverage:**
- ✅ Формула `(L-1)(150 + 50L)` — Task 4
- ✅ Unit-тесты `cumulativeXpForLevel(2)=250`, `(6)=2250`, `(10)=5850`, `(15)=12600` — Task 2
- ✅ `xpPerLevel(1)=250`, `(10)=1150` — Task 2
- ✅ Тест монотонности `cumul(L+1) > cumul(L)` для L=1..30 — Task 2 Step 1
- ✅ Симуляция архетипов с проверкой минимальных уровней — Task 6 Step 3 (через существующий `simulate-alpha-test.ts`)
- ✅ Обновление комментария-маркера «после альфы откатить на …» — Task 4 Step 1
- ✅ Запись в `MEMORY.md` — Task 9

**Placeholder scan:** нет TBD/TODO/«implement later». Все шаги содержат конкретный код или команды.

**Type consistency:** функции `xpPerLevel`, `cumulativeXpForLevel`, `xpToLevel`, `applyXpGain` названы одинаково во всех задачах.
