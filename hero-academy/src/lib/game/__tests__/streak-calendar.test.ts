import { describe, expect, it } from 'vitest';
import {
  ALPHA_MATH_CALENDAR,
  getDayOfWeek,
  getMoscowDate,
  isSchoolDay,
  missedSchoolDaysBetween,
  planStreakUpdate,
} from '../streak-calendar';

describe('getDayOfWeek', () => {
  it('возвращает 1 для понедельника 4 мая 2026', () => {
    expect(getDayOfWeek('2026-05-04')).toBe(1);
  });

  it('возвращает 3 для среды 6 мая 2026', () => {
    expect(getDayOfWeek('2026-05-06')).toBe(3);
  });

  it('возвращает 0 для воскресенья 10 мая 2026', () => {
    expect(getDayOfWeek('2026-05-10')).toBe(0);
  });
});

describe('getMoscowDate', () => {
  it('возвращает дату Москвы для UTC-полуночи следующего дня', () => {
    // 2026-05-04T22:00:00Z = 2026-05-05 01:00 в Москве
    expect(getMoscowDate(new Date('2026-05-04T22:00:00Z'))).toBe('2026-05-05');
  });

  it('возвращает дату Москвы для UTC-полудня', () => {
    expect(getMoscowDate(new Date('2026-05-06T12:00:00Z'))).toBe('2026-05-06');
  });
});

describe('isSchoolDay (альфа-календарь: Пн/Ср/Чт/Пт)', () => {
  it('понедельник 4 мая — праздник? нет, только если в HOLIDAYS', () => {
    // 2026-05-04 — обычный понедельник, школьный день
    expect(isSchoolDay('2026-05-04', ALPHA_MATH_CALENDAR)).toBe(true);
  });

  it('вторник 5 мая — НЕ школьный (математика только Пн/Ср/Чт/Пт)', () => {
    expect(isSchoolDay('2026-05-05', ALPHA_MATH_CALENDAR)).toBe(false);
  });

  it('среда 6 мая — школьный', () => {
    expect(isSchoolDay('2026-05-06', ALPHA_MATH_CALENDAR)).toBe(true);
  });

  it('четверг 7 мая — школьный', () => {
    expect(isSchoolDay('2026-05-07', ALPHA_MATH_CALENDAR)).toBe(true);
  });

  it('пятница 8 мая — школьный', () => {
    expect(isSchoolDay('2026-05-08', ALPHA_MATH_CALENDAR)).toBe(true);
  });

  it('суббота 9 мая — НЕ школьный (выходной + праздник)', () => {
    expect(isSchoolDay('2026-05-09', ALPHA_MATH_CALENDAR)).toBe(false);
  });

  it('воскресенье 10 мая — НЕ школьный', () => {
    expect(isSchoolDay('2026-05-10', ALPHA_MATH_CALENDAR)).toBe(false);
  });

  it('понедельник 11 мая — праздник, НЕ школьный', () => {
    expect(isSchoolDay('2026-05-11', ALPHA_MATH_CALENDAR)).toBe(false);
  });

  it('праздник 1 мая — НЕ школьный', () => {
    expect(isSchoolDay('2026-05-01', ALPHA_MATH_CALENDAR)).toBe(false);
  });

  it('понедельник 18 мая — школьный (после праздников)', () => {
    expect(isSchoolDay('2026-05-18', ALPHA_MATH_CALENDAR)).toBe(true);
  });
});

describe('missedSchoolDaysBetween', () => {
  it('возвращает 0 для двух соседних школьных дней (Пн → Ср)', () => {
    // Между Пн 4 мая и Ср 6 мая только Вт 5 мая — не школьный
    expect(missedSchoolDaysBetween('2026-05-04', '2026-05-06', ALPHA_MATH_CALENDAR)).toBe(0);
  });

  it('возвращает 0 для Ср → Чт (соседние дни)', () => {
    expect(missedSchoolDaysBetween('2026-05-06', '2026-05-07', ALPHA_MATH_CALENDAR)).toBe(0);
  });

  it('возвращает 0 для Пт → Пн через выходные', () => {
    expect(missedSchoolDaysBetween('2026-05-15', '2026-05-18', ALPHA_MATH_CALENDAR)).toBe(0);
  });

  it('возвращает 0 для Пт 8 мая → Ср 13 мая (между ними праздник 11 + Вт 12)', () => {
    expect(missedSchoolDaysBetween('2026-05-08', '2026-05-13', ALPHA_MATH_CALENDAR)).toBe(0);
  });

  it('возвращает 1 если пропустили один школьный день (Пт 8 → Чт 14, Ср 13 пропущена)', () => {
    expect(missedSchoolDaysBetween('2026-05-08', '2026-05-14', ALPHA_MATH_CALENDAR)).toBe(1);
  });

  it('возвращает 2 если пропущены Ср и Чт (Пт 8 → Пт 15)', () => {
    expect(missedSchoolDaysBetween('2026-05-08', '2026-05-15', ALPHA_MATH_CALENDAR)).toBe(2);
  });

  it('возвращает 0 для одного и того же дня', () => {
    expect(missedSchoolDaysBetween('2026-05-06', '2026-05-06', ALPHA_MATH_CALENDAR)).toBe(0);
  });
});

describe('planStreakUpdate', () => {
  describe('пропускает обновление в нешкольные дни', () => {
    it('Вт 5 мая → skip', () => {
      const plan = planStreakUpdate('2026-05-05', '2026-05-04', ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('skip');
    });

    it('Сб 9 мая → skip', () => {
      const plan = planStreakUpdate('2026-05-09', '2026-05-08', ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('skip');
    });

    it('Пн 11 мая (праздник) → skip', () => {
      const plan = planStreakUpdate('2026-05-11', '2026-05-08', ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('skip');
    });
  });

  describe('обычное обновление', () => {
    it('первая активность (lastDate=null) → normal', () => {
      const plan = planStreakUpdate('2026-05-06', null, ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('normal');
    });

    it('lastDate = вчера → normal (PG увидит как +1)', () => {
      const plan = planStreakUpdate('2026-05-07', '2026-05-06', ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('normal');
    });

    it('lastDate = сегодня → normal (RPC будет no-op)', () => {
      const plan = planStreakUpdate('2026-05-06', '2026-05-06', ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('normal');
    });
  });

  describe('мост через нешкольные дни', () => {
    it('Пт 15 → Пн 18: bridge на Вс 17', () => {
      const plan = planStreakUpdate('2026-05-18', '2026-05-15', ALPHA_MATH_CALENDAR);
      expect(plan).toEqual({ kind: 'bridge', bridgeDate: '2026-05-17' });
    });

    it('Пт 8 → Ср 13 (праздник 11 + Вт 12): bridge на Вт 12', () => {
      const plan = planStreakUpdate('2026-05-13', '2026-05-08', ALPHA_MATH_CALENDAR);
      expect(plan).toEqual({ kind: 'bridge', bridgeDate: '2026-05-12' });
    });

    it('Пн 4 → Ср 6 (Вт пропущен): bridge на Вт 5', () => {
      const plan = planStreakUpdate('2026-05-06', '2026-05-04', ALPHA_MATH_CALENDAR);
      expect(plan).toEqual({ kind: 'bridge', bridgeDate: '2026-05-05' });
    });
  });

  describe('grace period (1 пропущенный школьный день)', () => {
    it('Пт 8 → Чт 14 (пропущена Ср 13): bridge — в пределах grace=1', () => {
      const plan = planStreakUpdate('2026-05-14', '2026-05-08', ALPHA_MATH_CALENDAR);
      expect(plan).toEqual({ kind: 'bridge', bridgeDate: '2026-05-13' });
    });

    it('Пт 8 → Пт 15 (пропущены Ср и Чт): normal — будет сброс', () => {
      const plan = planStreakUpdate('2026-05-15', '2026-05-08', ALPHA_MATH_CALENDAR);
      expect(plan.kind).toBe('normal');
    });
  });
});
