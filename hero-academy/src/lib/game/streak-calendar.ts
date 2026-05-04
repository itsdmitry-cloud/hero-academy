/**
 * Календарь стрика для альфа-теста (4–25 мая 2026).
 *
 * Школьные (математические) дни: Пн/Ср/Чт/Пт.
 * Праздники: 1–3 и 9–11 мая (включая Пн 11.05) — стрик не сбрасывается.
 * Grace: допускается 1 пропущенный школьный день между оценками.
 */

export type IsoDate = string; // YYYY-MM-DD

export interface StreakCalendar {
  /** Дни недели (0=Вс…6=Сб), когда идёт целевой предмет. */
  schoolWeekdays: ReadonlySet<number>;
  /** Праздничные ISO-даты, когда стрик заморожен. */
  holidays: ReadonlySet<IsoDate>;
  /** Сколько школьных дней между оценками можно пропустить, чтобы стрик уцелел. */
  graceMissedSchoolDays: number;
}

export const ALPHA_MATH_CALENDAR: StreakCalendar = {
  schoolWeekdays: new Set<number>([1, 3, 4, 5]), // Пн, Ср, Чт, Пт
  holidays: new Set<IsoDate>([
    '2026-05-01', '2026-05-02', '2026-05-03',
    '2026-05-09', '2026-05-10', '2026-05-11',
  ]),
  graceMissedSchoolDays: 1,
};

/** День недели для ISO-даты (0=Вс…6=Сб), считается через UTC чтобы избежать TZ-сдвига. */
export function getDayOfWeek(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Текущая дата в Europe/Moscow в формате YYYY-MM-DD. */
export function getMoscowDate(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Прибавляет calendar days к ISO-дате. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().split('T')[0];
}

export function isSchoolDay(date: IsoDate, cal: StreakCalendar = ALPHA_MATH_CALENDAR): boolean {
  if (cal.holidays.has(date)) return false;
  return cal.schoolWeekdays.has(getDayOfWeek(date));
}

/** Сколько школьных дней строго между from и to (оба исключительно). */
export function missedSchoolDaysBetween(
  from: IsoDate,
  to: IsoDate,
  cal: StreakCalendar = ALPHA_MATH_CALENDAR,
): number {
  if (from >= to) return 0;
  let count = 0;
  let cursor = addDays(from, 1);
  while (cursor < to) {
    if (isSchoolDay(cursor, cal)) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export type StreakPlan =
  | { kind: 'skip'; reason: 'non_school_day' }
  | { kind: 'normal' }
  | { kind: 'bridge'; bridgeDate: IsoDate };

/**
 * Планирует обновление стрика:
 * - skip: сегодня нешкольный день (Вт/Сб/Вс/праздник) — стрик не трогаем
 * - normal: вызвать RPC как есть (RPC сама инкрементит/no-op/reset)
 * - bridge: перед RPC выставить heroes.streak_last_date = bridgeDate, чтобы PG увидел вчера→сегодня
 */
export function planStreakUpdate(
  today: IsoDate,
  lastDate: IsoDate | null,
  cal: StreakCalendar = ALPHA_MATH_CALENDAR,
): StreakPlan {
  if (!isSchoolDay(today, cal)) return { kind: 'skip', reason: 'non_school_day' };
  if (!lastDate) return { kind: 'normal' };
  if (lastDate >= today) return { kind: 'normal' };

  const yesterday = addDays(today, -1);
  if (lastDate === yesterday) return { kind: 'normal' };

  const missed = missedSchoolDaysBetween(lastDate, today, cal);
  if (missed <= cal.graceMissedSchoolDays) {
    return { kind: 'bridge', bridgeDate: yesterday };
  }
  return { kind: 'normal' };
}
