import { describe, expect, it } from 'vitest';
import { ageInYears, familyDate, formatFamilyDate, lifeSpan, yearOf } from './dates.js';

describe('partial and uncertain dates', () => {
  it('stores a year-only date without inventing a day', () => {
    const date = familyDate('1932', 'year');
    expect(yearOf(date)).toBe(1932);
    expect(formatFamilyDate(date)).toBe('1932');
  });

  it('labels approximate dates as approximate', () => {
    expect(formatFamilyDate(familyDate('1932', 'approximate'))).toBe('about 1932');
  });

  it('renders a month-level date without a day', () => {
    expect(formatFamilyDate(familyDate('1932-03', 'month'))).toBe('03/1932');
  });

  it('computes age from a year-only birth date', () => {
    expect(ageInYears(familyDate('1952', 'year'), new Date('2020-06-01T00:00:00Z'))).toBe(68);
  });

  it('computes a life span only when both years are known', () => {
    expect(lifeSpan({ birthDate: familyDate('1952', 'year'), livingStatus: 'living' })).toBe('b. 1952');
    expect(
      lifeSpan({ birthDate: familyDate('1952', 'year'), deathDate: familyDate('2019', 'year'), livingStatus: 'deceased' }),
    ).toBe('1952–2019');
  });

  it('rejects impossible input rather than silently guessing', () => {
    expect(() => familyDate('sometime in the 50s', 'exact')).toThrow();
  });
});
