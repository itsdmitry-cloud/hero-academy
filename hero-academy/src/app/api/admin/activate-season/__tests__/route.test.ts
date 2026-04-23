/**
 * Integration tests for POST /api/admin/activate-season
 *
 * Mocks:
 *  - @supabase/supabase-js → fake client controlled per-test via mockState
 *  - @/lib/game/constants  → getEconomyConfig returns { boss_hp_multiplier: 100, ... }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Shared mock state ────────────────────────────────────────────────────────
// IMPORTANT: must be an object literal (not a `let` primitive/reassignable) so
// that the hoisted vi.mock factory captures a stable reference rather than a TDZ
// variable.

interface MockHandlers {
  season?: any;
  teachers?: { subjects: string[] | null }[];
  classes?: { id: string; name: string }[];
  studentCounts?: Record<string, number>;
  existingBosses?: any[];
  insertSink?: any[];
}

const mockState: { handlers: MockHandlers } = { handlers: {} };

// ─── Supabase mock ────────────────────────────────────────────────────────────

function makeBuilder(tableName: string) {
  const state: {
    op: 'select' | 'insert' | 'update' | 'none';
    filters: Record<string, any>;
    updated: any;
    inserted: any;
    isCount: boolean;
    isHead: boolean;
  } = {
    op: 'none',
    filters: {},
    updated: null,
    inserted: null,
    isCount: false,
    isHead: false,
  };

  function resolve(): any {
    const h = mockState.handlers;

    // ── INSERT ─────────────────────────────────────────────────────────────
    if (state.op === 'insert') {
      if (tableName === 'subject_bosses' && h.insertSink) {
        h.insertSink.push(state.inserted);
      }
      return { data: null, error: null };
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────
    if (state.op === 'update') {
      return { data: null, error: null };
    }

    // ── SELECT ─────────────────────────────────────────────────────────────
    if (tableName === 'seasons') {
      if (state.filters['id']) {
        return { data: h.season ?? null, error: null };
      }
      return { data: null, error: null };
    }

    if (tableName === 'users') {
      // Count query for students
      if (state.isCount && state.filters['role'] === 'student') {
        const classId = state.filters['class_id'] as string;
        const count = h.studentCounts?.[classId] ?? 0;
        return { count, data: null, error: null };
      }
      // Teachers query
      if (state.filters['role'] === 'teacher') {
        return { data: h.teachers ?? [], error: null };
      }
      return { data: [], error: null };
    }

    if (tableName === 'classes') {
      return { data: h.classes ?? [], error: null };
    }

    if (tableName === 'subject_bosses') {
      return { data: h.existingBosses ?? [], error: null };
    }

    return { data: null, error: null };
  }

  const builder: any = {
    select(cols?: string, opts?: any) {
      state.op = 'select';
      if (opts?.count) state.isCount = true;
      if (opts?.head) state.isHead = true;
      return builder;
    },
    eq(key: string, value: any) {
      state.filters[key] = value;
      return builder;
    },
    neq(_key: string, _value: any) {
      return builder;
    },
    ilike(_key: string, _value: any) {
      return builder;
    },
    update(patch: any) {
      state.op = 'update';
      state.updated = patch;
      return builder;
    },
    insert(row: any) {
      state.op = 'insert';
      state.inserted = row;
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(resolve());
    },
    // Thenable — `await builder.select().eq()` resolves directly
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

function makeFakeClient() {
  return {
    from(table: string) {
      return makeBuilder(table);
    },
  };
}

// vi.mock is hoisted — factory must NOT reference variables defined below
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeFakeClient(),
}));

// Partial mock of constants — keep pure helpers, override only getEconomyConfig
vi.mock('@/lib/game/constants', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/game/constants')>();
  return {
    ...original,
    getEconomyConfig: vi.fn().mockResolvedValue({
      dmg_multiplier: 100,
      xp_multiplier: 100,
      gold_multiplier: 100,
      drop_rate_multiplier: 100,
      boss_hp_multiplier: 100,
    }),
  };
});

// ─── Import route AFTER mocks ─────────────────────────────────────────────────
import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/admin/activate-season', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Season spanning exactly 4 weeks */
const SEASON = {
  id: 's1',
  school_id: 'school1',
  starts_at: '2026-05-04T00:00:00Z',
  ends_at: '2026-06-01T00:00:00Z', // ≈ 4 weeks
};

beforeEach(() => {
  mockState.handlers = {};
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/activate-season', () => {
  it('happy path: 2 classes × 2 subjects → bossesCreated=4', async () => {
    const insertSink: any[] = [];
    mockState.handlers = {
      season: SEASON,
      teachers: [{ subjects: ['Математика', 'Физика'] }],
      classes: [
        { id: 'c1', name: '6А' },
        { id: 'c2', name: '6Б' },
      ],
      studentCounts: { c1: 10, c2: 15 },
      existingBosses: [],
      insertSink,
    };

    const res = await POST(makeRequest({ seasonId: 's1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.bossesCreated).toBe(4);
    expect(json.classesSkipped).toEqual([]);
    expect(json.subjects).toEqual(expect.arrayContaining(['Математика', 'Физика']));
    expect(json.subjects).toHaveLength(2);
    expect(insertSink).toHaveLength(4);
  });

  it('empty class skipped: class with 0 students appears in classesSkipped', async () => {
    const insertSink: any[] = [];
    mockState.handlers = {
      season: SEASON,
      teachers: [{ subjects: ['Математика'] }],
      classes: [
        { id: 'c1', name: '6А' }, // empty
        { id: 'c2', name: '6Б' }, // has students
      ],
      studentCounts: { c1: 0, c2: 12 },
      existingBosses: [],
      insertSink,
    };

    const res = await POST(makeRequest({ seasonId: 's1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.bossesCreated).toBe(1);
    expect(json.classesSkipped).toHaveLength(1);
    expect(json.classesSkipped[0]).toMatchObject({ id: 'c1', reason: 'no_students' });
    expect(insertSink).toHaveLength(1);
  });

  it('no teachers with subjects: bossesCreated=0, subjects=[], warning in Russian', async () => {
    mockState.handlers = {
      season: SEASON,
      teachers: [], // no teachers
      classes: [{ id: 'c1', name: '6А' }],
      studentCounts: { c1: 10 },
      existingBosses: [],
      insertSink: [],
    };

    const res = await POST(makeRequest({ seasonId: 's1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.bossesCreated).toBe(0);
    expect(json.subjects).toEqual([]);
    expect(json.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('учител')]),
    );
  });

  it('idempotent: existing boss for one pair → only new pair inserted, bossesCreated=1', async () => {
    const insertSink: any[] = [];
    mockState.handlers = {
      season: SEASON,
      teachers: [{ subjects: ['Математика', 'Физика'] }],
      classes: [{ id: 'c1', name: '6А' }],
      studentCounts: { c1: 10 },
      existingBosses: [
        {
          id: 'b-existing',
          class_id: 'c1',
          subject_id: 'Математика',
          max_hp: 9600,
          current_hp: 9600,
          is_defeated: false,
        },
      ],
      insertSink,
    };

    const res = await POST(makeRequest({ seasonId: 's1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Математика already exists → only Физика boss created
    expect(json.bossesCreated).toBe(1);
    expect(json.classesSkipped).toEqual([]);
    expect(insertSink).toHaveLength(1);
    expect(insertSink[0]).toMatchObject({ subject_id: 'Физика', class_id: 'c1' });
  });
});
