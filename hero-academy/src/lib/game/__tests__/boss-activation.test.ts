import { describe, expect, it } from 'vitest';
import { collectSchoolSubjects } from '../boss-activation';

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
