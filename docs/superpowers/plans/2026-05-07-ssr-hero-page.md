# SSR-миграция страницы /hero — план имплементации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести первую загрузку страницы `/hero` на серверный рендер, чтобы устранить ~7-9 клиентских Supabase-запросов через RU-VPS-прокси из критического пути.

**Architecture:** Server Component делает один параллельный батч запросов в Supabase (Vercel→Stockholm напрямую, без прокси), отдаёт `initialData` клиентскому компоненту через props. Клиент синхронно гидратирует zustand-store до первого рендера. Прокси остаётся для мутаций и realtime.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, `@supabase/ssr`, Zustand, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-07-ssr-hero-page-design.md`](../specs/2026-05-07-ssr-hero-page-design.md)

---

## Структура файлов

| Файл | Что делает |
|---|---|
| `src/lib/hero/types.ts` (новый) | `HeroPageInitialData` тип + DB row типы |
| `src/lib/hero/mappers.ts` (новый) | Чистые функции: DB row → формат zustand-store |
| `src/lib/hero/fetchers.ts` (новый) | server-only `getHeroPageData(supabase, userId)` |
| `src/lib/hero/__tests__/mappers.test.ts` (новый) | Vitest-тесты на mappers |
| `src/app/(student)/hero/page.tsx` (переписан) | Server Component — auth + fetch + delegate |
| `src/app/(student)/hero/HeroPageClient.tsx` (новый, перенесённое содержимое) | Client component с гидратацией |
| `src/lib/hooks/use-supabase-sync.ts` (правка) | Skip fetch если store уже `synced` |
| `src/lib/hooks/use-artifacts.ts` (правка) | Опциональный `initialCatalog` |
| `src/lib/hooks/use-class-rank.ts` (правка) | Опциональный `initialRank` + `initialTotal` |

---

## Task 1: Создать каркас директории `src/lib/hero/`

**Files:**
- Create: `src/lib/hero/types.ts`
- Create: `src/lib/hero/mappers.ts`
- Create: `src/lib/hero/fetchers.ts`
- Create: `src/lib/hero/__tests__/mappers.test.ts`

- [ ] **Step 1: Создать types.ts со всеми DB row типами**

```ts
// src/lib/hero/types.ts
// DB row types — narrow shapes for what fetchers/mappers actually read.

export interface HeroRow {
  id: string;
  user_id: string;
  name: string;
  gender: 'male' | 'female';
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
  streak_current: number | null;
  streak_best: number | null;
  season_xp: number | null;
  status?: string;
}

export interface HeroStatsRow {
  strength: number;
  knowledge: number;
  endurance: number;
  luck: number;
  wisdom: number;
}

export interface ActivityLogRow {
  id: string;
  user_id: string;
  hero_id: string;
  action: string;
  xp_change: number;
  gold_change: number;
  hp_change: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ArtifactRow {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  effect: string;
  effect_type?: string;
  effect_value: number;
  duration_hours: number;
  drop_rate: number;
  stackable: boolean;
  max_charges: number;
  is_shopable: boolean;
  min_level?: number;
  artifact_type?: string;
}

export interface HeroArtifactRow {
  id: string;
  artifact_id: string;
  hero_id: string;
  slot_index: number | null;
  is_equipped: boolean;
  quantity: number;
  charges_remaining: number;
  acquired_at: string;
  expires_at: string | null;
  source: string;
  artifact?: ArtifactRow;
}

export interface ClassRank {
  rank: number;
  total: number;
}

export interface HeroPageInitialData {
  hero: HeroRow | null;
  stats: HeroStatsRow | null;
  activityLog: ActivityLogRow[];
  artifactCatalog: ArtifactRow[];
  heroArtifacts: HeroArtifactRow[];
  classRank: ClassRank | null;
  seasonName: string | null;
  schoolName: string | null;
  className: string | null;
}
```

- [ ] **Step 2: Создать пустые заглушки mappers.ts и fetchers.ts**

```ts
// src/lib/hero/mappers.ts
// Pure functions: DB row -> zustand-store format.
// Used by both SSR hydration and client realtime updates.
export {};
```

```ts
// src/lib/hero/fetchers.ts
// Server-only Supabase fetchers. Not callable from browser bundle.
import 'server-only';
export {};
```

- [ ] **Step 3: Создать пустой test-файл**

```ts
// src/lib/hero/__tests__/mappers.test.ts
import { describe, it, expect } from 'vitest';

describe('hero mappers', () => {
  it.todo('mapHero');
  it.todo('mapActivity');
  it.todo('mapInventory');
});
```

- [ ] **Step 4: Запустить тесты — должны пройти (todo'шки)**

Run: `npm test -- src/lib/hero`
Expected: 3 todo entries, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hero
git commit -m "feat(hero): scaffold src/lib/hero with types and stubs"
```

---

## Task 2: Реализовать `mapHero` с тестами

**Files:**
- Modify: `src/lib/hero/mappers.ts`
- Modify: `src/lib/hero/__tests__/mappers.test.ts`

Изучить текущую логику записи hero в store: `src/lib/hooks/use-supabase-sync.ts:213-238`. Извлечь её в `mapHero`.

- [ ] **Step 1: Написать failing test**

В `src/lib/hero/__tests__/mappers.test.ts` заменить `it.todo('mapHero')` на:

```ts
import { mapHero } from '../mappers';
import type { HeroRow, HeroStatsRow } from '../types';

describe('mapHero', () => {
  const baseRow: HeroRow = {
    id: 'hero-1', user_id: 'u-1', name: 'Алиса', gender: 'female',
    level: 5, xp: 1200, xp_to_next: 1500, hp: 80, hp_max: 100, gold: 250,
    streak_current: 3, streak_best: 7, season_xp: 800,
  };

  it('maps full row to ExtendedHeroState', () => {
    const result = mapHero(baseRow, null);
    expect(result.heroId).toBe('hero-1');
    expect(result.name).toBe('Алиса');
    expect(result.gender).toBe('female');
    expect(result.level).toBe(5);
    expect(result.xp).toBe(1200);
    expect(result.xp_to_next).toBe(1500);
    expect(result.hp).toBe(80);
    expect(result.hp_max).toBe(100);
    expect(result.gold).toBe(250);
    expect(result.streak).toBe(3);
    expect(result.streak_best).toBe(7);
    expect(result.season_xp).toBe(800);
  });

  it('treats null streak_current/streak_best/season_xp as 0', () => {
    const result = mapHero({ ...baseRow, streak_current: null, streak_best: null, season_xp: null }, null);
    expect(result.streak).toBe(0);
    expect(result.streak_best).toBe(0);
    expect(result.season_xp).toBe(0);
  });

  it('preserves activeArtifacts as empty array (filled by mapInventory separately)', () => {
    const result = mapHero(baseRow, null);
    expect(result.activeArtifacts).toEqual([]);
  });

  it('preserves avatar default emoji', () => {
    const male = mapHero({ ...baseRow, gender: 'male' }, null);
    const female = mapHero({ ...baseRow, gender: 'female' }, null);
    expect(typeof male.avatar).toBe('string');
    expect(typeof female.avatar).toBe('string');
  });
});
```

- [ ] **Step 2: Запустить — должен упасть с "mapHero is not a function"**

Run: `npm test -- src/lib/hero/__tests__/mappers.test.ts`
Expected: FAIL — `mapHero` не экспортирован.

- [ ] **Step 3: Реализовать `mapHero` в mappers.ts**

```ts
// src/lib/hero/mappers.ts
import type { ExtendedHeroState } from '@/lib/store/heroStore';
import type { HeroRow, HeroStatsRow } from './types';

export function mapHero(row: HeroRow, _stats: HeroStatsRow | null): ExtendedHeroState {
  return {
    heroId: row.id,
    name: row.name,
    avatar: row.gender === 'female' ? '🧙‍♀️' : '🧙‍♂️',
    gender: row.gender,
    level: row.level,
    xp: row.xp,
    xp_to_next: row.xp_to_next,
    hp: row.hp,
    hp_max: row.hp_max,
    gold: row.gold,
    streak: row.streak_current ?? 0,
    streak_best: row.streak_best ?? 0,
    season_xp: row.season_xp ?? 0,
    activeArtifacts: [],
  };
}

export function mapStats(stats: HeroStatsRow | null) {
  if (!stats) return null;
  return {
    strength: stats.strength,
    knowledge: stats.knowledge,
    endurance: stats.endurance,
    luck: stats.luck,
    wisdom: stats.wisdom,
  };
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npm test -- src/lib/hero/__tests__/mappers.test.ts`
Expected: PASS (4 теста на mapHero, остальные todo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hero
git commit -m "feat(hero): mapHero pure function + tests"
```

---

## Task 3: Реализовать `mapActivity` с тестами

**Files:**
- Modify: `src/lib/hero/mappers.ts`
- Modify: `src/lib/hero/__tests__/mappers.test.ts`

Извлечь логику `parsedActivity` из `src/lib/hooks/use-supabase-sync.ts:38-211` в чистую функцию.

- [ ] **Step 1: Написать failing tests для основных action типов**

Заменить `it.todo('mapActivity')`:

```ts
import { mapActivity } from '../mappers';
import type { ActivityLogRow } from '../types';

describe('mapActivity', () => {
  const base: Omit<ActivityLogRow, 'action' | 'metadata'> = {
    id: 'log-1', user_id: 'u-1', hero_id: 'h-1',
    xp_change: 0, gold_change: 0, hp_change: 0,
    created_at: '2026-05-07T10:00:00Z',
  };

  it('returns empty array for empty input', () => {
    expect(mapActivity([])).toEqual([]);
  });

  it('skips ignored actions (lootbox_opened, shop_purchase, etc.)', () => {
    const rows: ActivityLogRow[] = [
      { ...base, action: 'lootbox_opened', metadata: {} },
      { ...base, action: 'shop_purchase', metadata: {} },
      { ...base, action: 'teacher_gold_grant', metadata: {} },
      { ...base, action: 'bp_reward_claimed', metadata: {} },
      { ...base, action: 'seasonal_lootbox_opened', metadata: {} },
    ];
    expect(mapActivity(rows)).toEqual([]);
  });

  it('maps quest_completed with quest name from metadata', () => {
    const result = mapActivity([
      { ...base, action: 'quest_completed', metadata: { quest: 'Параграф 5' }, xp_change: 100 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quest).toBe('Параграф 5');
    expect(result[0].result).toBe('✅ Успех');
    expect(result[0].xp).toBe('+100');
    expect(result[0].category).toBe('quest');
  });

  it('maps boss_kill_reward with damage % and MVP flag', () => {
    const result = mapActivity([
      {
        ...base,
        action: 'boss_kill_reward',
        metadata: { reason: '15% урона Боссу (Алгебра) — MVP' },
        xp_change: 500,
      },
    ]);
    expect(result[0].quest).toContain('Алгебра');
    expect(result[0].result).toContain('15%');
    expect(result[0].result).toContain('👑');
    expect(result[0].category).toBe('boss');
  });

  it('formats xp/gold changes with sign', () => {
    const result = mapActivity([
      { ...base, action: 'grant_xp', xp_change: 50, gold_change: 0, metadata: { reason: 'Бонус' } },
      { ...base, action: 'damage', xp_change: 0, hp_change: -10, metadata: { reason: 'Ошибка' } },
    ]);
    expect(result[0].xp).toBe('+50');
    expect(result[1].xp).toBe('-');
  });

  it('exposes raw fields for ActionBreakdown', () => {
    const result = mapActivity([
      { ...base, action: 'quest_completed', xp_change: 50, gold_change: 10, hp_change: -5, metadata: { quest: 'X' } },
    ]);
    expect(result[0].xpChangeRaw).toBe(50);
    expect(result[0].goldChangeRaw).toBe(10);
    expect(result[0].hpChangeRaw).toBe(-5);
    expect(result[0].action).toBe('quest_completed');
  });
});
```

- [ ] **Step 2: Запустить — должны упасть**

Run: `npm test -- src/lib/hero/__tests__/mappers.test.ts -t mapActivity`
Expected: FAIL — функция не экспортирована.

- [ ] **Step 3: Реализовать `mapActivity` в mappers.ts**

Скопировать логику из `src/lib/hooks/use-supabase-sync.ts:38-211`. Дописать к mappers.ts:

```ts
import type { ActivityEntry } from '@/lib/store/heroStore';
import type { ActivityLogRow } from './types';

const IGNORED_ACTIONS = new Set([
  'lootbox_opened', 'seasonal_lootbox_opened', 'shop_purchase',
  'teacher_gold_grant', 'bp_reward_claimed',
]);

const RARITY_EMOJI: Record<string, string> = {
  common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡',
};
const RARITY_LABEL: Record<string, string> = {
  common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный',
};

type ActivityCategory = 'quest' | 'boss' | 'event';

function formatChange(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '-';
}

export function mapActivity(rows: ActivityLogRow[]): ActivityEntry[] {
  return rows
    .map((log): ActivityEntry | null => {
      if (IGNORED_ACTIONS.has(log.action)) return null;

      const meta = (log.metadata && typeof log.metadata === 'object' ? log.metadata : {}) as Record<string, unknown>;
      let category: ActivityCategory = 'event';
      let questName = '⚙️ Событие';
      let resultMsg = '⚙️ Событие';
      const msgs: string[] = [];

      if (log.action === 'quest_completed' || log.action === 'quest_complete') {
        category = 'quest';
        questName = String(meta.quest ?? 'Квест');
        resultMsg = '✅ Успех';
        if (Array.isArray(meta.pipeline)) msgs.push(...(meta.pipeline as string[]));

      } else if (log.action === 'teacher_xp_grant') {
        category = 'quest';
        questName = String(meta.reason ?? 'Награда учителя');
        const subj = meta.subject ? ` (${meta.subject})` : '';
        resultMsg = `🌟 Награда${subj}`;
        if (Array.isArray(meta.pipeline)) msgs.push(...(meta.pipeline as string[]));
        if (log.xp_change > 0) msgs.unshift(`⭐ Получено XP: +${log.xp_change}`);
        if (log.gold_change > 0) msgs.unshift(`💰 Получено золота: +${log.gold_change}`);

      } else if (log.action === 'grant_xp') {
        questName = String(meta.reason ?? 'Начисление XP');
        resultMsg = '⭐ XP';
        if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);

      } else if (log.action === 'grant_gold') {
        questName = String(meta.reason ?? 'Начисление золота');
        resultMsg = '💰 Золото';
        if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);

      } else if (log.action === 'teacher_damage' || log.action === 'damage') {
        questName = String(meta.reason ?? 'Штраф от учителя');
        resultMsg = `⚠️ Урон (${meta.subject ?? 'Предмет'})`;
        if (Array.isArray(meta.pipeline)) msgs.push(...(meta.pipeline as string[]));

      } else if (log.action === 'boss_kill_reward') {
        category = 'boss';
        const dmgMatch = String(meta.reason ?? '').match(/(\d+)%.*Боссу?\s*\(([^)]+)\)/i);
        if (dmgMatch) {
          questName = `🐉 Босс убит: ${dmgMatch[2]}`;
          const isMvp = String(meta.reason ?? '').includes('MVP');
          const isLastHit = String(meta.reason ?? '').includes('последний');
          resultMsg = `⚔️ ${dmgMatch[1]}% урона${isMvp ? ' 👑' : ''}${isLastHit ? ' 🗡️' : ''}`;
        } else {
          questName = '🐉 Победа над боссом';
          resultMsg = '⚔️ Участвовал';
        }
        if (log.xp_change > 0) msgs.push(`⭐ Опыт: +${log.xp_change}`);
        if (log.gold_change > 0) msgs.push(`💰 Золото: +${log.gold_change}`);
        if (meta.damage_dealt) msgs.push(`⚔️ Нанесено урона: ${meta.damage_dealt}`);
        if (meta.is_mvp) msgs.push(`👑 MVP — наибольший урон в классе!`);
        if (meta.is_last_hit) msgs.push(`🗡️ Последний удар — бонус +1000 XP`);
        if (Array.isArray(meta.level_ups) && (meta.level_ups as number[]).length > 0) {
          (meta.level_ups as number[]).forEach((lvl) => msgs.push(`🆙 Уровень повышен до ${lvl}!`));
        }

      } else if (log.action === 'artifact_drop') {
        const rar = String(meta.rarity ?? 'common');
        questName = `🎁 ${meta.artifact ?? 'Артефакт'}`;
        resultMsg = `${RARITY_EMOJI[rar] ?? '⚪'} ${RARITY_LABEL[rar] ?? rar}`;
        const srcLabel = meta.source === 'boss_kill' ? 'убийства босса' : 'задания';
        msgs.push(`Выпал из ${srcLabel}`);

      } else if (log.action === 'potion_used') {
        questName = `⚗️ ${meta.item ?? meta.artifact ?? 'Расходник'}`;
        resultMsg = '✨ Эффект применён';
        if (meta.effect) msgs.push(`Эффект: ${meta.effect}`);

      } else if (log.action === 'class_artifact_used') {
        const actName = String(meta.activator_name ?? 'Одноклассник');
        const artName = String(meta.artifact ?? 'Массовый артефакт');
        const icon = String(meta.icon ?? '✨');
        questName = `${icon} ${artName} (от ${actName})`;
        resultMsg = '🎊 Подарок классу!';
        msgs.push(`🔥 ${actName} применил(а) сезонный эффект на весь класс!`);
        if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);
        if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);
        if (log.hp_change > 0) msgs.push(`❤️ +${log.hp_change} HP`);

      } else if (log.action === 'team_artifact_activated') {
        const actName = String(meta.activator_name ?? 'Одноклассник');
        const artNameStr = String(meta.artifact ?? 'Командный артефакт');
        const icon = String(meta.icon ?? '✨');
        const effectVal = Number(meta.effect_value ?? 0);
        const durationH = meta.duration_hours ? Number(meta.duration_hours) : null;
        if (durationH) {
          questName = `${icon} ${actName} активировал(а) «${artNameStr}»`;
          resultMsg = '🛡️ Аура класса!';
          msgs.push(`🔥 ${artNameStr} — +${effectVal}% на ${durationH}ч для всего класса`);
        } else {
          questName = `${icon} ${actName} использовал(а) «${artNameStr}»`;
          resultMsg = '🎊 Подарок классу!';
          msgs.push(`🔥 ${artNameStr} — эффект применён ко всему классу`);
        }

      } else if (log.action === 'streak_bonus' || log.action === 'streak_reward' || log.action === 'streak_update') {
        const days = meta.days ?? meta.streak ?? '?';
        questName = `🔥 Стрик: ${days} дней`;
        resultMsg = '🏅 Награда за стрик';
        if (log.xp_change > 0) msgs.push(`⭐ +${log.xp_change} XP`);
        if (log.gold_change > 0) msgs.push(`💰 +${log.gold_change} Золота`);

      } else if (log.action === 'boss_damage') {
        category = 'boss';
        const subj = String(meta.subject ?? meta.boss_name ?? 'Босс');
        const dmg = Number(meta.damage_dealt ?? 0);
        questName = `🐉 Атака босса: ${subj}`;
        resultMsg = `⚔️ ${dmg.toLocaleString('ru-RU')} урона`;
        msgs.push(`⚔️ Урон нанесён: ${dmg.toLocaleString('ru-RU')}`);
        if (meta.boss_name) msgs.push(`🐉 Босс: ${meta.boss_name}`);
        if (meta.subject) msgs.push(`📚 Предмет: ${meta.subject}`);

      } else if (log.action === 'quest_graded') {
        category = 'quest';
        const subj = String(meta.subject ?? '');
        const score = Number(meta.score ?? 0);
        questName = subj ? `📝 ${subj}: оценка ${score}` : `📝 Проверено: оценка ${score}`;
        resultMsg = score >= 4 ? '✅ Хорошо' : score === 3 ? '⚠️ Удовл.' : '❌ Плохо';

      } else if (log.action === 'level_up') {
        questName = `🆙 Уровень ${meta.level ?? '?'}!`;
        resultMsg = '✨ Повышение уровня';
      }

      return {
        id: log.id,
        date: new Date(log.created_at).toLocaleDateString('ru-RU'),
        quest: questName,
        result: resultMsg,
        category,
        xp: formatChange(log.xp_change),
        gold: formatChange(log.gold_change),
        messages: msgs,
        action: log.action,
        metadata: meta,
        xpChangeRaw: log.xp_change,
        hpChangeRaw: log.hp_change,
        goldChangeRaw: log.gold_change,
      };
    })
    .filter((x): x is ActivityEntry => x !== null);
}
```

- [ ] **Step 4: Запустить тесты — все должны пройти**

Run: `npm test -- src/lib/hero/__tests__/mappers.test.ts`
Expected: PASS (mapHero + mapActivity тесты).

- [ ] **Step 5: Использовать `mapActivity` внутри `use-supabase-sync.ts`** (DRY)

В `src/lib/hooks/use-supabase-sync.ts` заменить весь блок построения `parsedActivity` (строки 38-211) на:

```ts
import { mapActivity } from '@/lib/hero/mappers';

// ... внутри syncHeroData:
const parsedActivity = mapActivity(logs ?? []);
```

Удалить теперь неиспользуемые `rarityEmoji`, `rarityLabel` константы. Сохранить остальную логику (вызовы supabase + setState).

- [ ] **Step 6: Запустить весь test suite — ничего не сломалось**

Run: `npm test`
Expected: все тесты проходят.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hero src/lib/hooks/use-supabase-sync.ts
git commit -m "feat(hero): mapActivity pure function + DRY use-supabase-sync"
```

---

## Task 4: Реализовать `mapInventory` с тестами

**Files:**
- Modify: `src/lib/hero/mappers.ts`
- Modify: `src/lib/hero/__tests__/mappers.test.ts`

- [ ] **Step 1: Написать failing test**

Заменить `it.todo('mapInventory')`:

```ts
import { mapInventory } from '../mappers';
import type { HeroArtifactRow } from '../types';

describe('mapInventory', () => {
  const baseArt = {
    id: 'a1', name: 'Зелье', description: '', rarity: 'common' as const,
    icon: '⚗️', effect: 'hp_restore', effect_value: 30,
    duration_hours: 0, drop_rate: 0.1, stackable: false,
    max_charges: 1, is_shopable: true,
  };

  it('returns empty for no rows', () => {
    expect(mapInventory([])).toEqual([]);
  });

  it('drops expired artifacts (expires_at < now)', () => {
    const rows: HeroArtifactRow[] = [
      {
        id: 'ha1', artifact_id: 'a1', hero_id: 'h1', slot_index: null,
        is_equipped: false, quantity: 1, charges_remaining: 1,
        acquired_at: '2026-01-01', expires_at: '2020-01-01T00:00:00Z',
        source: 'shop', artifact: baseArt,
      },
    ];
    expect(mapInventory(rows)).toEqual([]);
  });

  it('keeps unexpired and unconstrained artifacts', () => {
    const rows: HeroArtifactRow[] = [
      {
        id: 'ha1', artifact_id: 'a1', hero_id: 'h1', slot_index: 0,
        is_equipped: true, quantity: 1, charges_remaining: 3,
        acquired_at: '2026-05-01', expires_at: null,
        source: 'shop', artifact: baseArt,
      },
    ];
    const result = mapInventory(rows);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ha1');
    expect(result[0].defId).toBe('a1');
    expect(result[0].is_equipped).toBe(true);
    expect(result[0].charges_left).toBe(3);
  });
});
```

- [ ] **Step 2: Run test — fail**

Run: `npm test -- src/lib/hero/__tests__/mappers.test.ts -t mapInventory`
Expected: FAIL.

- [ ] **Step 3: Реализовать `mapInventory`**

Дописать к mappers.ts:

```ts
import type { PlayerArtifact } from '@/lib/utils/artifacts';
import type { HeroArtifactRow } from './types';

export function mapInventory(rows: HeroArtifactRow[]): PlayerArtifact[] {
  const now = Date.now();
  return rows
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() >= now)
    .map((row) => ({
      id: row.id,
      defId: row.artifact_id,
      is_equipped: row.is_equipped,
      ...(row.charges_remaining !== undefined && row.charges_remaining !== null
        ? { charges_left: row.charges_remaining }
        : {}),
      ...(row.expires_at ? { expires_at: new Date(row.expires_at) } : {}),
    } as PlayerArtifact));
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test -- src/lib/hero/__tests__/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hero
git commit -m "feat(hero): mapInventory pure function + tests"
```

---

## Task 5: Реализовать `getHeroPageData` fetcher

**Files:**
- Modify: `src/lib/hero/fetchers.ts`

Серверный fetcher делает 7 параллельных запросов в `Promise.all`. Каждый — в индивидуальном `try/catch`, чтобы один упавший не валил всю страницу.

- [ ] **Step 1: Написать `getHeroPageData`**

```ts
// src/lib/hero/fetchers.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  HeroPageInitialData, HeroRow, HeroStatsRow, ActivityLogRow,
  ArtifactRow, HeroArtifactRow, ClassRank,
} from './types';

async function safe<T>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await p;
    if (error) {
      console.error('[hero/fetchers] supabase error:', error);
      return fallback;
    }
    return data ?? fallback;
  } catch (err) {
    console.error('[hero/fetchers] thrown:', err);
    return fallback;
  }
}

export async function getHeroPageData(
  supabase: SupabaseClient,
  userId: string,
): Promise<HeroPageInitialData> {
  // Hero + stats first — heroId needed for hero_artifacts.
  // Profile (school_id, class_id) needed for school/class names.
  const [heroRes, profileRes] = await Promise.all([
    safe(
      supabase
        .from('heroes')
        .select('*, hero_stats(strength, knowledge, endurance, luck, wisdom)')
        .eq('user_id', userId)
        .single() as PromiseLike<{ data: (HeroRow & { hero_stats: HeroStatsRow[] | HeroStatsRow | null }) | null; error: unknown }>,
      null,
    ),
    safe(
      supabase
        .from('users')
        .select('school_id, class_id')
        .eq('id', userId)
        .single() as PromiseLike<{ data: { school_id: string | null; class_id: string | null } | null; error: unknown }>,
      null,
    ),
  ]);

  const hero: HeroRow | null = heroRes ? { ...heroRes, hero_stats: undefined } as HeroRow : null;
  const stats: HeroStatsRow | null = heroRes
    ? Array.isArray(heroRes.hero_stats)
      ? heroRes.hero_stats[0] ?? null
      : heroRes.hero_stats ?? null
    : null;
  const heroId = hero?.id ?? null;
  const schoolId = profileRes?.school_id ?? null;
  const classId = profileRes?.class_id ?? null;

  const [
    activityLog,
    artifactCatalog,
    heroArtifacts,
    classRank,
    seasonName,
    schoolName,
    className,
  ] = await Promise.all([
    safe(
      supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20) as PromiseLike<{ data: ActivityLogRow[] | null; error: unknown }>,
      [] as ActivityLogRow[],
    ),
    safe(
      supabase
        .from('artifacts')
        .select('*')
        .order('rarity') as PromiseLike<{ data: ArtifactRow[] | null; error: unknown }>,
      [] as ArtifactRow[],
    ),
    heroId
      ? safe(
          supabase
            .from('hero_artifacts')
            .select('*, artifact:artifact_id(*)')
            .eq('hero_id', heroId) as PromiseLike<{ data: HeroArtifactRow[] | null; error: unknown }>,
          [] as HeroArtifactRow[],
        )
      : Promise.resolve([] as HeroArtifactRow[]),
    fetchClassRank(supabase, userId),
    schoolId ? fetchSeasonName(supabase, schoolId) : Promise.resolve(null),
    schoolId ? fetchSingleName(supabase, 'schools', schoolId) : Promise.resolve(null),
    classId ? fetchSingleName(supabase, 'classes', classId) : Promise.resolve(null),
  ]);

  return {
    hero,
    stats,
    activityLog,
    artifactCatalog,
    heroArtifacts,
    classRank,
    seasonName,
    schoolName,
    className,
  };
}

async function fetchClassRank(supabase: SupabaseClient, userId: string): Promise<ClassRank | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_rating_rank', {
      p_user_id: userId,
      p_scope: 'class',
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    const me = data[0] as { rank: number; total: number };
    return { rank: me.rank > 0 ? me.rank : 0, total: me.total ?? 0 };
  } catch (err) {
    console.error('[hero/fetchers] classRank:', err);
    return null;
  }
}

async function fetchSeasonName(supabase: SupabaseClient, schoolId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('seasons')
      .select('name')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

async function fetchSingleName(
  supabase: SupabaseClient,
  table: 'schools' | 'classes',
  id: string,
): Promise<string | null> {
  try {
    const { data } = await supabase.from(table).select('name').eq('id', id).maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Проверить, что компилируется и не сломал тесты**

Run: `npx tsc --noEmit && npm test`
Expected: 0 ошибок типизации, тесты проходят.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hero/fetchers.ts
git commit -m "feat(hero): server-side getHeroPageData with parallel queries"
```

---

## Task 6: Переименовать страницу в HeroPageClient + создать новый Server `page.tsx`

**Files:**
- Rename: `src/app/(student)/hero/page.tsx` → `src/app/(student)/hero/HeroPageClient.tsx`
- Create: `src/app/(student)/hero/page.tsx` (новый, server)

- [ ] **Step 1: Переименовать файл и адаптировать экспорт**

```bash
git mv "src/app/(student)/hero/page.tsx" "src/app/(student)/hero/HeroPageClient.tsx"
```

В новом `HeroPageClient.tsx`:
- Заменить `export default function HeroPage()` → `export default function HeroPageClient(props: HeroPageClientProps)`
- Добавить импорт типа и пустой интерфейс props (заполним в Task 7):

```tsx
import type { HeroPageInitialData } from '@/lib/hero/types';

export interface HeroPageClientProps {
  initialData: HeroPageInitialData;
}

export default function HeroPageClient({ initialData: _initialData }: HeroPageClientProps) {
  // ... всё содержимое остаётся как было — initialData пока не используется
  // ...
}
```

(Параметр пока с `_` префиксом — ESLint не ругается на unused.)

- [ ] **Step 2: Создать новый Server Component `page.tsx`**

```tsx
// src/app/(student)/hero/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHeroPageData } from '@/lib/hero/fetchers';
import HeroPageClient from './HeroPageClient';

export const dynamic = 'force-dynamic';

export default async function HeroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const initialData = await getHeroPageData(supabase, user.id);

  if (!initialData.hero) {
    redirect('/onboarding');
  }

  return <HeroPageClient initialData={initialData} />;
}
```

- [ ] **Step 3: Запустить dev-сервер, открыть `/hero` в браузере, проверить что страница рендерится**

Run: `npm run dev`
Manual check:
1. Открыть `http://localhost:3000/hero` под залогиненным учеником
2. Страница рисуется как раньше
3. В консоли нет ошибок

(На этом шаге SSR-данные не используются — страница всё ещё фетчит сама. Цель — убедиться что разделение Server/Client не сломало текущий флоу.)

- [ ] **Step 4: Запустить lint + tests**

Run: `npm run lint && npm test`
Expected: ✓ 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(student)/hero/"
git commit -m "feat(hero): split into Server page.tsx + HeroPageClient.tsx"
```

---

## Task 7: Синхронная гидратация store в HeroPageClient

**Files:**
- Modify: `src/app/(student)/hero/HeroPageClient.tsx`

- [ ] **Step 1: Импортировать mappers и добавить блок гидратации**

В `HeroPageClient.tsx` сразу после `'use client';` импортов добавить `useRef` если его нет, и из mappers:

```tsx
import { useRef } from 'react';
import { useHeroStore } from '@/lib/store/heroStore';
import { mapHero, mapStats, mapInventory, mapActivity } from '@/lib/hero/mappers';
```

Внутри функции `HeroPageClient`, **до** любого `useHeroStore()`-вызова, добавить:

```tsx
export default function HeroPageClient({ initialData }: HeroPageClientProps) {
  // SSR hydration — выставляем store ДО первого рендера, синхронно.
  // useEffect здесь дал бы flash из persisted localStorage.
  const hydrated = useRef(false);
  if (!hydrated.current) {
    if (initialData.hero) {
      const persistedHeroId = useHeroStore.getState().hero.heroId;
      // Защита: если в persist-кеше остались данные другого юзера — чистим.
      if (persistedHeroId && persistedHeroId !== initialData.hero.id) {
        useHeroStore.persist.clearStorage();
      }
      const mappedStats = mapStats(initialData.stats);
      useHeroStore.setState({
        hero: mapHero(initialData.hero, initialData.stats),
        inventory: mapInventory(initialData.heroArtifacts),
        activity: mapActivity(initialData.activityLog),
        ...(mappedStats ? { stats: mappedStats } : {}),
        synced: true,
      });
    }
    hydrated.current = true;
  }

  // ... остальной код функции без изменений
  const { hero, activity, synced } = useHeroStore();
  // ...
}
```

- [ ] **Step 2: Smoke в браузере**

Run: `npm run dev`
Manual check:
1. Hard reload `/hero` — данные видны сразу, без skeleton.
2. DevTools Network → filter `db2.hero-academy.ru`: на первой загрузке нет REST-запросов к `heroes` / `activity_log` (только WS).
3. Logout → login другим юзером → на `/hero` нет старых данных предыдущего.

- [ ] **Step 3: Запустить тесты + lint**

Run: `npm run lint && npm test`
Expected: ✓.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/hero/HeroPageClient.tsx"
git commit -m "feat(hero): synchronous SSR hydration of zustand store"
```

---

## Task 8: Сделать `useSupabaseSync` no-op если store уже `synced`

**Files:**
- Modify: `src/lib/hooks/use-supabase-sync.ts`

После Task 7 хук всё ещё запускается на mount и делает второй запрос heroes+activity_log поверх SSR. Скипаем его если данные уже есть.

- [ ] **Step 1: Добавить guard в начало useEffect**

В `src/lib/hooks/use-supabase-sync.ts` найти `useEffect(() => { if (!user) return; async function syncHeroData() { ... } syncHeroData(); }, [user?.id])`.

Добавить проверку `synced` ДО вызова `syncHeroData()`:

```ts
useEffect(() => {
  if (!user) return;
  // Skip if SSR already populated the store. Realtime keeps it fresh.
  // On logout/account switch, synced flag resets via the hero clear path.
  if (useHeroStore.getState().synced) return;

  async function syncHeroData() {
    // ... без изменений
  }
  syncHeroData();
}, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Smoke в браузере**

Run: `npm run dev`
Manual check на `/hero`:
1. DevTools Network → filter `heroes` или `activity_log`: 0 запросов после первой загрузки.
2. Hard reload — данные есть.
3. Открыть страницу под другим юзером — данные обновляются (сработала или SSR при навигации, или sync при `synced=false`).

- [ ] **Step 3: Тесты + lint**

Run: `npm run lint && npm test`
Expected: ✓.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/use-supabase-sync.ts
git commit -m "perf(hero): skip useSupabaseSync fetch when SSR already hydrated"
```

---

## Task 9: `useArtifacts` принимает опциональный `initialCatalog` и `initialInventory`

**Files:**
- Modify: `src/lib/hooks/use-artifacts.ts`
- Modify: `src/app/(student)/hero/HeroPageClient.tsx`

- [ ] **Step 1: Расширить сигнатуру `useArtifacts`**

В `src/lib/hooks/use-artifacts.ts`:

```ts
interface UseArtifactsOptions {
  initialCatalog?: ArtifactCatalog[];
  initialInventory?: HeroArtifact[];
}

export function useArtifacts(opts: UseArtifactsOptions = {}) {
  const supabase = createClient();
  const [catalog, setCatalog] = useState<ArtifactCatalog[]>(opts.initialCatalog ?? []);
  const [inventory, setInventory] = useState<HeroArtifact[]>(opts.initialInventory ?? []);
  const [loading, setLoading] = useState(!(opts.initialCatalog && opts.initialInventory));

  // ... rest как раньше, но:

  // Skip mount fetch when both initial values are provided.
  useEffect(() => {
    if (opts.initialCatalog && opts.initialInventory) return;
    fetchArtifacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ... return как раньше
}
```

(Текущий useEffect на строке ~127 заменить на условный.)

- [ ] **Step 2: Передать данные из HeroPageClient**

В `HeroPageClient.tsx`:

```tsx
import type { HeroArtifact } from '@/lib/hooks/use-artifacts';

// ... внутри функции:
const heroArtifactsForHook = initialData.heroArtifacts as unknown as HeroArtifact[];
const { equipArtifact, inventory: dbInventory, refetch: refetchArtifacts } = useArtifacts({
  initialCatalog: initialData.artifactCatalog,
  initialInventory: heroArtifactsForHook,
});
```

(Тип `HeroArtifactRow` из `lib/hero/types` совпадает по форме с `HeroArtifact` из хука — `as unknown as` без рантайм-стоимости.)

- [ ] **Step 3: Smoke**

Run: `npm run dev`
Manual:
1. `/hero` — артефакты на полке видны сразу.
2. DevTools Network filter `artifacts`: 0 запросов на первой загрузке.
3. Экипировать/снять артефакт — мутация работает (через прокси, это норма).

- [ ] **Step 4: Тесты + lint**

Run: `npm run lint && npm test`

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/use-artifacts.ts "src/app/(student)/hero/HeroPageClient.tsx"
git commit -m "perf(hero): useArtifacts accepts initialCatalog and initialInventory"
```

---

## Task 10: `useClassRank` принимает опциональные initial-значения

**Files:**
- Modify: `src/lib/hooks/use-class-rank.ts`
- Modify: `src/app/(student)/hero/HeroPageClient.tsx`

- [ ] **Step 1: Расширить сигнатуру**

```ts
// src/lib/hooks/use-class-rank.ts
interface UseClassRankOptions {
  initialRank?: number | null;
  initialTotal?: number;
}

export function useClassRank(
  scope: 'class' | 'school' = 'class',
  opts: UseClassRankOptions = {},
) {
  const supabase = createClient();
  const { user } = useAuth();
  const [rank, setRank] = useState<number | null>(opts.initialRank ?? null);
  const [total, setTotal] = useState<number>(opts.initialTotal ?? 0);
  const [loading, setLoading] = useState(opts.initialRank === undefined);

  useEffect(() => {
    // Skip RPC if SSR already provided the rank.
    if (opts.initialRank !== undefined) return;
    let cancelled = false;
    (async () => {
      // ... остальной код useEffect без изменений
    })();
    return () => { cancelled = true; };
  }, [user, scope, supabase]);

  return { rank, total, loading };
}
```

- [ ] **Step 2: Передать значения из HeroPageClient**

```tsx
const { rank: classRank, total: classTotal } = useClassRank('class', {
  initialRank: initialData.classRank?.rank ?? null,
  initialTotal: initialData.classRank?.total ?? 0,
});
```

- [ ] **Step 3: Smoke**

Run: `npm run dev`
Manual: на `/hero` плитка «Ранг в классе» показывает значение сразу, без skeleton.

- [ ] **Step 4: Тесты + lint**

Run: `npm run lint && npm test`

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/use-class-rank.ts "src/app/(student)/hero/HeroPageClient.tsx"
git commit -m "perf(hero): useClassRank accepts initial rank/total from SSR"
```

---

## Task 11: Удалить прямые supabase-запросы (seasons/schools/classes) из HeroPageClient

**Files:**
- Modify: `src/app/(student)/hero/HeroPageClient.tsx`

После Task 7 у нас в `initialData` уже есть `seasonName`, `schoolName`, `className`. Удалить три `useEffect` с прямыми `supabase.from('seasons'/'schools'/'classes')`.

- [ ] **Step 1: Заменить useState + useEffect блоки на инициализацию из props**

В `HeroPageClient.tsx` найти:

```tsx
const [seasonName, setSeasonName] = useState<string | null>(null);
const [schoolName, setSchoolName] = useState<string | null>(null);
const [className, setClassName] = useState<string | null>(null);
```

Заменить на:

```tsx
const seasonName = initialData.seasonName;
const schoolName = initialData.schoolName;
const className = initialData.className;
```

Удалить три `useEffect` блока (строки ~171-193 в текущей версии — те что вызывают `supabase.from('seasons'/...)`).

Удалить из импортов `createClient` если больше нигде в файле не используется (грепнуть `createClient` внутри файла — если только эти три места — удалить импорт).

- [ ] **Step 2: Smoke**

Run: `npm run dev`
Manual:
1. `/hero` — название школы/класса/сезона видны сразу.
2. DevTools Network: 0 запросов к `seasons` / `schools` / `classes`.

- [ ] **Step 3: Lint + tests**

Run: `npm run lint && npm test`

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/hero/HeroPageClient.tsx"
git commit -m "perf(hero): drop client supabase queries for season/school/class names"
```

---

## Task 12: Финальная верификация

**Files:** none (manual + Ralph Loop)

- [ ] **Step 1: Полный test suite + lint + типы**

Run: `npm run lint && npm test && npx tsc --noEmit`
Expected: ✓ всё зелёное.

- [ ] **Step 2: Build production-сборки локально**

Run: `npm run build`
Expected: успех. Проверить что `/hero` помечен как `dynamic` в выводе билда.

- [ ] **Step 3: Smoke-сценарий целиком (npm run dev)**

1. Логин учеником → `/hero` рисуется с данными мгновенно (не должно быть skeleton).
2. DevTools Network filter `db2.hero-academy.ru` (или whatever proxy host):
   - 0 REST-запросов до hydrate (только `wss://` для realtime).
3. Экипировать артефакт → realtime обновил полку → ✓ (мутация через прокси, это OK).
4. Открыть страницу с домашкой, выполнить → вернуться в `/hero` → новые XP видны (через realtime или router.refresh).
5. Hard reload — данные те же.
6. Logout → login другим юзером → вместо данных предыдущего на `/hero` — данные нового.

- [ ] **Step 4: Lighthouse Mobile Slow 4G**

В Chrome DevTools → Lighthouse → Mode: Navigation, Device: Mobile, Throttling: Slow 4G.
Запустить на `/hero` под залогиненным юзером.
Зафиксировать TTI и FCP в комментарии финального коммита.

- [ ] **Step 5: Ralph Loop до 0 ошибок**

Запустить `/ralph-loop` (или эквивалент в проекте). Дождаться 0 ошибок.

- [ ] **Step 6: Финальный коммит со сводкой метрик**

Если есть изменения от Ralph Loop — закоммитить. Иначе — пуш и переход к user-тесту.

```bash
git push
```

Пользователь делает финальный smoke на телефоне с LTE без VPN. Если ускорение заметное — задача закрыта. Если нет или всплыла регрессия — debug.

---

## Self-Review

**Spec coverage:**

| Спек | Покрытие |
|---|---|
| Цель — убрать клиентские запросы из критического пути | Tasks 6-11 |
| Метрика: 0 REST к прокси до hydrate | Task 12 step 3 |
| Метрика: -500 мс TTI | Task 12 step 4 |
| Структура файлов | Tasks 1, 5, 6 |
| `force-dynamic` | Task 6 step 2 |
| `mappers.ts` чистые функции | Tasks 2-4 |
| `fetchers.ts` параллельный батч + try/catch | Task 5 |
| Server `page.tsx` с auth + redirect | Task 6 |
| `HeroPageClient` с синхронной гидратацией | Task 7 |
| Persist clear при смене юзера | Task 7 step 1 |
| `useSupabaseSync` skip на synced | Task 8 |
| `useArtifacts` initial params | Task 9 |
| `useClassRank` initial params | Task 10 |
| Удаление прямых supabase в page | Task 11 |
| Realtime не трогаем | покрыто (нет правок `useRealtimeHero`) |
| Vitest unit тесты на mappers | Tasks 2-4 |
| Smoke + Ralph + Lighthouse | Task 12 |

**Placeholder scan:** ✓ нет TBD/TODO/«similar to». Каждый шаг содержит код.

**Type consistency:** `HeroPageInitialData` определён в Task 1, используется в Tasks 5-7,9,10. `mapHero/mapStats/mapInventory/mapActivity` сигнатуры матчатся между определением и вызовом.
