import { describe, expect, it } from 'vitest';
import { nameSimilarity, normaliseName, phoneticKey } from './text.js';

describe('name matching for duplicates and search', () => {
  it('treats common transliterations of the same name as similar', () => {
    expect(nameSimilarity('Mohammed', 'Muhammad')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Mohammed', 'Muhammad')).toBeLessThan(1);
  });

  it('normalises Urdu diacritics and letter variants', () => {
    expect(normaliseName('مُحَمَّد')).toBe(normaliseName('محمد'));
    expect(normaliseName('كريم')).toBe(normaliseName('کریم'));
  });

  it('does not collapse genuinely different names', () => {
    expect(nameSimilarity('Bilal', 'Zainab')).toBeLessThan(0.5);
  });

  it('produces a stable phonetic key', () => {
    expect(phoneticKey('Mohammed')).toBe(phoneticKey('Muhammad'));
  });
});
