import { describe, expect, it } from 'vitest';
import { dictionaries } from './i18n.js';

/**
 * Localisation guard.
 *
 * A missing Urdu key does not throw at runtime — it silently falls back to English or, worse, shows
 * a raw key like `tree.find` to a user who cannot read the fallback. These tests make translation
 * drift a build failure instead of a quiet embarrassment.
 */

const en = Object.keys(dictionaries.en).sort();
const ur = Object.keys(dictionaries.ur).sort();

describe('locale dictionaries', () => {
  it('cover exactly the same keys', () => {
    expect(ur).toEqual(en);
  });

  it('have no empty Urdu strings', () => {
    const empty = Object.entries(dictionaries.ur)
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('actually translate rather than copying English through', () => {
    // Every string is currently translated, the brand name included. If a future string is
    // intentionally left in English, add its key to this allowlist rather than deleting the test.
    const intentionallyIdentical: string[] = [];
    const unchanged = en.filter((key) => dictionaries.ur[key] === dictionaries.en[key]);
    expect(unchanged).toEqual(intentionallyIdentical);
  });

  it('use no leftover placeholder keys as values', () => {
    for (const [key, value] of Object.entries(dictionaries.ur)) {
      expect(value, key).not.toMatch(/^[a-z]+\.[a-zA-Z]+$/);
    }
  });
});
