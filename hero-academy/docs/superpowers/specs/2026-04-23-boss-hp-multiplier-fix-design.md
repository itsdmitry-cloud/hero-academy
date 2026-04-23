# Дизайн: починка `boss_hp_multiplier` (dead field → live multiplier)

**Дата:** 2026-04-23
**Контекст:** подготовка к альфа-тесту 4 мая 2026. Админ-слайдер `boss_hp_multiplier` существует в UI и пишется в `economy_config`, но runtime его не читает → калибровка 420% была фикцией.
**Связанные артефакты:**
- `docs/superpowers/specs/2026-04-22-alpha-test-balance-design.md`
- `docs/superpowers/specs/2026-04-23-boss-creation-on-activation-design.md` (автосоздание боссов на активации; комплементарно)
- Память: `project_alpha_test_decision_pending.md` (вариант B выбран 2026-04-23), `reference_db_schema_reality.md`

---

## 1. Проблема

`calculateBossHp()` в `src/lib/game/boss-hp.ts` считает HP босса как `students × lessons_per_week × weeks × avg_dmg_per_lesson`. Значение `boss_hp_multiplier` из `economy_config` **никто не читает**. Слайдер в админке (`/admin/economy`, max=400) — визуальный обман.

Для альфа-теста: 15 учеников × 3 урока × 3 недели × 20 = **2700 HP**. При `xp_multiplier=300%` и 15 учениках × 14 дней урон по боссу ≈ 70 000 → босс падёт за 1–3 дня. Калибровка 420% × 15000 в `alphaSimulation.ts` = 63 000 — не соответствует реальному runtime.

Учитель не должен и не будет задавать HP руками (см. `feedback_teacher_no_manual_input.md`), поэтому решение — не костыль в teacher UI, а исправление runtime: слайдер в `/admin/economy` должен реально влиять на HP босса.

---

## 2. Цель

- `boss_hp_multiplier` применяется везде, где считается HP нового босса.
- Cascade `class → school → global` (как у остальных multipliers) — уже реализован в `getEconomyConfig()` в `src/lib/game/constants.ts`.
- Слайдер в админке дотягивается до калиброванных значений (до 600%).
- `/teacher/boss/new` удаляется — учитель ничего не вводит руками.
- Симуляция альфа-теста использует реальную формулу, не фиктивное число.

---

## 3. Изменения

### 3.1 `calculateBossHp` — расширение сигнатуры
**Файл:** `src/lib/game/boss-hp.ts`

```ts
export interface BossHpInput {
  studentCount: number | null | undefined;
  seasonWeeks: number | null | undefined;
  /** Процент из economy_config (100 = без изменений). Default = 100. */
  multiplierPct?: number | null | undefined;
}

export function calculateBossHp({ studentCount, seasonWeeks, multiplierPct }: BossHpInput): number {
  const students = studentCount && studentCount > 0 ? studentCount : DEFAULT_STUDENTS;
  const weeks = seasonWeeks && seasonWeeks > 0 ? seasonWeeks : DEFAULT_WEEKS;
  const pct = multiplierPct && multiplierPct > 0 ? multiplierPct : 100;
  const raw = students * LESSONS_PER_WEEK * weeks * AVG_DAMAGE_PER_LESSON * (pct / 100);
  return Math.max(MIN_HP, Math.round(raw));
}
```

**Контракт:**
- `multiplierPct = 100` или не передан → старое поведение, тесты базового кейса остаются зелёными.
- `multiplierPct <= 0` или `NaN` → трактуется как 100 (защита от кривых данных, как уже сделано для students/weeks).
- `MIN_HP = 1000` применяется **после** умножения — класс с множителем 50% и малой формулой не проваливается ниже 1000.

### 3.2 Callers загружают multiplier и передают
Два места создают `subject_bosses` прямо сейчас:

**`src/app/api/bosses/ensure/route.ts`** (lazy ensure при первом заходе учителя):
- Импортировать `getEconomyConfig` из `@/lib/game/constants`.
- Перед циклом по subjects, после чтения `studentCount` и `seasonWeeks`, вызвать `const eco = await getEconomyConfig({ classId })`.
- Передать `multiplierPct: eco.boss_hp_multiplier` в `calculateBossHp()`.

**`src/app/api/admin/create-user/route.ts`** (создание боссов для всех классов школы при создании учителя):
- Там идёт цикл по классам. Для каждого класса — `const eco = await getEconomyConfig({ classId: cls.id })` до `calculateBossHp()`.
- Кэш `getEconomyConfig` (30s TTL) снимает перфоманс-вопрос.

**Будущий `api/admin/activate-season`** (из соседней спеки автосоздания) — загружает так же.

### 3.3 Админ-слайдер: max 400 → 600
**Файл:** `src/app/(admin)/admin/economy/page.tsx`, строка 31.
```ts
{ key: 'boss_hp_multiplier', ..., min: 25, max: 600, unit: '%', ... }
```
- 600% — запас сверх калиброванных 420%, чтобы был headroom.
- `min: 25` оставляем (не падаем ниже 25%, иначе босса убивают одним выстрелом).

**Пресеты (строки 41, 46, 51, 56)** — значения 50/100/200 в пределах нового диапазона, трогать не нужно.

### 3.4 Удалить `/teacher/boss/new`
- Удалить файл `src/app/(teacher)/teacher/boss/new/page.tsx`.
- Удалить все ссылки/редиректы, если есть (grep по `boss/new`).
- Не залинкован из навигации → безопасно (проверено в спеке автосоздания, §7).

### 3.5 Re-калибровка `alphaSimulation.ts`
**Файл:** `src/lib/game/alphaSimulation.ts`
- Убрать `BOSS_BASE_HP_PER_CLASS = 15000` и `BOSS_MAX_HP_PER_CLASS = round(15000 * 4.2)` — это был хардкод под фиктивный runtime.
- Вместо этого:
  ```ts
  import { calculateBossHp } from './boss-hp';
  export const BOSS_MAX_HP_PER_CLASS = calculateBossHp({
    studentCount: ALPHA.students,
    seasonWeeks: ALPHA.weeks,
    multiplierPct: ECONOMY.boss_hp_multiplier,
  });
  ```
- Пересчитать `ECONOMY.boss_hp_multiplier` и `ECONOMY.xp_multiplier` так, чтобы KPI альфы (см. `project_alpha_metrics.md`) били: босс валится ближе к концу 14 дней, а не в первые 3.
- Новая оценка HP при 420%: 15 × 3 × 3 × 20 × 4.2 = **11 340 HP** (раньше симуляция думала 63 000).
- Это значит: либо поднимать `boss_hp_multiplier` сильно выше 420%, либо снижать `xp_multiplier` (сейчас 300%). Решается в симуляции эмпирически.

### 3.6 Тесты
**`src/lib/game/__tests__/boss-hp.test.ts`** — добавить кейсы:
- `multiplierPct: 100` → то же, что без параметра.
- `multiplierPct: 420` → `students × 3 × weeks × 20 × 4.2`.
- `multiplierPct: 50` + малый класс → всё равно ≥ 1000 (MIN_HP).
- `multiplierPct: undefined/null/0/-1` → трактуется как 100.

---

## 4. Вне скоупа

- `hp_regen_rate` — другой dead field, оставляем без изменений. Регена нет по дизайну (MAX_HP=100, восстановление только через артефакты). Удаление из схемы/UI — отдельная задача, не блокирует альфу.
- Автосоздание боссов на активации сезона — отдельная спека `2026-04-23-boss-creation-on-activation-design.md`. Эта спека с ней комплементарна: autocreate вызывает `calculateBossHp` с новой сигнатурой — работает прозрачно.
- Рефакторинг тройного места создания боссов (`create-user` / `ensure` / будущий `activate-season`) в один helper — желательно, но не блокер.

---

## 5. Риски

| Риск | Митигация |
|---|---|
| Забыли передать `multiplierPct` в каком-то caller — молчаливое падение до 100% | Default = 100 сохраняет старое поведение; все существующие тесты `boss-hp.test.ts` зелёные без изменений. Явно ищем все 3 caller'а grep'ом. |
| `getEconomyConfig` упал (нет сети, кривая таблица) — боссы создаются с HP=0 | В `getEconomyConfig` уже fallback в `DEFAULT_ECO` с multiplier=100. HP не провалится. |
| `MIN_HP=1000` не срабатывает при multiplier < 100 | Умножение сделано **перед** `Math.max(MIN_HP, ...)` — защита сохраняется. |
| Re-калибровка alphaSim даёт неожиданные значения | Это цель — симуляция покажет реальное поведение. Корректируем `boss_hp_multiplier` в БД перед альфой. |

---

## 6. Критерии готовности

- [ ] `calculateBossHp` принимает `multiplierPct`, дефолт 100, MIN_HP после умножения.
- [ ] Оба существующих caller'а (`bosses/ensure`, `admin/create-user`) читают `getEconomyConfig` и передают `boss_hp_multiplier`.
- [ ] Админ-слайдер `boss_hp_multiplier` max = 600.
- [ ] `/teacher/boss/new` удалён, `grep boss/new` — чисто (кроме спеки).
- [ ] `alphaSimulation.ts` использует реальную `calculateBossHp`, а не хардкод 15000.
- [ ] `boss-hp.test.ts` покрывает multiplier-кейсы (100, 420, низкий с MIN_HP, null/0/undefined).
- [ ] `npm test` зелёный.
- [ ] Симуляция альфы даёт баланс в пределах KPI.
- [ ] Коммит + push.
