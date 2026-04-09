import { describe, it, expect } from 'vitest';
import { normalizeSubject, normalizeSubjects, isSameSubject } from '../subjects';

describe('normalizeSubject', () => {
  it('trims edges', () => {
    expect(normalizeSubject('  Математика  ')).toBe('Математика');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeSubject('Русский  язык')).toBe('Русский язык');
    expect(normalizeSubject('Русский\tязык')).toBe('Русский язык');
    expect(normalizeSubject('Русский\n язык')).toBe('Русский язык');
  });

  it('preserves original casing (display-friendly)', () => {
    expect(normalizeSubject('Математика')).toBe('Математика');
    expect(normalizeSubject('математика')).toBe('математика');
  });

  it('handles empty/null input', () => {
    expect(normalizeSubject('')).toBe('');
    expect(normalizeSubject(null)).toBe('');
    expect(normalizeSubject(undefined)).toBe('');
    expect(normalizeSubject('   ')).toBe('');
  });
});

describe('normalizeSubjects', () => {
  it('deduplicates case-insensitively, keeping first occurrence', () => {
    expect(normalizeSubjects(['Математика', 'математика', 'МАТЕМАТИКА'])).toEqual(['Математика']);
  });

  it('trims each entry before dedupe', () => {
    expect(normalizeSubjects([' Математика ', 'математика', '  Физика'])).toEqual(['Математика', 'Физика']);
  });

  it('skips empty entries', () => {
    expect(normalizeSubjects(['', '  ', 'Физика'])).toEqual(['Физика']);
  });

  it('returns [] on null/undefined', () => {
    expect(normalizeSubjects(null)).toEqual([]);
    expect(normalizeSubjects(undefined)).toEqual([]);
  });
});

describe('isSameSubject', () => {
  it('matches regardless of case and surrounding whitespace', () => {
    expect(isSameSubject('Математика', 'математика')).toBe(true);
    expect(isSameSubject(' Математика ', 'МАТЕМАТИКА')).toBe(true);
    expect(isSameSubject('Русский  язык', 'Русский язык')).toBe(true);
  });

  it('returns false for different subjects', () => {
    expect(isSameSubject('Математика', 'Физика')).toBe(false);
  });

  it('treats null/empty as equal to each other but not to a real subject', () => {
    expect(isSameSubject(null, undefined)).toBe(true);
    expect(isSameSubject('', null)).toBe(true);
    expect(isSameSubject('Математика', null)).toBe(false);
  });
});
