/**
 * Нормализация имён предметов.
 *
 * В БД `subject_id` (в `subject_bosses`) и `users.subjects[]` хранятся как TEXT,
 * и легко ловят дубликаты вида "Математика" / "математика" / " Математика ".
 *
 * Правила:
 *  - display-регистр сохраняем (учителю приятнее видеть "Математика", а не "математика")
 *  - убираем внешние пробелы и схлопываем внутренние whitespace-последовательности
 *  - уникальность в БД обеспечивается expression-индексом `LOWER(subject_id)`
 *  - для сравнения в коде — `isSameSubject` (case-insensitive после нормализации)
 */

export function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  return subject.trim().replace(/\s+/g, ' ');
}

export function normalizeSubjects(list: readonly string[] | null | undefined): string[] {
  if (!list) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    const norm = normalizeSubject(raw);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(norm);
  }
  return result;
}

export function isSameSubject(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeSubject(a).toLowerCase() === normalizeSubject(b).toLowerCase();
}

/**
 * Экранирует LIKE-метасимволы (% _ \) перед использованием в PostgREST ilike.
 *
 * Без этого предмет вида "Matematika_2" или "Англ%" сматчится не с тем,
 * что нужно, и обойдёт UNIQUE-защиту (индекс литеральный, а .ilike с wildcard
 * найдёт "соседа" и код решит, что босс уже есть).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
