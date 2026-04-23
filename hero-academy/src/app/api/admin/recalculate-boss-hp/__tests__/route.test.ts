/**
 * Integration tests for POST /api/admin/recalculate-boss-hp
 *
 * Mocks:
 *   - @supabase/supabase-js → tracks all select/update/insert calls
 *   - @/lib/game/constants   → getEconomyConfig returns multiplier=100 by default
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Shared sinks ─────────────────────────────────────────────────────────────

let updateSink: { table: string; patch: Record<string, unknown>; id: string }[] = [];
let insertSink: { table: string; row: Record<string, unknown> }[] = [];

// ─── Supabase mock factory ─────────────────────────────────────────────────────

/**
 * Builds a thenable chain builder for a given table.
 * `resolver` is called when the chain is awaited or `.maybeSingle()` is called.
 * For `.select('id', { count: 'exact', head: true })` calls, resolver should
 * return `{ count: N }`.
 */
function makeChain(
  table: string,
  resolver: () => unknown,
): Record<string, unknown> {
  // Mutable state per chain: tracks the boss id for updates
  let pendingId: string | undefined;

  const builder: Record<string, unknown> = {
    select: (..._args: unknown[]) => builder,
    eq: (_col: string, val: unknown) => {
      // Capture the id value when `.eq('id', bossId)` is called
      if (_col === 'id') pendingId = val as string;
      return builder;
    },
    neq: () => builder,
    update: (patch: Record<string, unknown>) => {
      updateSink.push({ table, patch, id: pendingId ?? '' });
      return builder;
    },
    insert: (row: Record<string, unknown>) => {
      insertSink.push({ table, row });
      return builder;
    },
    maybeSingle: () => Promise.resolve(resolver()),
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolver()).then(fn),
  };
  return builder;
}

// ─── Per-test configurable data ────────────────────────────────────────────────

type MockData = {
  season: Record<string, unknown> | null;
  teachers: Record<string, unknown>[];
  classes: Record<string, unknown>[];
  studentCountByClassId: Record<string, number>;
  existingBosses: Record<string, unknown>[];
};

let mockData: MockData = {
  season: null,
  teachers: [],
  classes: [],
  studentCountByClassId: {},
  existingBosses: [],
};

// Track which table's query we're building. We use a per-call sequence approach
// since the route calls `admin.from(table)` multiple times.
const fromCallIndex: Record<string, number> = {};

vi.mock('@supabase/supabase-js', () => {
  const createClient = () => ({
    from: (table: string) => {
      // Count how many times this table has been called so far
      fromCallIndex[table] = (fromCallIndex[table] ?? 0) + 1;
      const callIdx = fromCallIndex[table];

      if (table === 'seasons') {
        return makeChain(table, () => ({ data: mockData.season, error: null }));
      }

      if (table === 'users') {
        // First call: teachers (select subjects)
        // Subsequent calls: student counts (select id with count:exact)
        if (callIdx === 1) {
          return makeChain(table, () => ({ data: mockData.teachers, error: null }));
        }
        // For student count queries, we need to figure out which class this is.
        // The route does .eq('class_id', cls.id) — we need to capture that.
        // We use a special resolver that peeks at the upcoming eq call.
        let classIdForCount: string | undefined;
        const countBuilder: Record<string, unknown> = {
          select: (..._args: unknown[]) => countBuilder,
          eq: (_col: string, val: unknown) => {
            if (_col === 'class_id') classIdForCount = val as string;
            return countBuilder;
          },
          then: (fn: (v: unknown) => unknown) => {
            const count = classIdForCount
              ? (mockData.studentCountByClassId[classIdForCount] ?? 0)
              : 0;
            return Promise.resolve({ count, error: null }).then(fn);
          },
        };
        return countBuilder;
      }

      if (table === 'classes') {
        return makeChain(table, () => ({ data: mockData.classes, error: null }));
      }

      if (table === 'subject_bosses') {
        if (callIdx === 1) {
          // SELECT existing bosses
          return makeChain(table, () => ({ data: mockData.existingBosses, error: null }));
        }
        // UPDATE or INSERT calls (callIdx >= 2)
        // Both return no error by default
        return makeChain(table, () => ({ error: null }));
      }

      // Fallback
      return makeChain(table, () => ({ data: null, error: null }));
    },
  });
  return { createClient };
});

vi.mock('@/lib/game/constants', () => ({
  getEconomyConfig: vi.fn().mockResolvedValue({ boss_hp_multiplier: 100 }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/recalculate-boss-hp', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Reset per-test
beforeEach(() => {
  updateSink = [];
  insertSink = [];
  Object.keys(fromCallIndex).forEach((k) => delete fromCallIndex[k]);
  mockData = {
    season: null,
    teachers: [],
    classes: [],
    studentCountByClassId: {},
    existingBosses: [],
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/recalculate-boss-hp', () => {
  /**
   * Test 1: dryRun=true returns diff without mutation
   *
   * 10 students × 3 × 4 weeks × 80 = 9600 base HP.
   * Old boss has max_hp=5000 (stale). New HP = 9600. Diff expected.
   * No DB mutations (update/insert sinks must be empty).
   */
  it('dryRun=true returns diff without DB mutation', async () => {
    mockData.season = {
      id: 'season-1',
      school_id: 'school-1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-29', // 4 weeks
    };
    mockData.teachers = [{ subjects: ['Математика'] }];
    mockData.classes = [{ id: 'class-1', name: '6А' }];
    mockData.studentCountByClassId = { 'class-1': 10 };
    mockData.existingBosses = [
      {
        id: 'boss-1',
        class_id: 'class-1',
        subject_id: 'Математика',
        max_hp: 5000,
        current_hp: 3000,
        is_defeated: false,
      },
    ];

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ seasonId: 'season-1', dryRun: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applied).toBe(false);
    expect(body.changes).toHaveLength(1);

    const change = body.changes[0];
    expect(change.bossId).toBe('boss-1');
    expect(change.oldMaxHp).toBe(5000);
    expect(change.newMaxHp).toBe(9600); // 10×3×4×80
    expect(change.oldCurrentHp).toBe(3000);
    expect(change.newCurrentHp).toBe(3000); // min(3000, 9600) = 3000

    // No mutations
    expect(updateSink).toHaveLength(0);
    expect(insertSink).toHaveLength(0);
  });

  /**
   * Test 2: dryRun=false applies changes
   *
   * Same scenario as Test 1 but dryRun=false.
   * applied=true, appliedCount=1, updateSink has one entry with correct patch.
   */
  it('dryRun=false applies changes and returns applied=true', async () => {
    mockData.season = {
      id: 'season-1',
      school_id: 'school-1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-29', // 4 weeks
    };
    mockData.teachers = [{ subjects: ['Математика'] }];
    mockData.classes = [{ id: 'class-1', name: '6А' }];
    mockData.studentCountByClassId = { 'class-1': 10 };
    mockData.existingBosses = [
      {
        id: 'boss-1',
        class_id: 'class-1',
        subject_id: 'Математика',
        max_hp: 5000,
        current_hp: 3000,
        is_defeated: false,
      },
    ];

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ seasonId: 'season-1', dryRun: false }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applied).toBe(true);
    expect(body.appliedCount).toBe(1);
    expect(body.changes).toHaveLength(1);

    // Update sink should have the boss update
    expect(updateSink).toHaveLength(1);
    const upd = updateSink[0]!;
    expect(upd.table).toBe('subject_bosses');
    expect(upd.patch).toMatchObject({ max_hp: 9600, current_hp: 3000 });
  });

  /**
   * Test 3: Defeated boss appears in skipped, not in changes
   *
   * A boss with is_defeated=true must appear in skipped with reason='defeated'
   * and must NOT appear in changes.
   */
  it('defeated boss is in skipped, not in changes', async () => {
    mockData.season = {
      id: 'season-1',
      school_id: 'school-1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-29',
    };
    mockData.teachers = [{ subjects: ['Математика'] }];
    mockData.classes = [{ id: 'class-1', name: '6А' }];
    mockData.studentCountByClassId = { 'class-1': 10 };
    mockData.existingBosses = [
      {
        id: 'boss-defeated',
        class_id: 'class-1',
        subject_id: 'Математика',
        max_hp: 1000,
        current_hp: 0,
        is_defeated: true,
      },
    ];

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ seasonId: 'season-1', dryRun: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.changes).toHaveLength(0);
    expect(body.skipped).toHaveLength(1);

    const skipped = body.skipped[0];
    expect(skipped.bossId).toBe('boss-defeated');
    expect(skipped.reason).toBe('defeated');

    // max_hp and current_hp of defeated boss are NOT in changes
    const anyChange = body.changes.find(
      (c: Record<string, unknown>) => c.bossId === 'boss-defeated',
    );
    expect(anyChange).toBeUndefined();
  });

  /**
   * Test 4: Clamp behavior
   *
   * Case A (shrink): old max=20000, current=18000 → 5 students → new max=4800.
   *   newCurrentHp = min(18000, 4800) = 4800 (clamped down).
   *
   * Case B (grow): old max=9600, current=5000 → 15 students → new max=14400.
   *   newCurrentHp = min(5000, 14400) = 5000 (preserved).
   */
  it('clamp: shrinks current to new_max when class shrinks, preserves when class grows', async () => {
    mockData.season = {
      id: 'season-1',
      school_id: 'school-1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-29', // 4 weeks
    };
    mockData.teachers = [{ subjects: ['Математика'] }];
    mockData.classes = [
      { id: 'class-shrink', name: '5А' },
      { id: 'class-grow', name: '6А' },
    ];
    mockData.studentCountByClassId = {
      'class-shrink': 5, // was 20-something, now 5 → 5×3×4×80=4800
      'class-grow': 15,  // was 10, now 15 → 15×3×4×80=14400
    };
    mockData.existingBosses = [
      {
        id: 'boss-shrink',
        class_id: 'class-shrink',
        subject_id: 'Математика',
        max_hp: 20000,
        current_hp: 18000,
        is_defeated: false,
      },
      {
        id: 'boss-grow',
        class_id: 'class-grow',
        subject_id: 'Математика',
        max_hp: 9600,
        current_hp: 5000,
        is_defeated: false,
      },
    ];

    const { POST } = await import('../route');
    const res = await POST(makeRequest({ seasonId: 'season-1', dryRun: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.changes).toHaveLength(2);

    const shrinkChange = body.changes.find(
      (c: Record<string, unknown>) => c.bossId === 'boss-shrink',
    );
    expect(shrinkChange.newMaxHp).toBe(4800);
    expect(shrinkChange.newCurrentHp).toBe(4800); // clamped from 18000

    const growChange = body.changes.find(
      (c: Record<string, unknown>) => c.bossId === 'boss-grow',
    );
    expect(growChange.newMaxHp).toBe(14400);
    expect(growChange.newCurrentHp).toBe(5000); // preserved, not inflated
  });

  /**
   * Test 5: New subject → added to newBosses
   *
   * Teacher has subjects=['Математика','Физика'].
   * Only Математика boss exists. After recalc:
   *   - newBosses has exactly one entry for Физика (for the class with ≥1 student).
   *   - In dryRun, nothing inserted.
   *   - In apply mode, insert is called once.
   */
  it('new subject appears in newBosses; insert called only in apply mode', async () => {
    const season = {
      id: 'season-1',
      school_id: 'school-1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-29',
    };

    // ── dryRun=true ──────────────────────────────────────────────────────────
    mockData.season = season;
    mockData.teachers = [{ subjects: ['Математика', 'Физика'] }];
    mockData.classes = [{ id: 'class-1', name: '6А' }];
    mockData.studentCountByClassId = { 'class-1': 10 };
    mockData.existingBosses = [
      {
        id: 'boss-math',
        class_id: 'class-1',
        subject_id: 'Математика',
        max_hp: 9600,
        current_hp: 9600,
        is_defeated: false,
      },
    ];

    const { POST } = await import('../route');
    const dryRes = await POST(makeRequest({ seasonId: 'season-1', dryRun: true }));
    const dryBody = await dryRes.json();

    expect(dryRes.status).toBe(200);
    expect(dryBody.newBosses).toHaveLength(1);
    expect(dryBody.newBosses[0].subjectId).toBe('Физика');
    expect(dryBody.newBosses[0].classId).toBe('class-1');
    // dryRun → no inserts
    expect(insertSink).toHaveLength(0);

    // ── dryRun=false (reset state, call again) ────────────────────────────────
    updateSink = [];
    insertSink = [];
    Object.keys(fromCallIndex).forEach((k) => delete fromCallIndex[k]);

    const applyRes = await POST(makeRequest({ seasonId: 'season-1', dryRun: false }));
    const applyBody = await applyRes.json();

    expect(applyRes.status).toBe(200);
    expect(applyBody.applied).toBe(true);
    expect(applyBody.newBosses).toHaveLength(1);
    // Insert called once for the new Физика boss
    expect(insertSink).toHaveLength(1);
    expect(insertSink[0]!.table).toBe('subject_bosses');
    expect(insertSink[0]!.row).toMatchObject({
      season_id: 'season-1',
      class_id: 'class-1',
      subject_id: 'Физика',
    });
  });
});
