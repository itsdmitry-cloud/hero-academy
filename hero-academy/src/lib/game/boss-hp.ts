/**
 * Расчёт HP Сезонного Босса — single source of truth.
 *
 * Формула:
 *   hp = students × lessons_per_week × weeks × avg_dmg_per_lesson × (multiplierPct / 100)
 *
 * Интуиция: чтобы класс органично добил босса к концу четверти,
 * каждый ученик на каждом уроке должен вносить примерно `avg_dmg_per_lesson`
 * урона. Умножаем на длительность сезона и размер класса, затем накладываем
 * настраиваемый процентный множитель из `economy_config.boss_hp_multiplier`
 * (cascade: class → school → global). Дефолт множителя = 100% (без изменений).
 *
 * Дефолты подобраны на основе симуляций в `scripts/test-boss-hp.ts` и
 *   `scripts/simulate-alpha-test.ts`:
 *   - 3 урока/неделю на предмет (типичная нагрузка в средней школе)
 *   - 80 урона/урок — среднее XP за оценку при multiplier=100%.
 *     Расчёт: AVG_BASE_XP ≈ 135 (см. alphaSimulation.ts) × медианный
 *     GRADE_MULT ~0.55 (смесь 5/4/3) ≈ 74. Округлено до 80, чтобы босс
 *     не падал за первую неделю при нормальной активности класса.
 *     (Было 20 до 2026-04-23 — занижено примерно в 4×, из-за чего
 *     калибровка alpha с boss_hp=420% давала overshoot 461%.)
 *
 * Минимальный порог HP = 1000 применяется ПОСЛЕ умножения на множитель,
 * чтобы класс с низким `boss_hp_multiplier` всё равно не провалился ниже 1000
 * (иначе ученик одним рывком его добьёт и механика теряет смысл).
 */

export interface BossHpInput {
  /** Количество учеников в классе. Если 0 или unknown — используется fallback. */
  studentCount: number | null | undefined;
  /** Длительность сезона в неделях. Если <=0 — используется fallback. */
  seasonWeeks: number | null | undefined;
  /**
   * Процент из `economy_config.boss_hp_multiplier` (100 = без изменений).
   * Если не передан / null / <=0 / NaN — трактуется как 100 (защитный дефолт).
   */
  multiplierPct?: number | null | undefined;
}

// Дефолты для класса, по которому нет данных (например, ensure без доступа
// к seasons/users). Выбраны так, чтобы получилось ~36000 HP при multiplier=100%
// (10 × 3 × 15 × 80) — средний босс, живущий примерно всю четверть.
const DEFAULT_STUDENTS = 10;
const DEFAULT_WEEKS = 15;

const LESSONS_PER_WEEK = 3;
const AVG_DAMAGE_PER_LESSON = 80;
const MIN_HP = 1000;
const DEFAULT_MULTIPLIER_PCT = 100;

export function calculateBossHp({ studentCount, seasonWeeks, multiplierPct }: BossHpInput): number {
  const students = studentCount && studentCount > 0 ? studentCount : DEFAULT_STUDENTS;
  const weeks = seasonWeeks && seasonWeeks > 0 ? seasonWeeks : DEFAULT_WEEKS;
  // Защита от кривых данных: null / undefined / <=0 / NaN → 100%.
  const pct =
    typeof multiplierPct === 'number' && Number.isFinite(multiplierPct) && multiplierPct > 0
      ? multiplierPct
      : DEFAULT_MULTIPLIER_PCT;
  const raw = students * LESSONS_PER_WEEK * weeks * AVG_DAMAGE_PER_LESSON * (pct / 100);
  return Math.max(MIN_HP, Math.round(raw));
}

/**
 * Удобный хелпер: считает недели между двумя ISO-датами сезона.
 * Минимум 1 неделя, чтобы не упасть в ноль при очень коротком сезоне.
 */
export function weeksBetween(startsAt: string | Date, endsAt: string | Date): number {
  const starts = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const ends = endsAt instanceof Date ? endsAt : new Date(endsAt);
  const ms = ends.getTime() - starts.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 7)));
}
