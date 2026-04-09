# God Mode — Admin View-As-Student Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a read-only split-view inside the admin panel to inspect any student's hero, inventory, and quests — for support and debugging.

**Architecture:** A single server-side API endpoint (`/api/admin/impersonate/[userId]`) uses `SUPABASE_SERVICE_ROLE_KEY` to load a snapshot of a student's data, after verifying the caller is an admin. A new admin page (`/admin/users/[id]/view`) fetches that snapshot and renders it through three brand-new presentational components living under `src/components/admin/god-mode/`. A `ReadOnlyGuard` context blocks any mutating actions with a toast. Student routes and hooks remain untouched.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), Zustand (for toast store), CSS Modules, Vitest.

**Project root:** `/Users/macbookm/Hero academy/hero-academy/` — all paths below are relative to it.

---

## File Structure

### New files (created by this plan)
| File | Responsibility |
|---|---|
| `src/app/api/admin/impersonate/[userId]/route.ts` | Server API: auth-check admin, load snapshot via service role, return JSON |
| `src/app/api/admin/impersonate/[userId]/route.test.ts` | Vitest unit tests for the API handler |
| `src/components/admin/ReadOnlyGuard.tsx` | React context + `useReadOnly()` hook + `guardedOnClick()` helper |
| `src/components/admin/ReadOnlyGuard.test.ts` | Vitest unit tests for `guardedOnClick` |
| `src/components/admin/god-mode/HeroViewPresentational.tsx` | Renders hero card + stats (strength, knowledge, etc.) + streak from props |
| `src/components/admin/god-mode/HeroViewPresentational.module.css` | Styles |
| `src/components/admin/god-mode/InventoryViewPresentational.tsx` | Renders a table of hero artifacts (icon, name, rarity, qty, equipped, expires) |
| `src/components/admin/god-mode/InventoryViewPresentational.module.css` | Styles |
| `src/components/admin/god-mode/QuestsViewPresentational.tsx` | Renders active and completed quest lists (title, subject, status, xp/gold/hp) |
| `src/components/admin/god-mode/QuestsViewPresentational.module.css` | Styles |
| `src/components/admin/god-mode/GodModeShell.tsx` | Header (student name + Обновить + ✕), tabs, tab body routing |
| `src/components/admin/god-mode/GodModeShell.module.css` | Styles |
| `src/components/admin/god-mode/types.ts` | Shared `ImpersonationSnapshot` type |
| `src/app/(admin)/admin/users/[id]/view/page.tsx` | Client page: fetch snapshot, wrap in `ReadOnlyGuard`, mount `GodModeShell` |
| `src/app/(admin)/admin/users/[id]/view/page.module.css` | Styles |

### Modified files
| File | Change |
|---|---|
| `src/app/(admin)/layout.tsx` | Add `<ToastContainer />` next to `<main>` so toasts can render inside admin |
| `src/app/(admin)/admin/users/page.tsx` | Add «👁 Посмотреть» button in each row's actions cell, navigating to `/admin/users/[id]/view` |

### Untouched (explicitly)
- `src/app/(student)/hero/page.tsx`
- `src/app/(student)/inventory/page.tsx`
- `src/app/(student)/quests/page.tsx`
- `src/lib/hooks/use-hero.ts`, `use-artifacts.ts`, `use-supabase-sync.ts`, etc.

---

## Task 1: Snapshot type + API route skeleton (auth check only)

**Files:**
- Create: `src/components/admin/god-mode/types.ts`
- Create: `src/app/api/admin/impersonate/[userId]/route.ts`
- Create: `src/app/api/admin/impersonate/[userId]/route.test.ts`

- [ ] **Step 1: Create the shared snapshot type**

Create `src/components/admin/god-mode/types.ts`:

```typescript
import type { Hero, HeroStats } from '@/types/hero';
import type { HeroArtifact } from '@/lib/hooks/use-artifacts';

export interface ImpersonationQuest {
  id: string;                 // quest_attempts.id
  quest_id: string;
  title: string;
  subject: string;
  type: string;               // quest.type
  difficulty: string;
  status: string;             // attempt_status
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  xp_earned: number;
  gold_earned: number;
  hp_lost: number;
  grade: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface ImpersonationAchievement {
  id: string;                 // achievements_unlocked.id
  achievement_id: string;
  unlocked_at: string;
}

export interface ImpersonationStudent {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  school_name: string | null;
  class_name: string | null;
}

export interface ImpersonationSnapshot {
  student: ImpersonationStudent;
  hero: Hero | null;
  stats: HeroStats | null;
  artifacts: HeroArtifact[];
  quests: {
    active: ImpersonationQuest[];
    completed: ImpersonationQuest[];
  };
  achievements: ImpersonationAchievement[];
  fetched_at: string;         // ISO timestamp
}
```

- [ ] **Step 2: Write failing test for auth check**

Create `src/app/api/admin/impersonate/[userId]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/ssr server client (current-user check)
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'student' }, error: null }),
    })),
  }),
}));

// Mock service-role client
const mockServiceFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockServiceFrom,
    auth: { admin: { getUserById: vi.fn() } },
  }),
}));

describe('GET /api/admin/impersonate/[userId]', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockServiceFrom.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns 401 when caller is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/admin/impersonate/abc');
    const res = await GET(req, { params: Promise.resolve({ userId: 'abc' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    // The default mock in createClient returns role: 'student' → should 403
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/admin/impersonate/abc');
    const res = await GET(req, { params: Promise.resolve({ userId: 'abc' }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run the failing test**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx vitest run src/app/api/admin/impersonate
```

Expected: FAIL — module `./route` does not exist.

- [ ] **Step 4: Implement the API route with auth check only (no data yet)**

Create `src/app/api/admin/impersonate/[userId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // 1. Verify caller is authenticated
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify caller has admin role
  const { data: callerProfile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Build service-role client (bypasses RLS for read)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Data loading is added in Task 2.
  return NextResponse.json({
    student: null,
    hero: null,
    stats: null,
    artifacts: [],
    quests: { active: [], completed: [] },
    achievements: [],
    fetched_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx vitest run src/app/api/admin/impersonate
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/admin/god-mode/types.ts \
        hero-academy/src/app/api/admin/impersonate
git commit -m "feat(admin): god mode API route with admin auth check

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 2: API route — load snapshot data via service role

**Files:**
- Modify: `src/app/api/admin/impersonate/[userId]/route.ts`
- Modify: `src/app/api/admin/impersonate/[userId]/route.test.ts`

- [ ] **Step 1: Write failing test for happy-path data loading**

Append to `src/app/api/admin/impersonate/[userId]/route.test.ts`:

```typescript
describe('GET /api/admin/impersonate/[userId] — happy path', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns a full snapshot for a valid student target', async () => {
    // Caller check: admin
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-1' } },
            error: null,
          }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
            }),
          }),
        }),
      }),
    }));

    // Service client: returns student, hero, stats, artifacts, quests, achievements
    const serviceFromMock = vi.fn((table: string) => {
      const resolveSingle = (row: unknown) => Promise.resolve({ data: row, error: null });
      const resolveMany  = (rows: unknown) => Promise.resolve({ data: rows, error: null });

      switch (table) {
        case 'users':
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  resolveSingle({
                    id: 'student-1',
                    display_name: 'Kid',
                    email: 'kid@example.com',
                    role: 'student',
                    school: null,
                    class: null,
                  }),
              }),
            }),
          };
        case 'heroes':
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  resolveSingle({
                    id: 'hero-1',
                    user_id: 'student-1',
                    name: 'Brave',
                    level: 5,
                    xp: 300,
                    xp_to_next: 500,
                    hp: 80,
                    hp_max: 100,
                    gold: 120,
                    streak_current: 3,
                    streak_best: 7,
                    streak_last_date: null,
                    streak_protected: false,
                    status: 'active',
                    avatar_config: {},
                    season_id: null,
                    created_at: '',
                    updated_at: '',
                  }),
              }),
            }),
          };
        case 'hero_stats':
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  resolveSingle({
                    hero_id: 'hero-1',
                    strength: 10, knowledge: 12, endurance: 11, luck: 9, wisdom: 13,
                  }),
              }),
            }),
          };
        case 'hero_artifacts':
          return {
            select: () => ({
              eq: () => resolveMany([
                {
                  id: 'ha-1', artifact_id: 'a-1', hero_id: 'hero-1',
                  slot_index: 0, is_equipped: true, quantity: 1,
                  charges_remaining: 1, acquired_at: '', expires_at: null, source: 'drop',
                  artifact: { id: 'a-1', name: 'Shield', rarity: 'rare', icon: '🛡️', effect: '', effect_value: 0, duration_hours: 0, drop_rate: 0, stackable: false, max_charges: 1, is_shopable: true, description: '' },
                },
              ]),
            }),
          };
        case 'quest_attempts':
          return {
            select: () => ({
              eq: () => resolveMany([
                {
                  id: 'qa-1', quest_id: 'q-1', status: 'in_progress',
                  xp_earned: 0, gold_earned: 0, hp_lost: 0, grade: null,
                  started_at: '', completed_at: null,
                  quest: { id: 'q-1', title: 'Math', subject: 'math', type: 'quest', difficulty: 'medium', xp_reward: 100, gold_reward: 10, hp_damage: 10 },
                },
              ]),
            }),
          };
        case 'achievements_unlocked':
          return {
            select: () => ({
              eq: () => resolveMany([
                { id: 'au-1', achievement_id: 'ach-1', unlocked_at: '' },
              ]),
            }),
          };
        default:
          return { select: () => ({ eq: () => resolveMany([]) }) };
      }
    });

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: serviceFromMock,
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: { id: 'student-1', email: 'kid@example.com' } },
              error: null,
            }),
          },
        },
      }),
    }));

    vi.resetModules();
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/admin/impersonate/student-1');
    const res = await GET(req, { params: Promise.resolve({ userId: 'student-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.student.id).toBe('student-1');
    expect(body.hero.name).toBe('Brave');
    expect(body.stats.knowledge).toBe(12);
    expect(body.artifacts).toHaveLength(1);
    expect(body.quests.active).toHaveLength(1);
    expect(body.quests.completed).toHaveLength(0);
    expect(body.achievements).toHaveLength(1);
    expect(typeof body.fetched_at).toBe('string');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx vitest run src/app/api/admin/impersonate
```

Expected: FAIL on the happy-path test because the handler currently returns empty data.

- [ ] **Step 3: Implement snapshot loading**

Replace the `GET` function body in `src/app/api/admin/impersonate/[userId]/route.ts` after the service-client creation (keep the auth check as-is). The whole file becomes:

```typescript
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { ImpersonationSnapshot, ImpersonationQuest } from '@/components/admin/god-mode/types';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // 1. Verify caller is authenticated
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify caller has admin role
  const { data: callerProfile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Service-role client for reading target data (bypasses RLS, read-only usage)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 4. Load target user profile (with school + class names via joins)
  const { data: targetUser, error: targetErr } = await service
    .from('users')
    .select('id, display_name, email, role, school:schools(name), class:classes(name)')
    .eq('id', userId)
    .single();

  if (targetErr || !targetUser) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // 5. Load hero first (needed for hero.id), then fan out the dependent queries
  const { data: hero } = await service
    .from('heroes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let stats = null;
  let artifactRows: any[] = [];
  let attemptRows: any[] = [];
  let achievementRows: any[] = [];

  if (hero?.id) {
    const [statsR, artR, attR, achR] = await Promise.all([
      service.from('hero_stats').select('*').eq('hero_id', hero.id).maybeSingle(),
      service.from('hero_artifacts').select('*, artifact:artifact_id(*)').eq('hero_id', hero.id),
      service.from('quest_attempts').select('*, quest:quest_id(*)').eq('hero_id', hero.id),
      service.from('achievements_unlocked').select('*').eq('hero_id', hero.id),
    ]);
    stats = statsR.data ?? null;
    artifactRows = artR.data ?? [];
    attemptRows = attR.data ?? [];
    achievementRows = achR.data ?? [];
  }

  // Normalize quest attempts into ImpersonationQuest shape
  const toQuest = (row: any): ImpersonationQuest => ({
    id: row.id,
    quest_id: row.quest_id,
    title: row.quest?.title ?? 'Unknown',
    subject: row.quest?.subject ?? '',
    type: row.quest?.type ?? 'quest',
    difficulty: row.quest?.difficulty ?? 'medium',
    status: row.status,
    xp_reward: row.quest?.xp_reward ?? 0,
    gold_reward: row.quest?.gold_reward ?? 0,
    hp_damage: row.quest?.hp_damage ?? 0,
    xp_earned: row.xp_earned ?? 0,
    gold_earned: row.gold_earned ?? 0,
    hp_lost: row.hp_lost ?? 0,
    grade: row.grade ?? null,
    started_at: row.started_at ?? '',
    completed_at: row.completed_at ?? null,
  });

  const active    = attemptRows.filter(r => r.status === 'in_progress').map(toQuest);
  const completed = attemptRows.filter(r => r.status !== 'in_progress').map(toQuest);

  const snapshot: ImpersonationSnapshot = {
    student: {
      id: targetUser.id,
      display_name: targetUser.display_name,
      email: targetUser.email,
      role: targetUser.role,
      school_name: (targetUser as any).school?.name ?? null,
      class_name:  (targetUser as any).class?.name  ?? null,
    },
    hero: hero ?? null,
    stats,
    artifacts: artifactRows,
    quests: { active, completed },
    achievements: achievementRows,
    fetched_at: new Date().toISOString(),
  };

  return NextResponse.json(snapshot);
}
```

**Why two round-trips:** the dependent queries (`hero_stats`, `hero_artifacts`, `quest_attempts`, `achievements_unlocked`) all key on `hero.id`, which we only know after the first `heroes` lookup. The alternative (one giant join) is messier across six tables; one extra round-trip is fine.

- [ ] **Step 4: Run all tests**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx vitest run src/app/api/admin/impersonate
```

Expected: PASS (3 tests including happy path).

- [ ] **Step 5: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/api/admin/impersonate
git commit -m "feat(admin): god mode API loads full student snapshot

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 3: ReadOnlyGuard context + helper

**Files:**
- Create: `src/components/admin/ReadOnlyGuard.tsx`
- Create: `src/components/admin/ReadOnlyGuard.test.ts`

- [ ] **Step 1: Write failing test for `guardedOnClick`**

Create `src/components/admin/ReadOnlyGuard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addToast = vi.fn();
vi.mock('@/lib/store/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast }),
  },
}));

import { guardedOnClick } from './ReadOnlyGuard';

describe('guardedOnClick', () => {
  beforeEach(() => addToast.mockReset());

  it('calls the underlying handler when not read-only', () => {
    const handler = vi.fn();
    guardedOnClick(handler, false)();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(addToast).not.toHaveBeenCalled();
  });

  it('shows a toast and does NOT call the handler when read-only', () => {
    const handler = vi.fn();
    guardedOnClick(handler, true)();
    expect(handler).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0]).toMatchObject({
      type: 'info',
      title: expect.any(String),
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx vitest run src/components/admin/ReadOnlyGuard
```

Expected: FAIL — file not found.

- [ ] **Step 3: Implement `ReadOnlyGuard`**

Create `src/components/admin/ReadOnlyGuard.tsx`:

```typescript
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useToastStore } from '@/lib/store/toastStore';

interface ReadOnlyContextValue {
  readOnly: boolean;
}

const ReadOnlyContext = createContext<ReadOnlyContextValue>({ readOnly: false });

export function ReadOnlyProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <ReadOnlyContext.Provider value={{ readOnly: value }}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext).readOnly;
}

/**
 * Wraps an onClick handler so that, when `readOnly` is true, it shows a
 * "view mode" toast instead of invoking the handler. Safe to use outside
 * React components (reads the toast store directly).
 */
export function guardedOnClick<Args extends unknown[]>(
  handler: (...args: Args) => void,
  readOnly: boolean
): (...args: Args) => void {
  return (...args: Args) => {
    if (readOnly) {
      useToastStore.getState().addToast({
        type: 'info',
        title: 'Режим просмотра',
        message: 'Действия отключены — вы смотрите глазами ученика',
      });
      return;
    }
    handler(...args);
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx vitest run src/components/admin/ReadOnlyGuard
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/admin/ReadOnlyGuard.tsx \
        hero-academy/src/components/admin/ReadOnlyGuard.test.ts
git commit -m "feat(admin): add ReadOnlyGuard context + guardedOnClick helper

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 4: Add ToastContainer to admin layout

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

- [ ] **Step 1: Read the current admin layout** to know exactly what to edit

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
cat src/app/\(admin\)/layout.tsx
```

Expected content (abbreviated):

```tsx
import { AuthProvider } from '@/lib/supabase/auth-context';
import { Sidebar, adminSidebarItems } from '@/components/navigation/Sidebar';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className={styles.layout}>
        <Sidebar items={adminSidebarItems} role="Админ" />
        <main className={styles.content}>{children}</main>
      </div>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Add `<ToastContainer />`**

Modify `src/app/(admin)/layout.tsx` so the final content is:

```tsx
import { AuthProvider } from '@/lib/supabase/auth-context';
import { Sidebar, adminSidebarItems } from '@/components/navigation/Sidebar';
import { ToastContainer } from '@/components/ui/ToastContainer';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className={styles.layout}>
        <Sidebar items={adminSidebarItems} role="Админ" />
        <main className={styles.content}>{children}</main>
        <ToastContainer />
      </div>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm run lint
```

Expected: no new errors in `src/app/(admin)/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/\(admin\)/layout.tsx
git commit -m "feat(admin): mount ToastContainer in admin layout

Required by God Mode ReadOnlyGuard so that 'view mode' toasts can
render on admin routes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 5: HeroViewPresentational

**Files:**
- Create: `src/components/admin/god-mode/HeroViewPresentational.tsx`
- Create: `src/components/admin/god-mode/HeroViewPresentational.module.css`

- [ ] **Step 1: Implement the presentational component**

Create `src/components/admin/god-mode/HeroViewPresentational.tsx`:

```typescript
'use client';

import type { Hero, HeroStats } from '@/types/hero';
import styles from './HeroViewPresentational.module.css';

interface Props {
  hero: Hero | null;
  stats: HeroStats | null;
}

export function HeroViewPresentational({ hero, stats }: Props) {
  if (!hero) {
    return <div className={styles.empty}>У ученика нет героя</div>;
  }

  const xpPct  = Math.min(100, Math.round((hero.xp / Math.max(1, hero.xp_to_next)) * 100));
  const hpPct  = Math.min(100, Math.round((hero.hp / Math.max(1, hero.hp_max)) * 100));

  return (
    <div className={styles.wrap}>
      <div className={styles.headerCard}>
        <div className={styles.name}>{hero.name}</div>
        <div className={styles.meta}>
          <span>Уровень {hero.level}</span>
          <span>Золото: {hero.gold.toLocaleString('ru-RU')}</span>
          <span>Статус: {hero.status === 'active' ? '💚 Жив' : '💀 Мёртв'}</span>
        </div>
      </div>

      <div className={styles.bars}>
        <div className={styles.bar}>
          <div className={styles.barLabel}>XP: {hero.xp} / {hero.xp_to_next}</div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.barFillXp}`} style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        <div className={styles.bar}>
          <div className={styles.barLabel}>HP: {hero.hp} / {hero.hp_max}</div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.barFillHp}`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.streaks}>
        <span>🔥 Текущая серия: <strong>{hero.streak_current}</strong></span>
        <span>🏆 Лучшая: <strong>{hero.streak_best}</strong></span>
      </div>

      <div className={styles.statsGrid}>
        <Stat label="Сила"        value={stats?.strength}  icon="💪" />
        <Stat label="Знания"      value={stats?.knowledge} icon="📘" />
        <Stat label="Выносливость" value={stats?.endurance} icon="🛡️" />
        <Stat label="Удача"       value={stats?.luck}      icon="🍀" />
        <Stat label="Мудрость"    value={stats?.wisdom}    icon="🔮" />
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | undefined; icon: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value ?? '—'}</div>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Create `src/components/admin/god-mode/HeroViewPresentational.module.css`:

```css
.wrap { display: flex; flex-direction: column; gap: var(--space-4); }

.empty { padding: var(--space-8); text-align: center; opacity: 0.6; }

.headerCard {
  background: var(--bg-glass);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
}
.name { font-size: var(--text-2xl); font-weight: 800; }
.meta { display: flex; gap: var(--space-4); flex-wrap: wrap; color: var(--text-secondary); margin-top: var(--space-2); font-size: var(--text-sm); }

.bars { display: flex; flex-direction: column; gap: var(--space-2); }
.bar { display: flex; flex-direction: column; gap: var(--space-1); }
.barLabel { font-size: var(--text-xs); color: var(--text-secondary); }
.barTrack { height: 10px; background: var(--bg-secondary); border-radius: var(--radius-sm); overflow: hidden; }
.barFill { height: 100%; transition: width 0.3s ease; }
.barFillXp { background: var(--accent-xp); }
.barFillHp { background: var(--accent-hp, #ef4444); }

.streaks { display: flex; gap: var(--space-4); font-size: var(--text-sm); }

.statsGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: var(--space-2); }
.statCard {
  background: var(--bg-glass);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  text-align: center;
}
.statIcon { font-size: var(--text-xl); }
.statLabel { font-size: var(--text-xs); color: var(--text-secondary); }
.statValue { font-size: var(--text-lg); font-weight: 700; }
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
```

Expected: no errors in the new file.

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/admin/god-mode/HeroViewPresentational.tsx \
        hero-academy/src/components/admin/god-mode/HeroViewPresentational.module.css
git commit -m "feat(admin): HeroViewPresentational for god mode

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 6: InventoryViewPresentational

**Files:**
- Create: `src/components/admin/god-mode/InventoryViewPresentational.tsx`
- Create: `src/components/admin/god-mode/InventoryViewPresentational.module.css`

- [ ] **Step 1: Implement the component**

Create `src/components/admin/god-mode/InventoryViewPresentational.tsx`:

```typescript
'use client';

import type { HeroArtifact } from '@/lib/hooks/use-artifacts';
import styles from './InventoryViewPresentational.module.css';

interface Props {
  artifacts: HeroArtifact[];
}

const RARITY_LABEL: Record<string, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

export function InventoryViewPresentational({ artifacts }: Props) {
  if (artifacts.length === 0) {
    return <div className={styles.empty}>Инвентарь пуст</div>;
  }

  // Sort: equipped first, then by rarity (legendary → common)
  const rarityRank: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sorted = [...artifacts].sort((a, b) => {
    if (a.is_equipped !== b.is_equipped) return a.is_equipped ? -1 : 1;
    const ra = rarityRank[a.artifact?.rarity ?? 'common'] ?? 99;
    const rb = rarityRank[b.artifact?.rarity ?? 'common'] ?? 99;
    return ra - rb;
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.count}>Предметов: {artifacts.length}</div>
      <div className={styles.list}>
        {sorted.map(row => {
          const a = row.artifact;
          return (
            <div
              key={row.id}
              className={`${styles.item} ${row.is_equipped ? styles.equipped : ''}`}
            >
              <div className={styles.icon}>{a?.icon ?? '💎'}</div>
              <div className={styles.body}>
                <div className={styles.name}>
                  {a?.name ?? 'Неизвестный артефакт'}
                  {row.is_equipped && <span className={styles.badge}>Экипирован</span>}
                </div>
                <div className={styles.meta}>
                  <span>{RARITY_LABEL[a?.rarity ?? 'common']}</span>
                  <span>×{row.quantity}</span>
                  {row.expires_at && <span>до {new Date(row.expires_at).toLocaleDateString('ru-RU')}</span>}
                </div>
                {a?.description && <div className={styles.desc}>{a.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Create `src/components/admin/god-mode/InventoryViewPresentational.module.css`:

```css
.wrap { display: flex; flex-direction: column; gap: var(--space-3); }
.empty { padding: var(--space-8); text-align: center; opacity: 0.6; }
.count { font-size: var(--text-xs); color: var(--text-secondary); }

.list { display: flex; flex-direction: column; gap: var(--space-2); }

.item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-glass);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-lg);
  align-items: flex-start;
}
.equipped { border-color: var(--accent-xp); }
.icon { font-size: var(--text-2xl); }
.body { flex: 1; }
.name { font-weight: 700; display: flex; gap: var(--space-2); align-items: center; }
.badge {
  background: var(--accent-xp);
  color: var(--bg-primary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
}
.meta { display: flex; gap: var(--space-3); font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }
.desc { margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-secondary); }
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/admin/god-mode/InventoryViewPresentational.tsx \
        hero-academy/src/components/admin/god-mode/InventoryViewPresentational.module.css
git commit -m "feat(admin): InventoryViewPresentational for god mode

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 7: QuestsViewPresentational

**Files:**
- Create: `src/components/admin/god-mode/QuestsViewPresentational.tsx`
- Create: `src/components/admin/god-mode/QuestsViewPresentational.module.css`

- [ ] **Step 1: Implement the component**

Create `src/components/admin/god-mode/QuestsViewPresentational.tsx`:

```typescript
'use client';

import type { ImpersonationQuest } from './types';
import styles from './QuestsViewPresentational.module.css';

interface Props {
  active: ImpersonationQuest[];
  completed: ImpersonationQuest[];
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная',
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: '⏳ В процессе',
  completed:   '✅ Завершено',
  failed:      '❌ Провалено',
  graded:      '📝 Оценено',
};

export function QuestsViewPresentational({ active, completed }: Props) {
  return (
    <div className={styles.wrap}>
      <Section title={`Активные (${active.length})`} items={active} empty="Нет активных заданий" />
      <Section title={`Завершённые (${completed.length})`} items={completed} empty="Нет завершённых" />
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: ImpersonationQuest[];
  empty: string;
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {items.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <div className={styles.list}>
          {items.map(q => (
            <div key={q.id} className={styles.item}>
              <div className={styles.head}>
                <span className={styles.title}>{q.title}</span>
                <span className={styles.status}>{STATUS_LABEL[q.status] ?? q.status}</span>
              </div>
              <div className={styles.meta}>
                <span>{q.subject}</span>
                <span>{DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}</span>
                {q.grade !== null && <span>Оценка: {q.grade}</span>}
              </div>
              <div className={styles.rewards}>
                <span>⭐ {q.xp_earned} / {q.xp_reward}</span>
                <span>💰 {q.gold_earned} / {q.gold_reward}</span>
                <span>💔 −{q.hp_lost}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

Create `src/components/admin/god-mode/QuestsViewPresentational.module.css`:

```css
.wrap { display: flex; flex-direction: column; gap: var(--space-6); }

.section { display: flex; flex-direction: column; gap: var(--space-2); }
.sectionTitle { font-size: var(--text-base); font-weight: 700; }

.empty { padding: var(--space-4); text-align: center; opacity: 0.6; font-size: var(--text-sm); }

.list { display: flex; flex-direction: column; gap: var(--space-2); }

.item {
  background: var(--bg-glass);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}
.head { display: flex; justify-content: space-between; gap: var(--space-3); align-items: center; }
.title { font-weight: 700; }
.status { font-size: var(--text-xs); }
.meta { display: flex; gap: var(--space-3); font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-1); }
.rewards { display: flex; gap: var(--space-3); font-size: var(--text-xs); margin-top: var(--space-2); }
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/admin/god-mode/QuestsViewPresentational.tsx \
        hero-academy/src/components/admin/god-mode/QuestsViewPresentational.module.css
git commit -m "feat(admin): QuestsViewPresentational for god mode

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 8: GodModeShell (header + tabs)

**Files:**
- Create: `src/components/admin/god-mode/GodModeShell.tsx`
- Create: `src/components/admin/god-mode/GodModeShell.module.css`

- [ ] **Step 1: Implement the shell**

Create `src/components/admin/god-mode/GodModeShell.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { ImpersonationSnapshot } from './types';
import { HeroViewPresentational } from './HeroViewPresentational';
import { InventoryViewPresentational } from './InventoryViewPresentational';
import { QuestsViewPresentational } from './QuestsViewPresentational';
import styles from './GodModeShell.module.css';

type Tab = 'hero' | 'inventory' | 'quests';

interface Props {
  snapshot: ImpersonationSnapshot;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

export function GodModeShell({ snapshot, loading, onRefresh, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('hero');

  // Auto-refresh when user switches tabs (except first mount)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) { setMounted(true); return; }
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.title}>
          <span className={styles.eye}>👁</span>
          <div>
            <div className={styles.name}>{snapshot.student.display_name}</div>
            <div className={styles.sub}>
              {snapshot.student.email ?? '—'}
              {snapshot.student.class_name && ` · ${snapshot.student.class_name}`}
              {snapshot.student.school_name && ` · ${snapshot.student.school_name}`}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={onRefresh} disabled={loading}>
            {loading ? '⏳' : '🔄'} Обновить
          </button>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>
      </header>

      <nav className={styles.tabs}>
        <TabButton label="🧙 Герой"     active={tab === 'hero'}      onClick={() => setTab('hero')} />
        <TabButton label="🎒 Инвентарь" active={tab === 'inventory'} onClick={() => setTab('inventory')} />
        <TabButton label="📜 Задания"   active={tab === 'quests'}    onClick={() => setTab('quests')} />
      </nav>

      <section className={styles.body}>
        {tab === 'hero'      && <HeroViewPresentational hero={snapshot.hero} stats={snapshot.stats} />}
        {tab === 'inventory' && <InventoryViewPresentational artifacts={snapshot.artifacts} />}
        {tab === 'quests'    && <QuestsViewPresentational active={snapshot.quests.active} completed={snapshot.quests.completed} />}
      </section>

      <footer className={styles.footer}>
        Снимок от {new Date(snapshot.fetched_at).toLocaleString('ru-RU')} · режим просмотра
      </footer>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`${styles.tabBtn} ${active ? styles.tabBtnActive : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Add styles**

Create `src/components/admin/god-mode/GodModeShell.module.css`:

```css
.wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--bg-primary);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--bg-glass-border);
}
.title { display: flex; gap: var(--space-3); align-items: center; }
.eye { font-size: var(--text-2xl); }
.name { font-size: var(--text-xl); font-weight: 800; }
.sub { font-size: var(--text-xs); color: var(--text-secondary); }

.actions { display: flex; gap: var(--space-2); }
.btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--bg-glass-border);
  background: var(--bg-glass);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
}
.btn:disabled { opacity: 0.6; cursor: default; }
.btnClose {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--bg-glass-border);
  background: var(--bg-glass);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 700;
}

.tabs { display: flex; gap: var(--space-2); }
.tabBtn {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--bg-glass-border);
  background: var(--bg-glass);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-weight: 600;
  font-size: var(--text-sm);
}
.tabBtnActive { border-color: var(--accent-xp); color: var(--accent-xp); }

.body { min-height: 200px; }

.footer {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-align: right;
  padding-top: var(--space-2);
  border-top: 1px solid var(--bg-glass-border);
}
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/components/admin/god-mode/GodModeShell.tsx \
        hero-academy/src/components/admin/god-mode/GodModeShell.module.css
git commit -m "feat(admin): GodModeShell with tabs and refresh

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 9: God Mode page (fetch + guard + shell)

**Files:**
- Create: `src/app/(admin)/admin/users/[id]/view/page.tsx`
- Create: `src/app/(admin)/admin/users/[id]/view/page.module.css`

- [ ] **Step 1: Implement the page**

Create `src/app/(admin)/admin/users/[id]/view/page.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ReadOnlyProvider } from '@/components/admin/ReadOnlyGuard';
import { GodModeShell } from '@/components/admin/god-mode/GodModeShell';
import type { ImpersonationSnapshot } from '@/components/admin/god-mode/types';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function GodModePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<ImpersonationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/impersonate/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Доступ запрещён. Требуется роль admin.');
        if (res.status === 404) throw new Error('Пользователь не найден.');
        throw new Error(`Ошибка загрузки (${res.status})`);
      }
      const data: ImpersonationSnapshot = await res.json();
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleClose = () => router.push('/admin/users');

  if (loading && !snapshot) {
    return <div className={styles.state}>⏳ Загрузка снимка...</div>;
  }
  if (error) {
    return (
      <div className={styles.state}>
        <p>❌ {error}</p>
        <button className={styles.retryBtn} onClick={load}>Повторить</button>
        <button className={styles.retryBtn} onClick={handleClose}>Назад</button>
      </div>
    );
  }
  if (!snapshot) {
    return <div className={styles.state}>Нет данных</div>;
  }

  return (
    <ReadOnlyProvider value={true}>
      <div className={styles.page}>
        <GodModeShell
          snapshot={snapshot}
          loading={loading}
          onRefresh={load}
          onClose={handleClose}
        />
      </div>
    </ReadOnlyProvider>
  );
}
```

- [ ] **Step 2: Add styles**

Create `src/app/(admin)/admin/users/[id]/view/page.module.css`:

```css
.page { display: flex; flex-direction: column; gap: var(--space-4); }

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  gap: var(--space-3);
  opacity: 0.8;
  text-align: center;
}

.retryBtn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--bg-glass-border);
  background: var(--bg-glass);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
}
```

- [ ] **Step 3: Type-check + lint**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/\(admin\)/admin/users/\[id\]/view
git commit -m "feat(admin): god mode page wiring fetch + ReadOnlyProvider

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 10: «👁 Посмотреть» button in /admin/users

**Files:**
- Modify: `src/app/(admin)/admin/users/page.tsx` (around the actions cell, currently lines ~118–148)

- [ ] **Step 1: Add the import**

At the top of `src/app/(admin)/admin/users/page.tsx`, add next to existing imports:

```typescript
import Link from 'next/link';
```

- [ ] **Step 2: Add the button inside the actions cell**

Locate the `<span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>` block (the actions cell) and insert the new button as the **first** child of that span:

```tsx
<span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
  {/* View as student — God Mode (admin only, students only) */}
  {u.role === 'student' && (
    <Link
      href={`/admin/users/${u.id}/view`}
      style={{ ...btnBase, background: 'rgba(59,130,246,0.2)', color: '#3b82f6', textDecoration: 'none' }}
      title="Посмотреть глазами ученика"
    >
      👁 Посмотреть
    </Link>
  )}
  {/* Resurrect */}
  {u.role === 'student' && u.hero_status === 'inactive' && (
    /* …existing resurrect button… */
```

(Keep the existing `Resurrect`, `Grant XP`, and `Delete` buttons untouched.)

- [ ] **Step 3: Type-check + lint**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm run dev
```

Then in a browser, as an admin user:

1. Navigate to `/admin/users`
2. Click «👁 Посмотреть» on a student row
3. Verify the God Mode page loads with hero/inventory/quests tabs
4. Switch tabs — data should reload automatically
5. Click «🔄 Обновить» — data reloads
6. Click «✕» — returns to `/admin/users`
7. Try as a non-admin user (e.g. teacher) — the API must return 403

Expected: all steps pass. Stop the dev server with `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/macbookm/Hero academy"
git add hero-academy/src/app/\(admin\)/admin/users/page.tsx
git commit -m "feat(admin): add '👁 Посмотреть' button to users table

Entry point for God Mode — appears only on student rows and links to
/admin/users/[id]/view.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

---

## Task 11: Full test + lint + build sweep

- [ ] **Step 1: Run all tests**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Lint the whole project**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm run lint
```

Expected: no new warnings/errors in the touched files.

- [ ] **Step 3: Type-check**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Production build**

```bash
cd "/Users/macbookm/Hero academy/hero-academy"
npm run build
```

Expected: build succeeds, new route `/admin/users/[id]/view` is listed in the App Router manifest.

- [ ] **Step 5: Final commit (if the previous steps uncovered fixes)**

```bash
cd "/Users/macbookm/Hero academy"
git add -A hero-academy/
git commit -m "fix: address lint/type/build issues from god mode sweep

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "nothing to commit"
git push
```
