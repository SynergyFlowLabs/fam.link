import type { Person } from './types.js';

/**
 * Name and string helpers used by search, duplicate detection, and the relationship explanation.
 *
 * Transliteration matters here: the same person is routinely "Muhammad"/"Mohammed"/"Mohammad" or
 * "Bilal"/"Billa" across relatives and scripts. Matching on raw equality loses real matches.
 */

const ARABIC_DIACRITICS = /[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]/g;

/** Lowercase, strip diacritics, unify Urdu/Arabic letter variants and collapse whitespace. */
export function normaliseName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ی')
    .replace(/[\u200c\u200d]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Common Latin transliteration equivalences in South Asian names. */
const PHONETIC_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ph/g, 'f'],
  [/[qd]/g, 'k'],
  [/[aeiou]/g, ''],
  [/(.)\1+/g, '$1'],
  [/y/g, 'i'],
  [/z/g, 's'],
  [/kh/g, 'k'],
  [/gh/g, 'g'],
  [/th/g, 't'],
  [/sh/g, 's'],
];

/** A crude but useful phonetic key: "Mohammed" and "Muhammad" collapse to the same key. */
export function phoneticKey(input: string): string {
  let key = normaliseName(input).replace(/\s+/g, '');
  for (const [pattern, replacement] of PHONETIC_RULES) {
    key = key.replace(pattern, replacement);
  }
  return key;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** 0 to 1 similarity across all of a person's names, phonetic-key aware. */
export function nameSimilarity(a: string, b: string): number {
  const left = normaliseName(a);
  const right = normaliseName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (phoneticKey(left) === phoneticKey(right)) return 0.92;
  const distance = levenshtein(left, right);
  const length = Math.max(left.length, right.length);
  return Math.max(0, 1 - distance / length) * 0.85;
}

export function allNames(person: Person): string[] {
  return [person.givenName, person.familyName ?? '', ...person.alternativeNames].filter(Boolean);
}

export function displayName(person: Person): string {
  return [person.givenName, person.familyName].filter(Boolean).join(' ');
}

export function nameSimilarityBetweenPeople(a: Person, b: Person): number {
  let best = 0;
  for (const left of allNames(a)) {
    for (const right of allNames(b)) {
      best = Math.max(best, nameSimilarity(left, right));
    }
  }
  return best;
}

/** Join words into a readable list: "A", "A and B", "A, B and C". */
export function listPhrase(items: readonly string[], conjunction = 'and'): string {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0]!;
  return `${filtered.slice(0, -1).join(', ')} ${conjunction} ${filtered[filtered.length - 1]}`;
}

export function slugify(input: string): string {
  return normaliseName(input).replace(/\s+/g, '-');
}
