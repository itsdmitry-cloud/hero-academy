import { describe, expect, it } from 'vitest';
import { collectSchoolSubjects } from '../boss-activation';
import { buildBossCreationPlan, buildRecalcPlan, type ClassInfo, type ExistingBoss } from '../boss-activation';

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
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('пропускает пустые строки', () => {
    const result = collectSchoolSubjects([{ subjects: ['', '  ', 'Математика'] }]);
    expect(result).toEqual(['Математика']);
  });
});

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
