# Class Artifact Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student equips a team artifact or uses a class-wide potion, all classmates see an activity log entry + a carousel banner with countdown timer on the hero page.

**Architecture:** Backend logs `team_artifact_activated` to `activity_log` for all class heroes. New `/api/game/class-auras` endpoint wraps `getClassAuras()` (extended with detailed aura objects) for client consumption. New `ClassAuraBanner` component renders carousel with countdown on hero page.

**Tech Stack:** Next.js API routes, Supabase admin client, React 19, Zustand, CSS Modules

---

### Task 1: Add TEAM_ARTIFACT_ACTIVATED action to constants

**Files:**
- Modify: `src/lib/game/constants.ts:137-153`

- [ ] **Step 1: Add the new action constant**

In `src/lib/game/constants.ts`, add `TEAM_ARTIFACT_ACTIVATED` to the `ACTIVITY_ACTIONS` object (after line 152, before the closing `} as const`):

```typescript
export const ACTIVITY_ACTIONS = {
  TEACHER_DAMAGE:     'teacher_damage',
  TEACHER_XP_GRANT:   'teacher_xp_grant',
  TEACHER_GOLD_GRANT: 'teacher_gold_grant',
  QUEST_GRADED:       'quest_graded',
  QUEST_COMPLETE:     'quest_complete',
  BOSS_DAMAGE:        'boss_damage',
  BOSS_KILL_REWARD:   'boss_kill_reward',
  ARTIFACT_DROP:      'artifact_drop',
  SHOP_PURCHASE:      'shop_purchase',
  POTION_USED:        'potion_used',
  LOOTBOX_OPENED:     'lootbox_opened',
  STREAK_UPDATE:      'streak_update',
  STREAK_REWARD:      'streak_reward',   // legacy — historical logs
  LEVEL_UP:           'level_up',
  ADMIN_UNDO:         'admin_undo',
  TEAM_ARTIFACT_ACTIVATED: 'team_artifact_activated',
} as const;
```

- [ ] **Step 2: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/game/constants.ts
git commit -m "feat: add TEAM_ARTIFACT_ACTIVATED action constant"
```

---

### Task 2: Log team_artifact_activated for class consumables

**Files:**
- Modify: `src/app/api/game/use-artifact/route.ts:131-249`

The existing class consumable handlers (`consumable_class_hp`, `consumable_class_xp`, `consumable_class_gold`) already iterate over all class heroes and insert `class_artifact_used` log entries. We need to **also** insert a `team_artifact_activated` entry for each hero with richer metadata.

- [ ] **Step 1: Add ACTIVITY_ACTIONS import**

At the top of `src/app/api/game/use-artifact/route.ts` (line 4), add:

```typescript
import { applyXpGain, ACTIVITY_ACTIONS } from '@/lib/game/constants';
```

(Replace the existing `import { applyXpGain } from '@/lib/game/constants';`)

- [ ] **Step 2: Create helper for team notification log entries**

After the existing `logActivity` helper (after line 88), add:

```typescript
    // Helper: log team artifact activation for all class heroes
    const logTeamActivation = async (
      heroes: { id: string; user_id: string }[],
      opts: { effect: string; effect_value: number; icon: string; duration_hours?: number | null; expires_at?: string | null },
    ) => {
      const { data: activatorUser } = await admin.from('users').select('display_name').eq('id', user.id).single();
      const activatorName = activatorUser?.display_name ?? 'Герой';

      const entries = heroes.map(h => ({
        hero_id: h.id,
        user_id: h.user_id,
        action: ACTIVITY_ACTIONS.TEAM_ARTIFACT_ACTIVATED,
        xp_change: 0,
        gold_change: 0,
        hp_change: 0,
        metadata: {
          artifact: artName,
          activator_name: activatorName,
          effect: opts.effect,
          effect_value: opts.effect_value,
          duration_hours: opts.duration_hours ?? null,
          expires_at: opts.expires_at ?? null,
          icon: opts.icon,
        },
      }));

      if (entries.length > 0) {
        await admin.from('activity_log').insert(entries);
      }
    };
```

- [ ] **Step 3: Add team activation log to consumable_class_hp handler**

In the `consumable_class_hp` block (around line 168, after `if (logEntries.length > 0) await admin.from('activity_log').insert(logEntries);`), add:

```typescript
      // Log team artifact activation notification
      if (heroes) {
        await logTeamActivation(
          heroes.map(h => ({ id: h.id, user_id: h.user_id })),
          { effect: 'class_hp', effect_value: val, icon: '❤️' },
        );
      }
```

- [ ] **Step 4: Add team activation log to consumable_class_xp handler**

In the `consumable_class_xp` block (around line 208, after the existing log insert), add:

```typescript
      // Log team artifact activation notification
      if (heroes) {
        await logTeamActivation(
          heroes.map(h => ({ id: h.id, user_id: h.user_id })),
          { effect: 'class_xp', effect_value: val, icon: '⚡' },
        );
      }
```

- [ ] **Step 5: Add team activation log to consumable_class_gold handler**

In the `consumable_class_gold` block (around line 246, after the existing log insert), add:

```typescript
      // Log team artifact activation notification
      if (heroes) {
        await logTeamActivation(
          heroes.map(h => ({ id: h.id, user_id: h.user_id })),
          { effect: 'class_gold', effect_value: val, icon: '💰' },
        );
      }
```

- [ ] **Step 6: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add src/app/api/game/use-artifact/route.ts
git commit -m "feat: log team_artifact_activated for class consumables"
```

---

### Task 3: Create team-artifact-notify API endpoint

**Files:**
- Create: `src/app/api/game/team-artifact-notify/route.ts`

This endpoint is called from the client when a student equips a team (duration-based) artifact. It logs `team_artifact_activated` for all class members.

- [ ] **Step 1: Create the API route**

Create `src/app/api/game/team-artifact-notify/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ACTIVITY_ACTIONS } from '@/lib/game/constants';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/game/team-artifact-notify
 * Logs team_artifact_activated for all class heroes when a team artifact is equipped.
 * Body: { heroArtifactId: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { heroArtifactId } = await req.json();
    if (!heroArtifactId) return NextResponse.json({ error: 'heroArtifactId required' }, { status: 400 });

    // Load the hero_artifact + artifact definition
    const { data: entry } = await admin
      .from('hero_artifacts')
      .select('*, artifact:artifact_id(name, effect, effect_type, effect_value, duration_hours, icon, rarity)')
      .eq('id', heroArtifactId)
      .single();

    if (!entry) return NextResponse.json({ error: 'Артефакт не найден' }, { status: 404 });

    const art = entry.artifact as Record<string, unknown>;
    const effect = String(art.effect ?? art.effect_type ?? '');

    // Only proceed for team artifacts
    const isTeam = effect.split(',').some(e => {
      const trimmed = e.trim();
      return trimmed.startsWith('team_');
    });
    if (!isTeam) return NextResponse.json({ error: 'Не командный артефакт' }, { status: 400 });

    // Get user's class
    const { data: userData } = await admin.from('users').select('class_id, display_name').eq('id', user.id).single();
    const classId = userData?.class_id;
    if (!classId) return NextResponse.json({ error: 'Не состоите в классе' }, { status: 400 });

    const activatorName = userData.display_name ?? 'Герой';

    // Get all students in class
    const { data: students } = await admin.from('users').select('id').eq('class_id', classId).eq('role', 'student');
    if (!students?.length) return NextResponse.json({ error: 'В классе нет учеников' }, { status: 400 });

    const userIds = students.map(s => s.id);
    const { data: heroes } = await admin.from('heroes').select('id, user_id').in('user_id', userIds);
    if (!heroes?.length) return NextResponse.json({ success: true });

    const artName = String(art.name ?? 'Артефакт');
    const val = Number(art.effect_value ?? 0);
    const durationHours = Number(art.duration_hours ?? 0) || null;
    const icon = String(art.icon ?? '✨');
    const expiresAt = entry.expires_at ?? null;

    // Build effect description for metadata
    const effectParts = effect.split(',').map((e: string) => e.trim());
    const primaryEffect = effectParts.find((e: string) => e.startsWith('team_')) ?? effect;

    const entries = heroes.map((h: { id: string; user_id: string }) => ({
      hero_id: h.id,
      user_id: h.user_id,
      action: ACTIVITY_ACTIONS.TEAM_ARTIFACT_ACTIVATED,
      xp_change: 0,
      gold_change: 0,
      hp_change: 0,
      metadata: {
        artifact: artName,
        activator_name: activatorName,
        effect: primaryEffect,
        effect_value: val,
        duration_hours: durationHours,
        expires_at: expiresAt,
        icon,
      },
    }));

    await admin.from('activity_log').insert(entries);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[team-artifact-notify]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/team-artifact-notify/route.ts
git commit -m "feat: add team-artifact-notify API endpoint"
```

---

### Task 4: Call team-artifact-notify from equip flow

**Files:**
- Modify: `src/lib/hooks/use-artifacts.ts:142-218`

After successfully equipping a team artifact in `equipArtifact()`, call the new API endpoint.

- [ ] **Step 1: Add team artifact notification call**

In `src/lib/hooks/use-artifacts.ts`, inside the `equipArtifact` function, after the successful DB update and `fetchArtifacts()` call (after line 216, before `return { error: null };` on line 217), add the notification call:

```typescript
    // Notify class if this is a team artifact
    const effectStr = effect; // already defined on line 185
    const isTeamArtifact = effectStr.split(',').some(e => e.trim().startsWith('team_'));
    if (isTeamArtifact) {
      fetch('/api/game/team-artifact-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroArtifactId }),
      }).catch(() => {}); // fire-and-forget, don't block equip
    }
```

- [ ] **Step 2: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-artifacts.ts
git commit -m "feat: notify class on team artifact equip"
```

---

### Task 5: Extend getClassAuras() to return detailed aura objects

**Files:**
- Modify: `src/lib/game/artifact-engine.ts:96-214`

The current `getClassAuras()` returns `{ xpBoost, goldBoost, dmgReduce, applied: string[] }`. We extend it with a `details` array containing rich objects for the banner.

- [ ] **Step 1: Define the AuraDetail type**

In `src/lib/game/artifact-engine.ts`, after the existing types section (after line 58), add:

```typescript
export interface AuraDetail {
  artifactName: string;
  activatorName: string;
  effect: string;
  effectValue: number;
  effectLabel: string;
  expiresAt: string | null;
  durationHours: number | null;
  icon: string;
  rarity: string;
}
```

- [ ] **Step 2: Update cache type**

Update the `classAurasCache` type on line 98 to include `details`:

```typescript
const classAurasCache = new Map<string, { data: { xpBoost: number, goldBoost: number, dmgReduce: number, applied: string[], details: AuraDetail[] }, expires: number }>();
```

- [ ] **Step 3: Add details array to getClassAuras()**

In the `getClassAuras()` function:

a) After `const applied: string[] = [];` (line 110), add:
```typescript
  const details: AuraDetail[] = [];
```

b) Update the `emptyResult` (line 111):
```typescript
  const emptyResult = { xpBoost, goldBoost, dmgReduce, applied, details };
```

c) Update all early returns (lines 115, 119, 123, 129, 136, 153) to include `details`:
Replace `return emptyResult;` — those already reference `emptyResult` so they're fine.
For lines 123 and 129 that return inline objects, update them:
```typescript
  // line 123:
  if (!students || students.length === 0) return { xpBoost, goldBoost, dmgReduce, applied, details };
  // line 129:
  if (!cHeroes || cHeroes.length === 0) return { xpBoost, goldBoost, dmgReduce, applied, details };
```

d) Update the select query (line 147-151) to include `icon`, `rarity`, `duration_hours`:
```typescript
  const { data: artifacts } = await admin
    .from('hero_artifacts')
    .select('hero_id, expires_at, artifacts!inner(effect, effect_type, effect_value, name, icon, rarity, duration_hours)')
    .in('hero_id', otherHeroIds)
    .eq('is_equipped', true);
```

e) Update the `AuraArtifactJoin` interface (lines 156-161) to include new fields:
```typescript
  interface AuraArtifactJoin {
    effect: string | null;
    effect_type: string | null;
    effect_value: number | null;
    name: string | null;
    icon: string | null;
    rarity: string | null;
    duration_hours: number | null;
  }
```

f) Inside the for loop, after each `applied.push(...)` call (lines 192, 196, 200, 204), also push a detail object. Add this block after the `if (isTeamDmgReduce)` section (after line 205):

```typescript
    // Build detail for banner
    let effectLabel = '';
    if (isTeamXp || isTeamBoss) effectLabel = `+${val}% XP всему классу`;
    if (isTeamGold) effectLabel = `+${val}% Золото всему классу`;
    if (isTeamDmgReduce) effectLabel = `−${val}% Урон всему классу`;

    details.push({
      artifactName: String(art.name ?? 'Артефакт'),
      activatorName: ownerName,
      effect: isTeamXp ? 'team_xp' : isTeamBoss ? 'team_boss_dmg' : isTeamGold ? 'team_gold' : 'team_dmg_reduce',
      effectValue: val,
      effectLabel,
      expiresAt: a.expires_at ?? null,
      durationHours: art.duration_hours ?? null,
      icon: String(art.icon ?? '✨'),
      rarity: String(art.rarity ?? 'rare'),
    });
```

g) Update the result object (line 208):
```typescript
  const result = { xpBoost, goldBoost, dmgReduce, applied, details };
```

- [ ] **Step 4: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/artifact-engine.ts
git commit -m "feat: extend getClassAuras with detailed aura objects for banner"
```

---

### Task 6: Create /api/game/class-auras endpoint

**Files:**
- Create: `src/app/api/game/class-auras/route.ts`

Client-facing endpoint that wraps `getClassAuras()` so the hero page can fetch active auras.

- [ ] **Step 1: Create the API route**

Create `src/app/api/game/class-auras/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getClassAuras } from '@/lib/game/artifact-engine';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/game/class-auras?heroId=xxx
 * Returns active class auras with detail objects for the banner component.
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    // Resolve heroId from user
    const { data: hero } = await admin.from('heroes').select('id').eq('user_id', user.id).single();
    if (!hero) return NextResponse.json({ error: 'Герой не найден' }, { status: 404 });

    const auras = await getClassAuras(hero.id);

    return NextResponse.json({
      xpBoost: auras.xpBoost,
      goldBoost: auras.goldBoost,
      dmgReduce: auras.dmgReduce,
      details: auras.details,
    });
  } catch (err) {
    console.error('[class-auras]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/game/class-auras/route.ts
git commit -m "feat: add class-auras API endpoint for banner data"
```

---

### Task 7: Add team_artifact_activated mapping in activity sync

**Files:**
- Modify: `src/lib/hooks/use-supabase-sync.ts:50-199`

Add a new `else if` branch for `team_artifact_activated` in the activity log transformation.

- [ ] **Step 1: Add the mapping**

In `src/lib/hooks/use-supabase-sync.ts`, after the `class_artifact_used` block (after line 144, before the streak block), add:

```typescript
        // ── TEAM ARTIFACT ACTIVATED ──────────────────────────────────
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
```

- [ ] **Step 2: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-supabase-sync.ts
git commit -m "feat: add team_artifact_activated display in activity log"
```

---

### Task 8: Create ClassAuraBanner component

**Files:**
- Create: `src/components/game/ClassAuraBanner.tsx`

Carousel banner showing active class auras with countdown timers.

- [ ] **Step 1: Create the component**

Create `src/components/game/ClassAuraBanner.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuraDetail {
  artifactName: string;
  activatorName: string;
  effect: string;
  effectValue: number;
  effectLabel: string;
  expiresAt: string | null;
  durationHours: number | null;
  icon: string;
  rarity: string;
}

interface ClassAuraBannerProps {
  heroId: string;
}

const RARITY_GRADIENTS: Record<string, string> = {
  common: 'linear-gradient(135deg, #6b7280, #9ca3af)',
  rare: 'linear-gradient(135deg, #2563eb, #60a5fa)',
  epic: 'linear-gradient(135deg, #7c3aed, #c084fc)',
  legendary: 'linear-gradient(135deg, #d97706, #fbbf24)',
};

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Истекло';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}д ${remHours}ч`;
  }
  return `${hours}ч ${minutes}м`;
}

function getProgress(expiresAt: string, durationHours: number | null): number {
  if (!durationHours) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const total = durationHours * 3_600_000;
  return Math.max(0, Math.min(100, (diff / total) * 100));
}

export function ClassAuraBanner({ heroId }: ClassAuraBannerProps) {
  const [auras, setAuras] = useState<AuraDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setTick] = useState(0); // force re-render for countdown

  const fetchAuras = useCallback(async () => {
    try {
      const res = await fetch('/api/game/class-auras');
      if (!res.ok) return;
      const data = await res.json();
      // Only show duration-based auras (with expiresAt) in the banner
      const active = (data.details ?? []).filter(
        (a: AuraDetail) => a.expiresAt && new Date(a.expiresAt).getTime() > Date.now(),
      );
      setAuras(active);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAuras();
    // Re-fetch every 60 seconds to catch new auras
    const interval = setInterval(fetchAuras, 60_000);
    return () => clearInterval(interval);
  }, [fetchAuras]);

  // Countdown tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    if (auras.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % auras.length);
    }, 5_000);
    return () => clearInterval(interval);
  }, [auras.length]);

  // Filter out expired auras on tick
  useEffect(() => {
    setAuras(prev => prev.filter(a => a.expiresAt && new Date(a.expiresAt).getTime() > Date.now()));
  }, []);

  if (auras.length === 0) return null;

  // Clamp index
  const safeIndex = currentIndex >= auras.length ? 0 : currentIndex;
  const aura = auras[safeIndex];
  if (!aura) return null;

  const gradient = RARITY_GRADIENTS[aura.rarity] ?? RARITY_GRADIENTS.rare;
  const progress = aura.expiresAt ? getProgress(aura.expiresAt, aura.durationHours) : 0;
  const timeLeft = aura.expiresAt ? formatTimeLeft(aura.expiresAt) : '';

  return (
    <div style={{
      background: gradient,
      borderRadius: 'var(--radius-lg, 12px)',
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      color: 'white',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
    }}>
      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '1.3rem' }}>{aura.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
            {aura.activatorName} активировал(а) «{aura.artifactName}»
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
            {aura.effectLabel}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Осталось</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{timeLeft}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.25)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '2px',
          transition: 'width 1s linear',
        }} />
      </div>

      {/* Dot indicators for carousel */}
      {auras.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          marginTop: '0.4rem',
        }}>
          {auras.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              style={{
                width: i === safeIndex ? '16px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === safeIndex ? 'white' : 'rgba(255,255,255,0.4)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/game/ClassAuraBanner.tsx
git commit -m "feat: add ClassAuraBanner carousel component"
```

---

### Task 9: Integrate ClassAuraBanner into hero page

**Files:**
- Modify: `src/app/(student)/hero/page.tsx`

- [ ] **Step 1: Add import**

At the top of `src/app/(student)/hero/page.tsx`, after the existing component imports (after line 15 `import { AchievementsPanel }...`), add:

```typescript
import { ClassAuraBanner } from '@/components/game/ClassAuraBanner';
```

- [ ] **Step 2: Add the banner before the hero section**

In the JSX, after the streak milestone banner closing `)}` (after line 263) and before `{/* === HERO SECTION === */}` comment (line 265), add:

```tsx
      {/* === CLASS AURA BANNER === */}
      {hero.heroId && <ClassAuraBanner heroId={hero.heroId} />}
```

- [ ] **Step 3: Verify build**

Run: `cd hero-academy && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Manual test checklist**

1. Open the hero page — verify no banner when no team artifacts are active
2. Have another class member equip a team artifact — refresh hero page, verify banner appears with correct name, artifact, effect label, countdown
3. Verify countdown updates every minute
4. If 2+ team artifacts are active — verify carousel rotates every 5 seconds, dot indicators work
5. Verify activity log shows `team_artifact_activated` entries for both duration-based and instant consumables
6. Verify the existing `class_artifact_used` entries still appear separately

- [ ] **Step 5: Commit**

```bash
git add src/app/(student)/hero/page.tsx
git commit -m "feat: integrate ClassAuraBanner on hero page"
```

---

### Task 10: Final verification and build

- [ ] **Step 1: Run full build**

Run: `cd hero-academy && npm run build 2>&1 | tail -30`
Expected: Build succeeds

- [ ] **Step 2: Run tests**

Run: `cd hero-academy && npm test 2>&1`
Expected: All existing tests pass

- [ ] **Step 3: Final commit if any fixes needed**

Fix any build/test issues and commit.
