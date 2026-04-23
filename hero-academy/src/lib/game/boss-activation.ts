import { normalizeSubject } from '@/lib/utils/subjects';

export interface TeacherSubjects {
  subjects: string[] | null | undefined;
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
