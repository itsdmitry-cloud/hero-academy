import { describe, expect, it } from 'vitest';
import { collectSchoolSubjects } from '../boss-activation';
import { buildBossCreationPlan, type ClassInfo, type ExistingBoss } from '../boss-activation';

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
