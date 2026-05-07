# Мутации артефактов через API + Optimistic UI — план имплементации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести все мутации артефактов (equip/unequip, consume, sell) на серверные API-роуты + optimistic UI, чтобы клик ощущался мгновенно вместо 3-6 секунд ожидания на LTE.

**Architecture:** Три тонких POST-роута в `src/app/api/artifacts/*/route.ts`. Бизнес-логика в чистых хелперах в `src/lib/artifacts/server-helpers.ts` (тестируется юнитами). Хук `useArtifacts` делает `fetch` вместо direct supabase, обновляет state оптимистично перед запросом и откатывает при ошибке.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr` (auth), `@supabase/supabase-js` admin client (server writes), Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-07-artifact-actions-api.md`](../specs/2026-05-07-artifact-actions-api.md)

---

## Структура файлов

| Файл | Что делает |
|---|---|
| `src/lib/artifacts/server-helpers.ts` (новый) | Чистые функции: `validateEquip`, `calculateSellRefund`, `classifyConsumeEffect`, `getMaxEquipSlots` |
| `src/lib/artifacts/__tests__/server-helpers.test.ts` (новый) | Vitest юниты на хелперы |
| `src/app/api/artifacts/equip/route.ts` (новый) | POST handler |
| `src/app/api/artifacts/sell/route.ts` (новый) | POST handler |
| `src/app/api/artifacts/consume/route.ts` (новый) | POST handler (instant — inline, complex — делегирует на `/api/game/use-artifact`) |
| `src/lib/hooks/use-artifacts.ts` (правка) | Внутри `equipArtifact`/`consumeArtifact`/`sellArtifact` заменяем direct supabase на fetch + optimistic |

Существующий `src/app/api/game/use-artifact/route.ts` НЕ меняется — он остаётся для complex consumables.

---

## Task 1: Чистые хелперы для бизнес-логики артефактов

**Files:**
- Create: `src/lib/artifacts/server-helpers.ts`
- Create: `src/lib/artifacts/__tests__/server-helpers.test.ts`

Извлекаем всю валидацию и расчёт из текущих хук-функций (`use-artifacts.ts:148-207`, `:329`) в чистые функции. Цель — иметь юнит-тестируемую логику без зависимостей от Supabase или React.

- [ ] **Step 1: Написать failing tests**

```ts
// src/lib/artifacts/__tests__/server-helpers.test.ts
import { describe, it, expect } from 'vitest';
import {
  getMaxEquipSlots,
  validateEquip,
  calculateSellRefund,
  classifyConsumeEffect,
} from '../server-helpers';

describe('getMaxEquipSlots', () => {
  it('returns 1 for level 1-2', () => {
    expect(getMaxEquipSlots(1)).toBe(1);
    expect(getMaxEquipSlots(2)).toBe(1);
  });
  it('opens slots every 3 levels, caps at 6', () => {
    expect(getMaxEquipSlots(3)).toBe(2);
    expect(getMaxEquipSlots(6)).toBe(3);
    expect(getMaxEquipSlots(9)).toBe(4);
    expect(getMaxEquipSlots(12)).toBe(5);
    expect(getMaxEquipSlots(15)).toBe(6);
    expect(getMaxEquipSlots(99)).toBe(6);
  });
});

describe('validateEquip', () => {
  const baseArt = {
    artifact_type: 'passive',
    effect: 'xp_boost',
    effect_value: 10,
    duration_hours: 0,
    min_level: 1,
  };

  it('rejects when hero level below min_level', () => {
    const r = validateEquip({
      heroLevel: 2,
      artifact: { ...baseArt, min_level: 5 },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('level_too_low');
  });

  it('rejects when slots full', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: baseArt,
      currentlyEquippedExclSelf: 2,
      isExpired: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('slots_full');
  });

  it('rejects expired artifact (cannot re-equip)', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: baseArt,
      currentlyEquippedExclSelf: 0,
      isExpired: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('expired');
  });

  it('rejects instant consumable (must be drunk, not equipped)', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: { ...baseArt, artifact_type: 'consumable', effect: 'hp_restore' },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_equippable');
  });

  it('accepts valid equip', () => {
    const r = validateEquip({
      heroLevel: 5,
      artifact: baseArt,
      currentlyEquippedExclSelf: 1,
      isExpired: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.expiresAt).toBeNull();
  });

  it('returns expiresAt when artifact has duration', () => {
    const before = Date.now();
    const r = validateEquip({
      heroLevel: 5,
      artifact: { ...baseArt, duration_hours: 24 },
      currentlyEquippedExclSelf: 0,
      isExpired: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.expiresAt) {
      const ms = new Date(r.expiresAt).getTime();
      expect(ms).toBeGreaterThanOrEqual(before + 24 * 3600_000 - 1000);
      expect(ms).toBeLessThanOrEqual(before + 24 * 3600_000 + 1000);
    }
  });
});

describe('calculateSellRefund', () => {
  it('floors drop_rate * 5', () => {
    expect(calculateSellRefund(10)).toBe(50);
    expect(calculateSellRefund(2.5)).toBe(12);
    expect(calculateSellRefund(0)).toBe(0);
  });
  it('falls back to 10 when drop_rate undefined', () => {
    expect(calculateSellRefund(null)).toBe(50);
    expect(calculateSellRefund(undefined)).toBe(50);
  });
});

describe('classifyConsumeEffect', () => {
  it('classifies hp_restore as instant', () => {
    expect(classifyConsumeEffect('hp_restore')).toBe('instant');
    expect(classifyConsumeEffect('hp_restore_30')).toBe('instant');
  });
  it('classifies xp_instant variants as instant', () => {
    expect(classifyConsumeEffect('xp_instant')).toBe('instant');
    expect(classifyConsumeEffect('xp_instant_50')).toBe('instant');
  });
  it('classifies extra_gold and gold_instant as instant', () => {
    expect(classifyConsumeEffect('extra_gold')).toBe('instant');
    expect(classifyConsumeEffect('gold_instant')).toBe('instant');
  });
  it('classifies level_up as instant', () => {
    expect(classifyConsumeEffect('level_up')).toBe('instant');
  });
  it('classifies consumable_* and gold_bonus as complex', () => {
    expect(classifyConsumeEffect('consumable_class_xp')).toBe('complex');
    expect(classifyConsumeEffect('gold_bonus')).toBe('complex');
  });
  it('classifies passive effects as not_consumable', () => {
    expect(classifyConsumeEffect('xp_boost')).toBe('not_consumable');
    expect(classifyConsumeEffect('damage_shield')).toBe('not_consumable');
    expect(classifyConsumeEffect('')).toBe('not_consumable');
  });
});
```

- [ ] **Step 2: Запустить — должны упасть (модуль не существует)**

```bash
cd /Users/macbookm/Hero\ academy/hero-academy
npm test -- src/lib/artifacts
```
Expected: FAIL — `Cannot find module '../server-helpers'`.

- [ ] **Step 3: Реализовать хелперы**

```ts
// src/lib/artifacts/server-helpers.ts
// Pure functions extracted from useArtifacts hook for server-side reuse
// and unit testing without Supabase dependencies.

export function getMaxEquipSlots(heroLevel: number): number {
  if (heroLevel >= 15) return 6;
  if (heroLevel >= 12) return 5;
  if (heroLevel >= 9) return 4;
  if (heroLevel >= 6) return 3;
  if (heroLevel >= 3) return 2;
  return 1;
}

export type ValidateEquipInput = {
  heroLevel: number;
  artifact: {
    artifact_type?: string | null;
    effect?: string | null;
    effect_value?: number | null;
    duration_hours?: number | null;
    min_level?: number | null;
  };
  currentlyEquippedExclSelf: number;
  isExpired: boolean;
};

export type ValidateEquipResult =
  | { ok: true; expiresAt: string | null }
  | { ok: false; code: 'level_too_low' | 'slots_full' | 'expired' | 'not_equippable'; message: string };

const INSTANT_EFFECT_PREFIXES = ['hp_restore', 'xp_instant', 'gold_instant'];
const INSTANT_EFFECT_EXACT = new Set(['extra_gold', 'level_up']);

function isInstantConsumableEffect(effect: string): boolean {
  if (INSTANT_EFFECT_EXACT.has(effect)) return true;
  return INSTANT_EFFECT_PREFIXES.some((p) => effect === p || effect.startsWith(`${p}_`));
}

export function validateEquip(input: ValidateEquipInput): ValidateEquipResult {
  const { heroLevel, artifact, currentlyEquippedExclSelf, isExpired } = input;
  const effect = artifact.effect ?? '';

  if (isExpired) {
    return { ok: false, code: 'expired', message: 'Срок действия артефакта истёк.' };
  }

  if (artifact.artifact_type === 'consumable' && isInstantConsumableEffect(effect)) {
    return { ok: false, code: 'not_equippable', message: 'Мгновенные зелья нельзя экипировать. Используйте «Применить».' };
  }

  const minLevel = artifact.min_level ?? 1;
  if (heroLevel < minLevel) {
    return { ok: false, code: 'level_too_low', message: `Требуется уровень ${minLevel}. Ваш: ${heroLevel}` };
  }

  const maxSlots = getMaxEquipSlots(heroLevel);
  if (currentlyEquippedExclSelf >= maxSlots) {
    return { ok: false, code: 'slots_full', message: `Все слоты заняты (${maxSlots}). Снимите другой артефакт.` };
  }

  const durationH = artifact.duration_hours ?? 0;
  const expiresAt = durationH > 0 ? new Date(Date.now() + durationH * 3600_000).toISOString() : null;
  return { ok: true, expiresAt };
}

export function calculateSellRefund(dropRate: number | null | undefined): number {
  const rate = dropRate ?? 10;
  return Math.floor(rate * 5);
}

export type ConsumeEffectKind = 'instant' | 'complex' | 'not_consumable';

export function classifyConsumeEffect(effect: string | null | undefined): ConsumeEffectKind {
  const e = effect ?? '';
  if (!e) return 'not_consumable';
  if (isInstantConsumableEffect(e)) return 'instant';
  if (e.startsWith('consumable_') || e === 'gold_bonus') return 'complex';
  return 'not_consumable';
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

```bash
npm test -- src/lib/artifacts
```
Expected: 16+ passed (4 + 6 + 2 + 4 = depending on it() count).

- [ ] **Step 5: Type check + lint**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -10
npm run lint 2>&1 | grep "src/lib/artifacts" | head -10
```
Expected: 0 errors / no new warnings.

- [ ] **Step 6: Commit**

From `/Users/macbookm/Hero academy`:
```bash
git add hero-academy/src/lib/artifacts
git commit -m "feat(artifacts): pure server helpers for equip/sell/consume validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 2: API-роут `POST /api/artifacts/equip`

**Files:**
- Create: `src/app/api/artifacts/equip/route.ts`

- [ ] **Step 1: Реализовать роут**

```ts
// src/app/api/artifacts/equip/route.ts
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { validateEquip, getMaxEquipSlots } from '@/lib/artifacts/server-helpers';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface EquipBody {
  heroArtifactId?: string;
  equip?: boolean;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Не авторизован' } }, { status: 401 });
    }

    const body = (await req.json()) as EquipBody;
    const { heroArtifactId, equip } = body;
    if (!heroArtifactId || typeof equip !== 'boolean') {
      return NextResponse.json({ error: { code: 'bad_request', message: 'heroArtifactId и equip обязательны' } }, { status: 400 });
    }

    // Load hero_artifact + joined artifact + hero in parallel
    const [entryRes, heroRes] = await Promise.all([
      admin.from('hero_artifacts').select('*, artifact:artifact_id(*)').eq('id', heroArtifactId).single(),
      admin.from('heroes').select('id, level').eq('user_id', user.id).single(),
    ]);

    if (!entryRes.data) {
      return NextResponse.json({ error: { code: 'artifact_not_found', message: 'Артефакт не найден' } }, { status: 404 });
    }
    if (!heroRes.data) {
      return NextResponse.json({ error: { code: 'hero_not_found', message: 'Герой не найден' } }, { status: 404 });
    }

    const entry = entryRes.data;
    const hero = heroRes.data;

    if (entry.hero_id !== hero.id) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Не ваш артефакт' } }, { status: 403 });
    }

    const isExpired = !!entry.expires_at && new Date(entry.expires_at).getTime() < Date.now();

    // ── Unequip path ───────────────────────────────────────────────
    if (!equip) {
      // Active duration artifact — block unequip until it expires
      if (entry.expires_at && !isExpired) {
        const remainMs = new Date(entry.expires_at).getTime() - Date.now();
        const h = Math.floor(remainMs / 3600_000);
        const label = h < 24 ? `${h}ч` : `${Math.floor(h / 24)}д ${h % 24}ч`;
        return NextResponse.json({
          error: { code: 'slot_locked', message: `Нельзя снять — артефакт активен ещё ${label}.` },
        }, { status: 409 });
      }

      // Expired → DELETE; else UPDATE is_equipped: false
      if (isExpired) {
        await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);
        return NextResponse.json({ deleted: true, heroArtifactId });
      }

      const { data: updated, error } = await admin
        .from('hero_artifacts')
        .update({ is_equipped: false })
        .eq('id', heroArtifactId)
        .select('*, artifact:artifact_id(*)')
        .single();
      if (error || !updated) {
        return NextResponse.json({ error: { code: 'internal', message: error?.message ?? 'Ошибка обновления' } }, { status: 500 });
      }
      return NextResponse.json({ heroArtifact: updated });
    }

    // ── Equip path ─────────────────────────────────────────────────
    // Count currently equipped excluding self
    const { data: equippedList } = await admin
      .from('hero_artifacts')
      .select('id')
      .eq('hero_id', hero.id)
      .eq('is_equipped', true)
      .neq('id', heroArtifactId);
    const currentlyEquippedExclSelf = equippedList?.length ?? 0;

    const validation = validateEquip({
      heroLevel: hero.level,
      artifact: entry.artifact as Parameters<typeof validateEquip>[0]['artifact'],
      currentlyEquippedExclSelf,
      isExpired,
    });

    if (!validation.ok) {
      // Если истёк — удаляем
      if (validation.code === 'expired') {
        await admin.from('hero_artifacts').delete().eq('id', heroArtifactId);
      }
      const status = validation.code === 'level_too_low' || validation.code === 'slots_full'
        || validation.code === 'expired' || validation.code === 'not_equippable' ? 409 : 400;
      return NextResponse.json({ error: { code: validation.code, message: validation.message } }, { status });
    }

    const updateData: Record<string, unknown> = { is_equipped: true };
    if (validation.expiresAt) updateData.expires_at = validation.expiresAt;

    const { data: updated, error } = await admin
      .from('hero_artifacts')
      .update(updateData)
      .eq('id', heroArtifactId)
      .select('*, artifact:artifact_id(*)')
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: { code: 'internal', message: error?.message ?? 'Ошибка обновления' } }, { status: 500 });
    }

    // Fire-and-forget team artifact notify (preserved from current behavior)
    const effect = String((entry.artifact as { effect?: string }).effect ?? '');
    const isTeamArtifact = effect.split(',').some((e) => e.trim().startsWith('team_'));
    if (isTeamArtifact) {
      const origin = req.headers.get('origin') ?? '';
      if (origin) {
        fetch(`${origin}/api/game/team-artifact-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
          body: JSON.stringify({ heroArtifactId }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ heroArtifact: updated, maxSlots: getMaxEquipSlots(hero.level) });
  } catch (err) {
    console.error('[api/artifacts/equip] error:', err);
    return NextResponse.json({ error: { code: 'internal', message: 'Внутренняя ошибка' } }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Build sanity check**

```bash
npm run build 2>&1 | grep -E "/api/artifacts/equip|error|Error" | head -10
```
Expected: route appears in build output as `ƒ /api/artifacts/equip`. No errors.

- [ ] **Step 4: Lint**

```bash
npm run lint 2>&1 | grep "src/app/api/artifacts/equip" | head -10
```
Expected: no new warnings.

- [ ] **Step 5: Commit**

```bash
git add hero-academy/src/app/api/artifacts/equip
git commit -m "feat(artifacts): server route POST /api/artifacts/equip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 3: API-роут `POST /api/artifacts/sell`

**Files:**
- Create: `src/app/api/artifacts/sell/route.ts`

- [ ] **Step 1: Реализовать роут**

```ts
// src/app/api/artifacts/sell/route.ts
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { calculateSellRefund } from '@/lib/artifacts/server-helpers';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface SellBody {
  heroArtifactId?: string;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Не авторизован' } }, { status: 401 });
    }

    const { heroArtifactId } = (await req.json()) as SellBody;
    if (!heroArtifactId) {
      return NextResponse.json({ error: { code: 'bad_request', message: 'heroArtifactId обязателен' } }, { status: 400 });
    }

    const [entryRes, heroRes] = await Promise.all([
      admin.from('hero_artifacts').select('*, artifact:artifact_id(*)').eq('id', heroArtifactId).single(),
      admin.from('heroes').select('id, gold').eq('user_id', user.id).single(),
    ]);

    if (!entryRes.data) {
      return NextResponse.json({ error: { code: 'artifact_not_found', message: 'Артефакт не найден' } }, { status: 404 });
    }
    if (!heroRes.data) {
      return NextResponse.json({ error: { code: 'hero_not_found', message: 'Герой не найден' } }, { status: 404 });
    }

    const entry = entryRes.data;
    const hero = heroRes.data;

    if (entry.hero_id !== hero.id) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Не ваш артефакт' } }, { status: 403 });
    }

    const dropRate = (entry.artifact as { drop_rate?: number | null } | null)?.drop_rate;
    const refund = calculateSellRefund(dropRate);
    const newGold = (hero.gold as number) + refund;

    const [delRes, updRes] = await Promise.all([
      admin.from('hero_artifacts').delete().eq('id', heroArtifactId),
      admin.from('heroes').update({ gold: newGold }).eq('id', hero.id),
    ]);

    if (delRes.error || updRes.error) {
      return NextResponse.json({
        error: { code: 'internal', message: delRes.error?.message ?? updRes.error?.message ?? 'Ошибка' },
      }, { status: 500 });
    }

    return NextResponse.json({ refund, gold: newGold, deletedHeroArtifactId: heroArtifactId });
  } catch (err) {
    console.error('[api/artifacts/sell] error:', err);
    return NextResponse.json({ error: { code: 'internal', message: 'Внутренняя ошибка' } }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -20
npm run build 2>&1 | grep -E "/api/artifacts/sell|error|Error" | head -10
```
Expected: 0 tsc errors, route builds.

- [ ] **Step 3: Commit**

```bash
git add hero-academy/src/app/api/artifacts/sell
git commit -m "feat(artifacts): server route POST /api/artifacts/sell

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 4: API-роут `POST /api/artifacts/consume`

**Files:**
- Create: `src/app/api/artifacts/consume/route.ts`

Логика: instant-эффекты (`hp_restore`, `xp_instant`, `extra_gold`, `level_up`, `gold_instant`) обрабатываются inline (UPDATE героя + INSERT activity_log + DELETE hero_artifacts параллельно). Complex-эффекты (`consumable_*`, `gold_bonus`) — делегирует на существующий `/api/game/use-artifact`.

- [ ] **Step 1: Реализовать роут**

```ts
// src/app/api/artifacts/consume/route.ts
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { classifyConsumeEffect } from '@/lib/artifacts/server-helpers';
import { cumulativeXpForLevel } from '@/lib/game/math';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ConsumeBody {
  heroArtifactId?: string;
}

interface HeroRow {
  id: string;
  user_id: string;
  level: number;
  xp: number;
  xp_to_next: number;
  hp: number;
  hp_max: number;
  gold: number;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Не авторизован' } }, { status: 401 });
    }

    const { heroArtifactId } = (await req.json()) as ConsumeBody;
    if (!heroArtifactId) {
      return NextResponse.json({ error: { code: 'bad_request', message: 'heroArtifactId обязателен' } }, { status: 400 });
    }

    const [entryRes, heroRes] = await Promise.all([
      admin.from('hero_artifacts').select('*, artifact:artifact_id(*)').eq('id', heroArtifactId).single(),
      admin.from('heroes').select('id, user_id, level, xp, xp_to_next, hp, hp_max, gold').eq('user_id', user.id).single(),
    ]);

    if (!entryRes.data) {
      return NextResponse.json({ error: { code: 'artifact_not_found', message: 'Артефакт не найден' } }, { status: 404 });
    }
    if (!heroRes.data) {
      return NextResponse.json({ error: { code: 'hero_not_found', message: 'Герой не найден' } }, { status: 404 });
    }

    const entry = entryRes.data;
    const hero = heroRes.data as HeroRow;
    const art = entry.artifact as { name?: string; effect?: string; effect_type?: string; effect_value?: number };

    if (entry.hero_id !== hero.id) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Не ваш артефакт' } }, { status: 403 });
    }

    const effect = art?.effect ?? art?.effect_type ?? '';
    const val = Number(art?.effect_value ?? 0);
    const artName = art?.name ?? 'Артефакт';
    const kind = classifyConsumeEffect(effect);

    if (kind === 'not_consumable') {
      return NextResponse.json({
        error: { code: 'not_consumable', message: 'Этот предмет нельзя использовать. Экипируйте его.' },
      }, { status: 400 });
    }

    if (kind === 'complex') {
      // Delegate to existing /api/game/use-artifact (preserves all class-wide / scaling logic)
      const origin = req.headers.get('origin') ?? '';
      const cookie = req.headers.get('cookie') ?? '';
      const upstream = await fetch(`${origin}/api/game/use-artifact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ heroArtifactId }),
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }

    // ── Instant effects (inline) ───────────────────────────────────
    const heroUpdate: Record<string, unknown> = {};
    const logChanges: Record<string, unknown> = {};
    let resultPayload: Record<string, unknown> = { effect, value: val };

    if (effect === 'hp_restore' || effect.startsWith('hp_restore_')) {
      const newHp = Math.min(hero.hp_max || 100, hero.hp + val);
      heroUpdate.hp = newHp;
      heroUpdate.status = 'active';
      logChanges.hp_change = val;
      resultPayload = { effect: 'hp_restore', value: val };
    } else if (effect === 'xp_instant' || effect.startsWith('xp_instant_')) {
      const newXp = hero.xp + val;
      let newLevel = hero.level;
      while (newXp >= cumulativeXpForLevel(newLevel + 1)) newLevel++;
      heroUpdate.xp = newXp;
      heroUpdate.level = newLevel;
      heroUpdate.xp_to_next = cumulativeXpForLevel(newLevel + 1);
      logChanges.xp_change = val;
      resultPayload = { effect: 'xp_instant', value: val };
    } else if (effect === 'extra_gold' || effect === 'gold_instant') {
      heroUpdate.gold = hero.gold + val;
      logChanges.gold_change = val;
      resultPayload = { effect: 'extra_gold', value: val };
    } else if (effect === 'level_up') {
      const newLevel = hero.level + 1;
      heroUpdate.level = newLevel;
      heroUpdate.xp = cumulativeXpForLevel(newLevel);
      heroUpdate.xp_to_next = cumulativeXpForLevel(newLevel + 1);
      resultPayload = { effect: 'level_up', value: newLevel };
    } else {
      // Should not reach here since classifyConsumeEffect already gated
      return NextResponse.json({ error: { code: 'not_consumable', message: 'Неизвестный эффект' } }, { status: 400 });
    }

    // Apply: UPDATE hero, INSERT activity_log, DELETE hero_artifact — parallel
    const [updateRes, _logRes, _delRes] = await Promise.all([
      admin.from('heroes').update(heroUpdate).eq('id', hero.id).select('id, level, xp, xp_to_next, hp, hp_max, gold').single(),
      admin.from('activity_log').insert({
        hero_id: hero.id,
        user_id: user.id,
        action: 'potion_used',
        ...logChanges,
        metadata: { artifact: artName },
      }),
      admin.from('hero_artifacts').delete().eq('id', heroArtifactId),
    ]);

    if (updateRes.error) {
      return NextResponse.json({ error: { code: 'internal', message: updateRes.error.message } }, { status: 500 });
    }

    return NextResponse.json({
      ...resultPayload,
      hero: updateRes.data,
      deletedHeroArtifactId: heroArtifactId,
    });
  } catch (err) {
    console.error('[api/artifacts/consume] error:', err);
    return NextResponse.json({ error: { code: 'internal', message: 'Внутренняя ошибка' } }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -20
npm run build 2>&1 | grep -E "/api/artifacts/consume|error|Error" | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Run unit tests (no test changes, just sanity)**

```bash
npm test
```
Expected: still 160+ pass (Task 1 added some).

- [ ] **Step 4: Commit**

```bash
git add hero-academy/src/app/api/artifacts/consume
git commit -m "feat(artifacts): server route POST /api/artifacts/consume

Inline для instant-эффектов (hp/xp/gold/level), делегирует complex
на существующий /api/game/use-artifact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 5: Рефактор `useArtifacts.equipArtifact`

**Files:**
- Modify: `src/lib/hooks/use-artifacts.ts`

Заменяем direct supabase-мутации на `fetch('/api/artifacts/equip', ...)` с optimistic update + rollback. Убираем `await fetchArtifacts()` из success-path.

- [ ] **Step 1: Прочитать существующую `equipArtifact`**

```bash
sed -n '147,235p' src/lib/hooks/use-artifacts.ts
```
Изучить shape return value: `{ error: string | null }`. Сохраняем сигнатуру.

- [ ] **Step 2: Заменить тело функции**

Найти `const equipArtifact = useCallback(async (heroArtifactId: string, equip: boolean) => {` и заменить ВСЁ тело (до закрывающего `}, [supabase, inventory, fetchArtifacts]);`) на:

```ts
  const equipArtifact = useCallback(async (heroArtifactId: string, equip: boolean): Promise<{ error: string | null }> => {
    const prevInventory = inventory;

    // Optimistic update
    setInventory(curr => curr.map(i =>
      i.id === heroArtifactId ? { ...i, is_equipped: equip } : i
    ));

    try {
      const res = await fetch('/api/artifacts/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroArtifactId, equip }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInventory(prevInventory);
        return { error: data.error?.message ?? 'Не получилось' };
      }

      // Reconcile with server response
      if (data.deleted) {
        setInventory(curr => curr.filter(i => i.id !== heroArtifactId));
      } else if (data.heroArtifact) {
        setInventory(curr => curr.map(i => i.id === data.heroArtifact.id ? data.heroArtifact : i));
      }
      return { error: null };
    } catch (err) {
      setInventory(prevInventory);
      const msg = err instanceof Error ? err.message : 'Сетевая ошибка';
      return { error: msg };
    }
  }, [inventory]);
```

(Убираем `supabase` и `fetchArtifacts` из deps — они больше не нужны в этой функции.)

- [ ] **Step 3: Type check + lint + tests + build**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -20
npm run lint 2>&1 | grep "use-artifacts" | head -5
npm test
npm run build 2>&1 | tail -10
```
Expected: 0 tsc errors, no new lint, tests still pass, build success.

- [ ] **Step 4: Commit**

```bash
git add hero-academy/src/lib/hooks/use-artifacts.ts
git commit -m "perf(artifacts): equipArtifact via /api/artifacts/equip + optimistic UI

Заменяет 4-5 round-trip'ов через прокси на 1 запрос к Vercel.
Optimistic update делает клик мгновенным, rollback при ошибке.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 6: Рефактор `useArtifacts.consumeArtifact`

**Files:**
- Modify: `src/lib/hooks/use-artifacts.ts`

- [ ] **Step 1: Заменить тело `consumeArtifact`**

Найти `const consumeArtifact = useCallback(async (heroArtifactId: string): Promise<{ error: string | null; effect?: string; value?: number; message?: string }> => {` и заменить ВСЁ тело до закрывающего `}, [supabase, inventory, fetchArtifacts]);` на:

```ts
  const consumeArtifact = useCallback(async (heroArtifactId: string): Promise<{ error: string | null; effect?: string; value?: number; message?: string }> => {
    const prevInventory = inventory;

    // Optimistic remove (the artifact will be deleted on success)
    setInventory(curr => curr.filter(i => i.id !== heroArtifactId));

    try {
      const res = await fetch('/api/artifacts/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroArtifactId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInventory(prevInventory);
        return { error: data.error?.message ?? data.error ?? 'Не получилось' };
      }

      // Hero stats (hp/xp/gold/level) come back from server when instant —
      // realtime subscription updates the zustand store, so we don't write here.
      return {
        error: null,
        effect: data.effect,
        value: data.value,
        message: data.message,
      };
    } catch (err) {
      setInventory(prevInventory);
      const msg = err instanceof Error ? err.message : 'Сетевая ошибка';
      return { error: msg };
    }
  }, [inventory]);
```

(Убираем `supabase`, `fetchArtifacts` из deps.)

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -20
npm run lint 2>&1 | grep "use-artifacts" | head -5
npm test
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add hero-academy/src/lib/hooks/use-artifacts.ts
git commit -m "perf(artifacts): consumeArtifact via /api/artifacts/consume + optimistic UI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 7: Рефактор `useArtifacts.sellArtifact`

**Files:**
- Modify: `src/lib/hooks/use-artifacts.ts`

- [ ] **Step 1: Заменить тело `sellArtifact`**

Найти `const sellArtifact = useCallback(async (heroArtifactId: string) => {` и заменить ВСЁ тело до закрывающего `}, [supabase, inventory, fetchArtifacts]);` на:

```ts
  const sellArtifact = useCallback(async (heroArtifactId: string): Promise<{ error: string | null; refund?: number }> => {
    const prevInventory = inventory;

    // Optimistic remove
    setInventory(curr => curr.filter(i => i.id !== heroArtifactId));

    try {
      const res = await fetch('/api/artifacts/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroArtifactId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInventory(prevInventory);
        return { error: data.error?.message ?? 'Не получилось' };
      }

      // gold change comes via realtime subscription on heroes table
      return { error: null, refund: data.refund };
    } catch (err) {
      setInventory(prevInventory);
      const msg = err instanceof Error ? err.message : 'Сетевая ошибка';
      return { error: msg };
    }
  }, [inventory]);
```

После замены всех трёх функций блок импортов/declarations внутри хука может содержать `supabase` который больше не нужен в мутациях — НЕ трогаем его, поскольку `fetchArtifacts` всё ещё его использует для refetch (на mount + refetch action).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -20
npm run lint 2>&1 | grep "use-artifacts" | head -5
npm test
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add hero-academy/src/lib/hooks/use-artifacts.ts
git commit -m "perf(artifacts): sellArtifact via /api/artifacts/sell + optimistic UI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Task 8: Финальная верификация

**Files:** none (verification only)

- [ ] **Step 1: Полный тест-suite + lint + tsc**

```bash
cd /Users/macbookm/Hero\ academy/hero-academy
npm test
npm run lint 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep -v '\.next/types/' | head -10
```
Expected:
- Tests: ≥ 160 + новые из Task 1 (≈18+) — все pass
- Lint: 30 problems (pre-existing, без наших новых)
- tsc: 0 errors

- [ ] **Step 2: Production build**

```bash
npm run build 2>&1 | tail -30
```
Expected: успех. В выводе должны быть три новых route'a:
- `ƒ /api/artifacts/equip`
- `ƒ /api/artifacts/sell`
- `ƒ /api/artifacts/consume`

- [ ] **Step 3: Smoke в dev-сервере**

```bash
npm run dev &
sleep 8
# В логе должны быть строки "Ready in" без compilation errors
```

Manual testing (пользователь делает сам, мы готовим чеклист):
1. Залогиниться учеником на `/hero` или `/inventory`
2. Открыть DevTools → Network
3. Надеть артефакт — кликнуть на свободный слот:
   - Визуально артефакт **сразу** в слоте (optimistic)
   - В Network — один запрос на `POST /api/artifacts/equip`, статус 200, время <500мс
4. Снять артефакт — клик «снять»:
   - Слот **сразу** освобождается
   - Один запрос `POST /api/artifacts/equip` с `equip: false`
5. Выпить мгновенное зелье (hp_restore):
   - Зелье **сразу** исчезает из инвентаря
   - HP/XP/gold обновляется через realtime в течение секунды
   - Один запрос `POST /api/artifacts/consume`
6. Использовать complex эффект (`consumable_class_xp` или похожий):
   - Один запрос `POST /api/artifacts/consume` → внутри сервер делегирует на `/api/game/use-artifact`
   - Результат корректен
7. Продать артефакт:
   - Артефакт **сразу** ушёл из инвентаря
   - Gold обновился через realtime
   - Один запрос `POST /api/artifacts/sell`
8. Симулировать ошибку:
   - Открыть DevTools → Network → set to "Offline"
   - Кликнуть «надеть» — UI попытался, но откатился; должен появиться тост (или вернуться к старому состоянию)

- [ ] **Step 4: Проверка отсутствия regression**

Перед мерджем убедиться что других страниц НЕ ломали:
- `/inventory` — equip/unequip/use/sell всё работает (там тоже useArtifacts())
- `/artifacts` — то же самое
- `/shop` — покупает артефакты (через отдельный код, не через useArtifacts мутации; не должно быть затронуто)

- [ ] **Step 5: Final commit (если были фиксы во время smoke)**

Если smoke выявил проблемы — пофиксить, закоммитить отдельным коммитом.
Если всё ок — пушим итог.

```bash
git push
```

---

## Self-Review

**Spec coverage:**

| Спека | Покрытие |
|---|---|
| `POST /api/artifacts/equip` (auth, validation, equip+unequip) | Task 2 |
| `POST /api/artifacts/sell` (refund, gold update, parallel ops) | Task 3 |
| `POST /api/artifacts/consume` (instant inline, complex delegation) | Task 4 |
| Чистые хелперы для бизнес-логики (DRY) | Task 1 |
| Юнит-тесты на хелперы | Task 1 |
| Optimistic UI с rollback на ошибку | Tasks 5, 6, 7 |
| Убираем `fetchArtifacts()` из success-path | Tasks 5, 6, 7 |
| Сохранение публичного API хука (сигнатуры) | Tasks 5, 6, 7 |
| Сохранение `team-artifact-notify` fire-and-forget | Task 2 |
| Метрика: 1 HTTP-запрос на действие | Tasks 2-4 (по дизайну — один POST) |
| Smoke-сценарии (5 действий + offline) | Task 8 |

**Placeholder scan:** ✓ нет TBD/TODO. Каждый шаг содержит код или точную команду.

**Type consistency:** `validateEquip` сигнатура определена в Task 1, используется в Task 2. `classifyConsumeEffect` — в Task 1, используется в Task 4. `calculateSellRefund` — в Task 1, используется в Task 3. Поля ответов API (`heroArtifact`, `deletedHeroArtifactId`, `refund`, `effect`/`value`/`message`) определены в Tasks 2-4 и читаются в Tasks 5-7 — совпадают.

**Note:** Юнит-тесты на сами роуты (с mock supabase chains) не входят в скоуп — это потребовало бы 100+ строк mocks per route, ROI низкий. Логика покрыта тестами на хелперах в Task 1; роуты — тонкий plumbing над ними. Финальная проверка через manual smoke в Task 8.
