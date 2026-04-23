import { normalizeSubject } from '@/lib/utils/subjects';
import { calculateBossHp } from './boss-hp';

export interface TeacherSubjects {
  subjects: string[] | null | undefined;
}

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
