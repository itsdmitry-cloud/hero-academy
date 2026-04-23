# Boss Creation on Season Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** сделать создание боссов детерминированным — всё создание `subject_bosses` происходит в момент активации сезона, плюс дать админу кнопку ручного пересчёта HP.

**Architecture:** вынести pure-логику сбора предметов и подготовки плана боссов в `src/lib/game/boss-activation.ts` (тестируемая отдельно), расширить `POST /api/admin/activate-season` вызовом этой логики, добавить новый `POST /api/admin/recalculate-boss-hp` с `dryRun`-семантикой, добавить UI-кнопку в admin seasons page с confirm-диалогом. Удалить устаревший блок boss-creation из `create-user` и opportunistic-cleanup зря-запросов к несуществующим `season_boss`/`season_boss_class_hp` в runtime-роутах.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (admin client), TypeScript, vitest, zustand.

**Спека:** [`docs/superpowers/specs/2026-04-23-boss-creation-on-activation-design.md`](../specs/2026-04-23-boss-creation-on-activation-design.md)

---

## File Structure

**Новые файлы:**
- `src/lib/game/boss-activation.ts` — pure-функции: `collectSchoolSubjects`, `buildBossCreationPlan`, `buildRecalcPlan`
- `src/lib/game/__tests__/boss-activation.test.ts` — юнит-тесты для трёх функций выше
- `src/app/api/admin/recalculate-boss-hp/route.ts` — новый endpoint

**Модифицируемые файлы:**
- `src/app/api/admin/activate-season/route.ts` — расширить созданием боссов
- `src/app/api/admin/create-user/route.ts` — удалить блок создания боссов (строки ~146-200)
- `src/app/(admin)/admin/seasons/page.tsx` — добавить кнопку "🔄 Пересчитать HP"
- `src/app/api/game/grade-batch/route.ts` — убрать запросы к `season_boss`/`season_boss_class_hp` (строки 302-340)
- `src/app/api/game/action/route.ts` — убрать запросы к `season_boss`/`season_boss_class_hp` (строки 233-260)

**Тесты:**
- `src/lib/game/__tests__/boss-activation.test.ts` — pure-logic
- (integration-тесты для роутов — in scope, но inline в этом плане запушу как smoke-integration через прямой вызов handlers с fake supabase)

---

## Key Types (used across tasks)

```typescript
// src/lib/game/boss-activation.ts

export interface ClassInfo {
  id: string;
  name: string;
  studentCount: number;
}

export interface ExistingBoss {
  id: string;
  class_id: string;
  subject_id: string;
  max_hp: number;
  current_hp: number;
  is_defeated: boolean;
}

export interface BossToCreate {
  classId: string;
  className: string;
  subjectId: string;
  maxHp: number;
}

export interface SkippedClass {
  id: string;
  name: string;
  reason: 'no_students';
}

export interface BossCreationPlan {
  toCreate: BossToCreate[];
  skipped: SkippedClass[];
  subjects: string[]; // дедуплицированный список subjects школы
}

export interface BossChange {
  bossId: string;
  className: string;
  subjectId: string;
  oldMaxHp: number;
  newMaxHp: number;
  oldCurrentHp: number;
  newCurrentHp: number;
}

export interface NewBossInRecalc {
  classId: string;
  className: string;
  subjectId: string;
  maxHp: number;
}

export interface SkippedBoss {
  bossId: string;
  className: string;
  subjectId: string;
  reason: 'defeated';
}

export interface RecalcPlan {
  changes: BossChange[];
  newBosses: NewBossInRecalc[];
  skipped: SkippedBoss[];
}
```

---

## Task 1: Pure helper `collectSchoolSubjects` + тест

**Files:**
- Create: `src/lib/game/boss-activation.ts`
- Test: `src/lib/game/__tests__/boss-activation.test.ts`

**Цель:** чистая функция собирает уникальный список subjects (case-insensitive дедуп) из массива teachers (каждый — `{ subjects: string[] | null }`).

- [ ] **Step 1.1: Написать падающий тест**

Создать `src/lib/game/__tests__/boss-activation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { collectSchoolSubjects } from '../boss-activation';

describe('collectSchoolSubjects', () => {
  it('возвращает пустой массив если teachers=[]', () => {
    expect(collectSchoolSubjects([])).toEqual([]);
  });

  it('возвращает пустой массив если все teachers имеют null subjects', () => {
    expect(collectSchoolSubjects([{ subjects: null }, { subjects: null }])).toEqual([]);
  });

  it('дедуплицирует case-insensitive', () => {
    const result = collectSchoolSubjects([
      { subjects: ['Математика', 'физика'] },
      { subjects: ['математика', 'Физика'] },
    ]);
    expect(result.length).toBe(2);
    expect(result.map((s) => s.toLowerCase()).sort()).toEqual(['математика', 'физика']);
  });

  it('нормализует whitespace через normalizeSubject', () => {
    const result = collectSchoolSubjects([{ subjects: ['  Математика  ', 'Мате матика'] }]);
    expect(result).toContain('Математика');
    // "Мате матика" после collapse whitespace → "Мате матика" (остаётся, т.к. это другая строка)
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('пропускает пустые строки', () => {
    const result = collectSchoolSubjects([{ subjects: ['', '  ', 'Математика'] }]);
    expect(result).toEqual(['Математика']);
  });
});
```

- [ ] **Step 1.2: Запустить тест — убедиться что падает**

Run: `cd hero-academy && npx vitest run src/lib/game/__tests__/boss-activation.test.ts`
Expected: FAIL — `Cannot find module '../boss-activation'`.

- [ ] **Step 1.3: Создать минимальную реализацию**

Создать `src/lib/game/boss-activation.ts`:

```typescript
import { normalizeSubject } from '@/lib/utils/subjects';

export interface TeacherSubjects {
  subjects: string[] | null | undefined;
}

export function collectSchoolSubjects(teachers: readonly TeacherSubjects[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const teacher of teachers) {
    if (!teacher.subjects) continue;
    for (const raw of teacher.subjects) {
      const normalized = normalizeSubject(raw);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}
```

- [ ] **Step 1.4: Запустить тест — убедиться что проходит**

Run: `cd hero-academy && npx vitest run src/lib/game/__tests__/boss-activation.test.ts`
Expected: PASS (5 тестов зелёные).

- [ ] **Step 1.5: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/lib/game/boss-activation.ts hero-academy/src/lib/game/__tests__/boss-activation.test.ts
git commit -m "feat(boss-activation): add collectSchoolSubjects helper"
git push
```

---

## Task 2: `buildBossCreationPlan` + тест

**Files:**
- Modify: `src/lib/game/boss-activation.ts`
- Modify: `src/lib/game/__tests__/boss-activation.test.ts`

**Цель:** чистая функция принимает classes, subjects, уже существующих боссов, multiplier-резолвер, `seasonWeeks` и возвращает `BossCreationPlan` (что создать + что пропустить). Не делает IO.

- [ ] **Step 2.1: Добавить тесты для buildBossCreationPlan**

Добавить в `src/lib/game/__tests__/boss-activation.test.ts`:

```typescript
import { buildBossCreationPlan, type ClassInfo, type ExistingBoss } from '../boss-activation';

describe('buildBossCreationPlan', () => {
  const defaultWeeks = 4;
  const multiplierResolver = (_classId: string) => 100;

  it('создаёт боссов для каждой пары (class, subject), если ни одного нет', () => {
    const classes: ClassInfo[] = [
      { id: 'c1', name: '6А', studentCount: 10 },
      { id: 'c2', name: '6Б', studentCount: 15 },
    ];
    const subjects = ['Математика', 'Физика'];
    const existing: ExistingBoss[] = [];
    const plan = buildBossCreationPlan({
      classes,
      subjects,
      existing,
      seasonWeeks: defaultWeeks,
      multiplierResolver,
    });
    expect(plan.toCreate.length).toBe(4);
    expect(plan.skipped).toEqual([]);
    expect(plan.subjects).toEqual(subjects);
  });

  it('пропускает классы с 0 учеников', () => {
    const classes: ClassInfo[] = [
      { id: 'c1', name: '6А', studentCount: 0 },
      { id: 'c2', name: '6Б', studentCount: 5 },
    ];
    const plan = buildBossCreationPlan({
      classes,
      subjects: ['Математика'],
      existing: [],
      seasonWeeks: defaultWeeks,
      multiplierResolver,
    });
    expect(plan.toCreate.length).toBe(1);
    expect(plan.toCreate[0]?.classId).toBe('c2');
    expect(plan.skipped.length).toBe(1);
    expect(plan.skipped[0]?.id).toBe('c1');
    expect(plan.skipped[0]?.reason).toBe('no_students');
  });

  it('idempotent: не создаёт дубликаты (case-insensitive match по subjectId)', () => {
    const classes: ClassInfo[] = [{ id: 'c1', name: '6А', studentCount: 10 }];
    const existing: ExistingBoss[] = [
      {
        id: 'b1',
        class_id: 'c1',
        subject_id: 'математика',
        max_hp: 9600,
        current_hp: 9600,
        is_defeated: false,
      },
    ];
    const plan = buildBossCreationPlan({
      classes,
      subjects: ['Математика', 'Физика'],
      existing,
      seasonWeeks: defaultWeeks,
      multiplierResolver,
    });
    expect(plan.toCreate.length).toBe(1);
    expect(plan.toCreate[0]?.subjectId).toBe('Физика');
  });

  it('использует multiplierResolver per-class для HP', () => {
    const classes: ClassInfo[] = [
      { id: 'c1', name: '6А', studentCount: 10 },
      { id: 'c2', name: '6Б', studentCount: 10 },
    ];
    const resolver = (classId: string) => (classId === 'c1' ? 200 : 100);
    const plan = buildBossCreationPlan({
      classes,
      subjects: ['Математика'],
      existing: [],
      seasonWeeks: 4,
      multiplierResolver: resolver,
    });
    const c1Boss = plan.toCreate.find((b) => b.classId === 'c1');
    const c2Boss = plan.toCreate.find((b) => b.classId === 'c2');
    // 10 × 3 × 4 × 80 = 9600 base
    expect(c1Boss?.maxHp).toBe(19200); // × 2
    expect(c2Boss?.maxHp).toBe(9600); // × 1
  });
});
```

- [ ] **Step 2.2: Запустить тесты — убедиться что падают**

Run: `cd hero-academy && npx vitest run src/lib/game/__tests__/boss-activation.test.ts`
Expected: FAIL — `buildBossCreationPlan is not exported`.

- [ ] **Step 2.3: Реализовать buildBossCreationPlan**

Добавить в `src/lib/game/boss-activation.ts`:

```typescript
import { calculateBossHp } from './boss-hp';

export interface ClassInfo {
  id: string;
  name: string;
  studentCount: number;
}

export interface ExistingBoss {
  id: string;
  class_id: string;
  subject_id: string;
  max_hp: number;
  current_hp: number;
  is_defeated: boolean;
}

export interface BossToCreate {
  classId: string;
  className: string;
  subjectId: string;
  maxHp: number;
}

export interface SkippedClass {
  id: string;
  name: string;
  reason: 'no_students';
}

export interface BossCreationPlan {
  toCreate: BossToCreate[];
  skipped: SkippedClass[];
  subjects: string[];
}

export interface BuildBossCreationPlanInput {
  classes: readonly ClassInfo[];
  subjects: readonly string[];
  existing: readonly ExistingBoss[];
  seasonWeeks: number;
  multiplierResolver: (classId: string) => number;
}

export function buildBossCreationPlan(input: BuildBossCreationPlanInput): BossCreationPlan {
  const { classes, subjects, existing, seasonWeeks, multiplierResolver } = input;
  const existingKey = (classId: string, subjectId: string) =>
    `${classId}::${subjectId.toLowerCase()}`;
  const existingSet = new Set(existing.map((b) => existingKey(b.class_id, b.subject_id)));

  const toCreate: BossToCreate[] = [];
  const skipped: SkippedClass[] = [];

  for (const cls of classes) {
    if (cls.studentCount < 1) {
      skipped.push({ id: cls.id, name: cls.name, reason: 'no_students' });
      continue;
    }
    const multiplier = multiplierResolver(cls.id);
    for (const subject of subjects) {
      if (existingSet.has(existingKey(cls.id, subject))) continue;
      const maxHp = calculateBossHp({
        studentCount: cls.studentCount,
        seasonWeeks,
        multiplierPct: multiplier,
      });
      toCreate.push({
        classId: cls.id,
        className: cls.name,
        subjectId: subject,
        maxHp,
      });
    }
  }

  return { toCreate, skipped, subjects: [...subjects] };
}
```

- [ ] **Step 2.4: Запустить тесты — убедиться что проходят**

Run: `cd hero-academy && npx vitest run src/lib/game/__tests__/boss-activation.test.ts`
Expected: PASS (все тесты `collectSchoolSubjects` + `buildBossCreationPlan` зелёные).

- [ ] **Step 2.5: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/lib/game/boss-activation.ts hero-academy/src/lib/game/__tests__/boss-activation.test.ts
git commit -m "feat(boss-activation): add buildBossCreationPlan pure helper"
git push
```

---

## Task 3: Расширить `activate-season` созданием боссов

**Files:**
- Modify: `src/app/api/admin/activate-season/route.ts`

**Цель:** после смены статуса на `'active'` собрать subjects школы, загрузить классы + существующих боссов, вызвать `buildBossCreationPlan`, вставить `subject_bosses`. Вернуть статистику в response.

- [ ] **Step 3.1: Прочитать текущий файл для контекста**

Run: `cat "/Users/macbookm/Hero academy/hero-academy/src/app/api/admin/activate-season/route.ts"`

Ожидаемый контент (28 строк): POST принимает `{ seasonId }`, деактивирует другие сезоны школы, активирует текущий, возвращает `{ success: true }`.

- [ ] **Step 3.2: Полностью переписать activate-season/route.ts**

Записать в `src/app/api/admin/activate-season/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';
import { weeksBetween } from '@/lib/utils/dates';
import { getEconomyConfig } from '@/lib/game/constants';
import {
  buildBossCreationPlan,
  collectSchoolSubjects,
  type ClassInfo,
  type ExistingBoss,
} from '@/lib/game/boss-activation';

export async function POST(request: NextRequest) {
  const { seasonId } = (await request.json()) as { seasonId?: string };
  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id, school_id, starts_at, ends_at')
    .eq('id', seasonId)
    .maybeSingle();

  if (seasonError || !season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  }

  // Deactivate other active seasons in this school
  const { error: deactivateError } = await supabase
    .from('seasons')
    .update({ status: 'ended' })
    .eq('school_id', season.school_id)
    .eq('status', 'active')
    .neq('id', seasonId);
  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  // Activate requested season
  const { error: activateError } = await supabase
    .from('seasons')
    .update({ status: 'active' })
    .eq('id', seasonId);
  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 500 });
  }

  // === Boss creation ===
  const warnings: string[] = [];
  let bossesCreated = 0;
  let classesSkipped: { id: string; name: string; reason: string }[] = [];
  let subjects: string[] = [];

  try {
    // Load teachers with subjects
    const { data: teachers, error: teachersError } = await supabase
      .from('users')
      .select('subjects')
      .eq('school_id', season.school_id)
      .eq('role', 'teacher');
    if (teachersError) throw teachersError;

    subjects = collectSchoolSubjects(teachers ?? []);
    if (subjects.length === 0) {
      warnings.push('Нет учителей с subjects — боссов не создано');
    } else {
      // Load classes with student counts
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', season.school_id);
      if (classesError) throw classesError;

      const classInfos: ClassInfo[] = [];
      for (const cls of classes ?? []) {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('role', 'student');
        classInfos.push({ id: cls.id, name: cls.name, studentCount: count ?? 0 });
      }

      // Load existing bosses for this season
      const { data: existingBosses, error: bossesError } = await supabase
        .from('subject_bosses')
        .select('id, class_id, subject_id, max_hp, current_hp, is_defeated')
        .eq('season_id', seasonId);
      if (bossesError) throw bossesError;

      // Resolve multipliers per class (in parallel)
      const multiplierEntries = await Promise.all(
        classInfos.map(async (cls) => {
          const eco = await getEconomyConfig({ classId: cls.id });
          return [cls.id, eco.boss_hp_multiplier ?? 100] as const;
        }),
      );
      const multiplierMap = new Map(multiplierEntries);

      const seasonWeeks = weeksBetween(season.starts_at, season.ends_at);

      const plan = buildBossCreationPlan({
        classes: classInfos,
        subjects,
        existing: (existingBosses ?? []) as ExistingBoss[],
        seasonWeeks,
        multiplierResolver: (classId) => multiplierMap.get(classId) ?? 100,
      });

      classesSkipped = plan.skipped;

      // Insert bosses
      for (const boss of plan.toCreate) {
        const { error: insertError } = await supabase.from('subject_bosses').insert({
          season_id: seasonId,
          class_id: boss.classId,
          subject_id: boss.subjectId,
          name: `Босс: ${boss.subjectId}`,
          avatar: '🐉',
          max_hp: boss.maxHp,
          current_hp: boss.maxHp,
          is_defeated: false,
        });
        if (insertError) {
          // 23505 = unique violation (idempotent), ignore
          if (!insertError.message.includes('duplicate') && insertError.code !== '23505') {
            warnings.push(
              `Не удалось создать босса ${boss.className} · ${boss.subjectId}: ${insertError.message}`,
            );
          }
        } else {
          bossesCreated++;
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Boss creation error: ${msg}`);
  }

  return NextResponse.json({
    success: true,
    bossesCreated,
    classesSkipped,
    subjects,
    warnings,
  });
}
```

**Примечание:** если `@/lib/utils/dates` или `weeksBetween` отсутствуют — найти их через grep (`rg "weeksBetween" hero-academy/src`) и импортировать из реального места. `bosses/ensure/route.ts` его уже использует, значит он существует — взять импорт оттуда.

- [ ] **Step 3.3: Прогнать typecheck + тесты**

Run: `cd hero-academy && npx tsc --noEmit && npx vitest run`
Expected: типы ок, все существующие тесты зелёные.

Если typecheck падает из-за импорта `weeksBetween` — поправить путь. Если создание boss требует дополнительных полей — посмотреть `bosses/ensure/route.ts:68-127` и скопировать форму insert.

- [ ] **Step 3.4: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/api/admin/activate-season/route.ts
git commit -m "feat(activate-season): create subject_bosses for school classes on activation"
git push
```

---

## Task 4: `buildRecalcPlan` pure-функция + тест

**Files:**
- Modify: `src/lib/game/boss-activation.ts`
- Modify: `src/lib/game/__tests__/boss-activation.test.ts`

**Цель:** чистая функция считает diff между текущим состоянием `subject_bosses` и желаемым (на основе текущего `studentCount` + `multiplier`). Возвращает changes + newBosses + skipped (defeated).

- [ ] **Step 4.1: Тест**

Добавить в `src/lib/game/__tests__/boss-activation.test.ts`:

```typescript
import { buildRecalcPlan } from '../boss-activation';

describe('buildRecalcPlan', () => {
  const classes: ClassInfo[] = [
    { id: 'c1', name: '6А', studentCount: 15 },
    { id: 'c2', name: '6Б', studentCount: 0 },
  ];
  const multiplierResolver = () => 100;

  it('возвращает diff для existing боссов с новым studentCount', () => {
    const existing: ExistingBoss[] = [
      {
        id: 'b1',
        class_id: 'c1',
        subject_id: 'Математика',
        max_hp: 9600, // 10 students × 3 × 4 × 80
        current_hp: 5000,
        is_defeated: false,
      },
    ];
    const plan = buildRecalcPlan({
      classes,
      subjects: ['Математика'],
      existing,
      seasonWeeks: 4,
      multiplierResolver,
    });
    expect(plan.changes.length).toBe(1);
    const change = plan.changes[0];
    expect(change?.oldMaxHp).toBe(9600);
    expect(change?.newMaxHp).toBe(14400); // 15 × 3 × 4 × 80
    expect(change?.oldCurrentHp).toBe(5000);
    expect(change?.newCurrentHp).toBe(5000); // clamp: min(5000, 14400)
  });

  it('clamp уменьшает current_hp если new_max < old_current', () => {
    const existing: ExistingBoss[] = [
      {
        id: 'b1',
        class_id: 'c1',
        subject_id: 'Математика',
        max_hp: 20000,
        current_hp: 18000,
        is_defeated: false,
      },
    ];
    const plan = buildRecalcPlan({
      classes: [{ id: 'c1', name: '6А', studentCount: 5 }],
      subjects: ['Математика'],
      existing,
      seasonWeeks: 4,
      multiplierResolver,
    });
    // 5 × 3 × 4 × 80 = 4800
    expect(plan.changes[0]?.newMaxHp).toBe(4800);
    expect(plan.changes[0]?.newCurrentHp).toBe(4800); // clamp
  });

  it('defeated боссов пропускает полностью (не меняет ни max ни current)', () => {
    const existing: ExistingBoss[] = [
      {
        id: 'b1',
        class_id: 'c1',
        subject_id: 'Математика',
        max_hp: 1000,
        current_hp: 0,
        is_defeated: true,
      },
    ];
    const plan = buildRecalcPlan({
      classes,
      subjects: ['Математика'],
      existing,
      seasonWeeks: 4,
      multiplierResolver,
    });
    expect(plan.changes).toEqual([]);
    expect(plan.skipped.length).toBe(1);
    expect(plan.skipped[0]?.reason).toBe('defeated');
    expect(plan.skipped[0]?.bossId).toBe('b1');
  });

  it('обнаруживает новые subjects и добавляет в newBosses (только для классов с >=1 студентами)', () => {
    const existing: ExistingBoss[] = [
      {
        id: 'b1',
        class_id: 'c1',
        subject_id: 'Математика',
        max_hp: 14400,
        current_hp: 14400,
        is_defeated: false,
      },
    ];
    const plan = buildRecalcPlan({
      classes,
      subjects: ['Математика', 'Физика'],
      existing,
      seasonWeeks: 4,
      multiplierResolver,
    });
    expect(plan.newBosses.length).toBe(1);
    expect(plan.newBosses[0]?.classId).toBe('c1');
    expect(plan.newBosses[0]?.subjectId).toBe('Физика');
    expect(plan.newBosses[0]?.maxHp).toBe(14400);
  });

  it('не создаёт newBosses для классов с 0 учеников', () => {
    const plan = buildRecalcPlan({
      classes: [{ id: 'c2', name: '6Б', studentCount: 0 }],
      subjects: ['Математика'],
      existing: [],
      seasonWeeks: 4,
      multiplierResolver,
    });
    expect(plan.newBosses).toEqual([]);
    expect(plan.changes).toEqual([]);
  });

  it('changes не возвращает entries где max и current не поменялись', () => {
    const existing: ExistingBoss[] = [
      {
        id: 'b1',
        class_id: 'c1',
        subject_id: 'Математика',
        max_hp: 14400,
        current_hp: 14400,
        is_defeated: false,
      },
    ];
    const plan = buildRecalcPlan({
      classes,
      subjects: ['Математика'],
      existing,
      seasonWeeks: 4,
      multiplierResolver,
    });
    expect(plan.changes).toEqual([]);
  });
});
```

- [ ] **Step 4.2: Запустить тесты — убедиться что падают**

Run: `cd hero-academy && npx vitest run src/lib/game/__tests__/boss-activation.test.ts`
Expected: FAIL — `buildRecalcPlan is not exported`.

- [ ] **Step 4.3: Реализация**

Добавить в `src/lib/game/boss-activation.ts`:

```typescript
export interface BossChange {
  bossId: string;
  className: string;
  subjectId: string;
  oldMaxHp: number;
  newMaxHp: number;
  oldCurrentHp: number;
  newCurrentHp: number;
}

export interface NewBossInRecalc {
  classId: string;
  className: string;
  subjectId: string;
  maxHp: number;
}

export interface SkippedBoss {
  bossId: string;
  className: string;
  subjectId: string;
  reason: 'defeated';
}

export interface RecalcPlan {
  changes: BossChange[];
  newBosses: NewBossInRecalc[];
  skipped: SkippedBoss[];
}

export interface BuildRecalcPlanInput {
  classes: readonly ClassInfo[];
  subjects: readonly string[];
  existing: readonly ExistingBoss[];
  seasonWeeks: number;
  multiplierResolver: (classId: string) => number;
}

export function buildRecalcPlan(input: BuildRecalcPlanInput): RecalcPlan {
  const { classes, subjects, existing, seasonWeeks, multiplierResolver } = input;
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const existingKey = (classId: string, subjectId: string) =>
    `${classId}::${subjectId.toLowerCase()}`;
  const existingMap = new Map(existing.map((b) => [existingKey(b.class_id, b.subject_id), b]));

  const changes: BossChange[] = [];
  const skipped: SkippedBoss[] = [];

  for (const boss of existing) {
    const cls = classMap.get(boss.class_id);
    const className = cls?.name ?? '(unknown)';
    if (boss.is_defeated) {
      skipped.push({
        bossId: boss.id,
        className,
        subjectId: boss.subject_id,
        reason: 'defeated',
      });
      continue;
    }
    if (!cls) continue; // class missing — skip
    const multiplier = multiplierResolver(cls.id);
    const newMaxHp = calculateBossHp({
      studentCount: cls.studentCount,
      seasonWeeks,
      multiplierPct: multiplier,
    });
    const newCurrentHp = Math.min(boss.current_hp, newMaxHp);
    if (newMaxHp === boss.max_hp && newCurrentHp === boss.current_hp) continue;
    changes.push({
      bossId: boss.id,
      className,
      subjectId: boss.subject_id,
      oldMaxHp: boss.max_hp,
      newMaxHp,
      oldCurrentHp: boss.current_hp,
      newCurrentHp,
    });
  }

  const newBosses: NewBossInRecalc[] = [];
  for (const cls of classes) {
    if (cls.studentCount < 1) continue;
    const multiplier = multiplierResolver(cls.id);
    for (const subject of subjects) {
      if (existingMap.has(existingKey(cls.id, subject))) continue;
      const maxHp = calculateBossHp({
        studentCount: cls.studentCount,
        seasonWeeks,
        multiplierPct: multiplier,
      });
      newBosses.push({
        classId: cls.id,
        className: cls.name,
        subjectId: subject,
        maxHp,
      });
    }
  }

  return { changes, newBosses, skipped };
}
```

- [ ] **Step 4.4: Тесты зелёные**

Run: `cd hero-academy && npx vitest run src/lib/game/__tests__/boss-activation.test.ts`
Expected: PASS (все тесты, включая 6 новых, зелёные).

- [ ] **Step 4.5: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/lib/game/boss-activation.ts hero-academy/src/lib/game/__tests__/boss-activation.test.ts
git commit -m "feat(boss-activation): add buildRecalcPlan for manual HP recalc"
git push
```

---

## Task 5: Новый endpoint `POST /api/admin/recalculate-boss-hp`

**Files:**
- Create: `src/app/api/admin/recalculate-boss-hp/route.ts`

**Цель:** принять `{ seasonId, dryRun }`, собрать классы/учителей/боссов/multipliers, вызвать `buildRecalcPlan`, и либо вернуть diff (dryRun=true), либо применить изменения (dryRun=false).

- [ ] **Step 5.1: Создать файл с endpoint**

Создать `src/app/api/admin/recalculate-boss-hp/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';
import { weeksBetween } from '@/lib/utils/dates';
import { getEconomyConfig } from '@/lib/game/constants';
import {
  buildRecalcPlan,
  collectSchoolSubjects,
  type ClassInfo,
  type ExistingBoss,
} from '@/lib/game/boss-activation';

export async function POST(request: NextRequest) {
  const { seasonId, dryRun = true } = (await request.json()) as {
    seasonId?: string;
    dryRun?: boolean;
  };
  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id, school_id, starts_at, ends_at')
    .eq('id', seasonId)
    .maybeSingle();
  if (seasonError || !season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  }

  // Load teachers + subjects
  const { data: teachers, error: teachersError } = await supabase
    .from('users')
    .select('subjects')
    .eq('school_id', season.school_id)
    .eq('role', 'teacher');
  if (teachersError) {
    return NextResponse.json({ error: teachersError.message }, { status: 500 });
  }
  const subjects = collectSchoolSubjects(teachers ?? []);

  // Load classes + student counts
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', season.school_id);
  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }
  const classInfos: ClassInfo[] = [];
  for (const cls of classes ?? []) {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .eq('role', 'student');
    classInfos.push({ id: cls.id, name: cls.name, studentCount: count ?? 0 });
  }

  // Load existing bosses
  const { data: existingBosses, error: bossesError } = await supabase
    .from('subject_bosses')
    .select('id, class_id, subject_id, max_hp, current_hp, is_defeated')
    .eq('season_id', seasonId);
  if (bossesError) {
    return NextResponse.json({ error: bossesError.message }, { status: 500 });
  }

  // Resolve multipliers per class
  const multiplierEntries = await Promise.all(
    classInfos.map(async (cls) => {
      const eco = await getEconomyConfig({ classId: cls.id });
      return [cls.id, eco.boss_hp_multiplier ?? 100] as const;
    }),
  );
  const multiplierMap = new Map(multiplierEntries);

  const seasonWeeks = weeksBetween(season.starts_at, season.ends_at);

  const plan = buildRecalcPlan({
    classes: classInfos,
    subjects,
    existing: (existingBosses ?? []) as ExistingBoss[],
    seasonWeeks,
    multiplierResolver: (classId) => multiplierMap.get(classId) ?? 100,
  });

  if (dryRun) {
    return NextResponse.json({ ...plan, applied: false });
  }

  // Apply changes
  const warnings: string[] = [];
  let applied = 0;

  for (const change of plan.changes) {
    const { error } = await supabase
      .from('subject_bosses')
      .update({ max_hp: change.newMaxHp, current_hp: change.newCurrentHp })
      .eq('id', change.bossId);
    if (error) {
      warnings.push(`Не удалось обновить босса ${change.className} · ${change.subjectId}: ${error.message}`);
    } else {
      applied++;
    }
  }

  for (const newBoss of plan.newBosses) {
    const { error } = await supabase.from('subject_bosses').insert({
      season_id: seasonId,
      class_id: newBoss.classId,
      subject_id: newBoss.subjectId,
      name: `Босс: ${newBoss.subjectId}`,
      avatar: '🐉',
      max_hp: newBoss.maxHp,
      current_hp: newBoss.maxHp,
      is_defeated: false,
    });
    if (error && error.code !== '23505') {
      warnings.push(`Не удалось создать босса ${newBoss.className} · ${newBoss.subjectId}: ${error.message}`);
    } else if (!error) {
      applied++;
    }
  }

  return NextResponse.json({ ...plan, applied: true, appliedCount: applied, warnings });
}
```

- [ ] **Step 5.2: Прогнать typecheck**

Run: `cd hero-academy && npx tsc --noEmit`
Expected: ok.

- [ ] **Step 5.3: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/api/admin/recalculate-boss-hp/route.ts
git commit -m "feat(recalc-boss-hp): add POST /api/admin/recalculate-boss-hp endpoint"
git push
```

---

## Task 6: UI-кнопка "🔄 Пересчитать HP" в seasons page

**Files:**
- Modify: `src/app/(admin)/admin/seasons/page.tsx`

**Цель:** для `status='active'` сезонов рядом с "Завершить сезон" кнопка "🔄 Пересчитать HP". Клик → dryRun → confirm с diff → apply → toast.

- [ ] **Step 6.1: Прочитать файл**

Run: `cat "/Users/macbookm/Hero academy/hero-academy/src/app/(admin)/admin/seasons/page.tsx"`

Посмотреть: handler `endSeason` (строки ~45-65), jsx кнопки (строки ~170-178), как устроены другие handlers, какой toast-механизм используется (возможно `alert()` или кастомный).

- [ ] **Step 6.2: Добавить handler `recalculateBossHp`**

Рядом с `endSeason` вставить:

```typescript
const [recalculating, setRecalculating] = useState<string | null>(null);

const recalculateBossHp = useCallback(async (seasonId: string, seasonName: string) => {
  setRecalculating(seasonId);
  try {
    // 1. Dry run
    const dryRes = await fetch('/api/admin/recalculate-boss-hp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId, dryRun: true }),
    });
    if (!dryRes.ok) {
      const msg = await dryRes.text();
      window.alert(`Ошибка dryRun: ${msg}`);
      return;
    }
    const plan = (await dryRes.json()) as {
      changes: Array<{
        className: string;
        subjectId: string;
        oldMaxHp: number;
        newMaxHp: number;
        oldCurrentHp: number;
        newCurrentHp: number;
      }>;
      newBosses: Array<{ className: string; subjectId: string; maxHp: number }>;
      skipped: Array<{ className: string; subjectId: string; reason: string }>;
    };

    // 2. Build diff text
    const lines: string[] = [`Пересчёт HP для сезона "${seasonName}":`, ''];
    if (plan.changes.length > 0) {
      lines.push('Изменения:');
      for (const c of plan.changes) {
        lines.push(
          `• ${c.className} · ${c.subjectId}: ${c.oldMaxHp} → ${c.newMaxHp} HP (текущий: ${c.oldCurrentHp} → ${c.newCurrentHp})`,
        );
      }
      lines.push('');
    }
    if (plan.newBosses.length > 0) {
      lines.push(`Новые боссы: ${plan.newBosses.length}`);
      for (const b of plan.newBosses) {
        lines.push(`• ${b.className} · ${b.subjectId}: ${b.maxHp} HP`);
      }
      lines.push('');
    }
    if (plan.skipped.length > 0) {
      lines.push('Пропущены (повержен, награды розданы):');
      for (const s of plan.skipped) {
        lines.push(`• ${s.className} · ${s.subjectId}`);
      }
      lines.push('');
    }
    if (plan.changes.length === 0 && plan.newBosses.length === 0) {
      window.alert('Всё уже актуально — изменений нет.');
      return;
    }
    lines.push('Применить?');

    if (!window.confirm(lines.join('\n'))) return;

    // 3. Apply
    const applyRes = await fetch('/api/admin/recalculate-boss-hp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId, dryRun: false }),
    });
    if (!applyRes.ok) {
      const msg = await applyRes.text();
      window.alert(`Ошибка применения: ${msg}`);
      return;
    }
    const applied = (await applyRes.json()) as { appliedCount?: number; warnings?: string[] };
    let msg = `Готово: обновлено ${applied.appliedCount ?? 0} боссов.`;
    if (applied.warnings && applied.warnings.length > 0) {
      msg += `\n\nWarnings:\n${applied.warnings.join('\n')}`;
    }
    window.alert(msg);
    refetch?.();
  } catch (err) {
    window.alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    setRecalculating(null);
  }
}, [refetch]);
```

*Примечание:* если в файле уже используется кастомный toast вместо `alert` — заменить `window.alert` / `window.confirm` на тот же компонент, который использует `endSeason`.

- [ ] **Step 6.3: Добавить кнопку в JSX**

Рядом с кнопкой "Завершить сезон" (показывается для `s.status === 'active'`), добавить:

```tsx
<button
  onClick={() => recalculateBossHp(s.id, s.name)}
  disabled={recalculating === s.id}
  style={{
    marginLeft: 8,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid rgba(139,92,246,0.4)',
    background: 'rgba(139,92,246,0.15)',
    color: '#a78bfa',
    cursor: recalculating === s.id ? 'wait' : 'pointer',
    fontSize: 13,
  }}
>
  {recalculating === s.id ? '⏳ Пересчёт…' : '🔄 Пересчитать HP'}
</button>
```

*Примечание:* если в файле используется Tailwind или другой css-фреймворк вместо inline-styles — адаптировать под него, взяв за образец стиль кнопки "Завершить сезон".

- [ ] **Step 6.4: Ручная проверка (UI)**

Run: `cd hero-academy && npm run dev` (в фоне)

Открыть `/admin/seasons` в браузере. Проверить:
1. На активном сезоне видна кнопка "🔄 Пересчитать HP" (purple).
2. Клик → появляется confirm с текстом diff.
3. Подтверждение → alert с результатом.

Если UI сломан — смотреть браузер-консоль и сервер-логи.

- [ ] **Step 6.5: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add "hero-academy/src/app/(admin)/admin/seasons/page.tsx"
git commit -m "feat(admin-seasons): add recalculate-boss-hp button with dryRun confirm"
git push
```

---

## Task 7: Удалить блок boss-creation из `create-user`

**Files:**
- Modify: `src/app/api/admin/create-user/route.ts`

**Цель:** убрать дублирующую логику создания боссов (строки ~146-200), которая создаёт боссов в неправильный момент. Теперь это делает `activate-season`.

- [ ] **Step 7.1: Прочитать файл**

Run: `cat -n "/Users/macbookm/Hero academy/hero-academy/src/app/api/admin/create-user/route.ts"`

Определить точные границы блока создания боссов. Искать: `.from('subject_bosses').insert(` и обратно вверх до начала `if (role === 'teacher')` / `for (const cls of classes)` / комментария. Определить точные строки начала и конца.

- [ ] **Step 7.2: Удалить блок**

Удалить целиком от комментария / начала `if (role === 'teacher')`-блока создания боссов до его закрывающей скобки. Сохранить всё остальное в роуте (создание самого учителя, возврат ответа и т.д.).

Также удалить теперь-неиспользуемые импорты (`calculateBossHp`, `getEconomyConfig`, `weeksBetween`, `normalizeSubjects` и т.д. — если они только для боссов использовались).

- [ ] **Step 7.3: Typecheck**

Run: `cd hero-academy && npx tsc --noEmit`
Expected: ok (no unused-import errors), иначе подчистить импорты.

- [ ] **Step 7.4: Запустить все тесты**

Run: `cd hero-academy && npx vitest run`
Expected: все зелёные.

- [ ] **Step 7.5: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/api/admin/create-user/route.ts
git commit -m "refactor(create-user): remove boss creation (now handled by activate-season)"
git push
```

---

## Task 8: Opportunistic cleanup — убрать dead queries к `season_boss`/`season_boss_class_hp`

**Files:**
- Modify: `src/app/api/game/grade-batch/route.ts` (строки ~290-340)
- Modify: `src/app/api/game/action/route.ts` (строки ~225-275)

**Цель:** `season_boss` и `season_boss_class_hp` не существуют в БД, код делает в них `maybeSingle()` каждый раз, fallback на `subject_bosses` работает. Убрать зря-запросы.

- [ ] **Step 8.1: Прочитать grade-batch блок**

Run: `sed -n '280,350p' "/Users/macbookm/Hero academy/hero-academy/src/app/api/game/grade-batch/route.ts"`

Определить: где именно начинаются и заканчиваются запросы к `season_boss`/`season_boss_class_hp`, и где начинается fallback на `subject_bosses`.

- [ ] **Step 8.2: Удалить блок season_boss из grade-batch**

Удалить запросы к `season_boss` и `season_boss_class_hp` (включая обработку их результата). Оставить только ветку, работающую с `subject_bosses`. Переписать чтобы она была основной, без fallback-if-чейна.

Если есть переменные типа `seasonBoss`, `classHp` — убрать их определения и прямые referrals. Оставить только `subjectBoss` / `subject_bosses` код.

- [ ] **Step 8.3: Прочитать action блок**

Run: `sed -n '220,285p' "/Users/macbookm/Hero academy/hero-academy/src/app/api/game/action/route.ts"`

Сделать то же самое, что в Task 8.2.

- [ ] **Step 8.4: Удалить блок season_boss из action**

Удалить запросы к `season_boss` / `season_boss_class_hp`, оставить только `subject_bosses`.

- [ ] **Step 8.5: Typecheck + тесты**

Run: `cd hero-academy && npx tsc --noEmit && npx vitest run`
Expected: типы ок, тесты зелёные.

- [ ] **Step 8.6: Smoke-test боссовой механики (вручную, dev)**

Если `npm run dev` не запущен — запустить. Войти учеником, сдать домашку, открыть `/admin/seasons` и убедиться что HP босса уменьшился в БД (напрямую через Supabase studio либо запросом `select * from subject_bosses`).

Если урон НЕ проходит — откатить Task 8.1-8.4 и разобраться. Если проходит — переходим к коммиту.

- [ ] **Step 8.7: Коммит + пуш**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/api/game/grade-batch/route.ts hero-academy/src/app/api/game/action/route.ts
git commit -m "refactor(game-routes): remove dead queries to nonexistent season_boss tables"
git push
```

---

## Task 9: Полный прогон тестов + Ralph Loop + manual alpha scenario

**Files:** (проверка, не редактирование)

- [ ] **Step 9.1: Полный тестовый прогон**

Run: `cd hero-academy && npx vitest run`
Expected: 0 failing tests.

Если есть упавшие тесты, не связанные с нашими изменениями — проверить `git log` и поведение на main. Если наши — исправить.

- [ ] **Step 9.2: Lint + typecheck**

Run: `cd hero-academy && npm run lint && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 9.3: Ralph Loop до 0 ошибок (user requirement)**

Согласно [`feedback_test_before_done`](/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/feedback_test_before_done.md): прогнать Ralph Loop если есть интеграционные тесты/сценарии, пока ошибок не будет.

- [ ] **Step 9.4: Manual alpha scenario (§6 спеки)**

Запустить `npm run dev`. Выполнить:
1. Школа "Циркуль" уже должна существовать (или создать).
2. Учитель с `subjects=['Математика']` уже должен существовать (или создать через `/admin/users` если есть такое UI, либо `create-user`).
3. В классе должно быть 15 учеников (создать если нет).
4. Активировать сезон "Майский Квест" (если его нет — создать через `/admin/seasons` → `/api/admin/create-season`).
5. В Supabase studio проверить:
   ```sql
   SELECT max_hp, current_hp FROM subject_bosses
   WHERE season_id = (SELECT id FROM seasons WHERE name = 'Майский Квест' LIMIT 1);
   ```
6. Ожидаемое `max_hp` = `15 × 3 × 4 × 80 × 4.2 = 60480` (при `boss_hp_multiplier=420` для Циркуля и длине сезона 4 недели).
7. Добавить ещё 5 учеников (через `/admin/users` или напрямую в БД).
8. Нажать "🔄 Пересчитать HP" в `/admin/seasons` → diff должен показать 60480 → 80640.
9. Подтвердить → в БД проверить что `max_hp = 80640`.

Если какой-то шаг не сходится — документировать и исправлять.

- [ ] **Step 9.5: DB sync проверка**

Согласно [`feedback_db_sync`](/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/feedback_db_sync.md): проверить что никаких миграций не нужно (мы не меняли схему, только логику). Если нужно — создать миграцию и выполнить её в Supabase.

На этой фиче — **миграций не требуется**, unique-индекс `subject_bosses_dedupe` уже есть, все поля уже живые.

- [ ] **Step 9.6: Финальный push**

```bash
cd "/Users/macbookm/Hero academy"
git push  # убедиться что всё на remote
```

- [ ] **Step 9.7: Обновить memory**

Обновить `/Users/macbookm/.claude/projects/-Users-macbookm-Hero-academy/memory/project_boss_activation_todo.md` с пометкой "done" либо удалить файл. Удалить строку из `MEMORY.md`.

---

## Self-Review Checklist (запустить после написания каждой задачи)

**Spec coverage:**
- [x] §3.1 — boss creation on activation: Tasks 1-3
- [x] §3.2 — recalculate endpoint: Tasks 4-5
- [x] §3.3 — UI button: Task 6
- [x] §4 — create-user cleanup: Task 7
- [x] §5.1 — collect subjects logic: Task 1
- [x] §5.2/§5.3 — race conditions / transactionality: warnings-based approach в activate-season (Task 3)
- [x] §6 — unit + integration + manual tests: Tasks 1-4, 9
- [x] §7 opportunistic cleanup grade-batch/action: Task 8
- [x] §9 критерии готовности — проверяются в Task 9.4

**No Placeholders:**
- [x] все тесты показаны полным кодом
- [x] все API handlers написаны полностью
- [x] UI JSX показан точно
- [x] ожидаемые команды и их output указаны

**Type consistency:**
- [x] `ClassInfo`, `ExistingBoss`, `BossChange` определены в Task 1/4, используются в Tasks 3, 5
- [x] `calculateBossHp({ studentCount, seasonWeeks, multiplierPct })` — одинаковая сигнатура во всех вызовах
- [x] `multiplierResolver: (classId) => number` — одинаковая сигнатура в обоих planner-функциях
