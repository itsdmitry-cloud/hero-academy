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
    // Сохраняем уже нанесённый урон, а не остаток HP. Иначе при росте класса
    // боссу не добавилось бы HP за новых учеников (баг 2026-05-07: 2→8 учеников
    // оставляли current_hp=1319 при newMax=6912 — босс выглядел почти мёртвым).
    const damageDealt = Math.max(0, boss.max_hp - boss.current_hp);
    const newCurrentHp = Math.max(0, newMaxHp - damageDealt);
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
