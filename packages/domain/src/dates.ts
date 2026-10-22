import type { FamilyDate } from './types.js';

/**
 * Partial and uncertain dates.
 *
 * A family historian may know only a year, or a year "about 1932". We store an ISO string plus a
 * precision so that the UI can render "1932", "about 1932" or "12 March 1932" without ever
 * inventing precision the family does not have.
 */

export function familyDate(value: string, precision: FamilyDate['precision'] = 'exact'): FamilyDate {
  return { value: normaliseDateInput(value, precision), precision };
}

/** Accepts "1932", "1932-03", "1932-03-12" and pads to a valid ISO date. */
export function normaliseDateInput(value: string, precision: FamilyDate['precision']): string {
  const trimmed = value.trim();
  if (precision === 'unknown') return '';
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  throw new Error(`Unsupported date input: "${value}"`);
}

/** Calendar year of a date, or undefined when we do not know it. */
export function yearOf(date: FamilyDate | undefined): number | undefined {
  if (!date || !date.value) return undefined;
  const year = Number(date.value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

/** Rough age in years at a reference date, honouring precision. */
export function ageInYears(
  birthDate: FamilyDate | undefined,
  reference: Date = new Date(),
  deathDate?: FamilyDate,
): number | undefined {
  const birthYear = yearOf(birthDate);
  if (birthYear === undefined) return undefined;
  const deathYear = yearOf(deathDate);
  const endYear = deathYear ?? reference.getUTCFullYear();
  return Math.max(0, endYear - birthYear);
}

export function isMinorStatus(
  birthDate: FamilyDate | undefined,
  livingStatus: string,
  reference: Date = new Date(),
): boolean {
  if (livingStatus !== 'living') return false;
  const age = ageInYears(birthDate, reference);
  return age !== undefined && age < 18;
}

/** Human formatting that is honest about precision. Locale-aware prefixes live in the i18n layer. */
export function formatFamilyDate(date: FamilyDate | undefined, approximatePrefix = 'about'): string {
  if (!date || !date.value) return '';
  const [year, month, day] = date.value.split('-');
  const prefix = date.precision === 'approximate' ? `${approximatePrefix} ` : '';
  switch (date.precision) {
    case 'exact':
      return `${prefix}${day}/${month}/${year}`;
    case 'month':
      return `${prefix}${month}/${year}`;
    case 'year':
    case 'approximate':
      return `${prefix}${year}`;
    default:
      return '';
  }
}

/** "1952–2019", "b. 1952", or "" — used in tree nodes and profile headers. */
export function lifeSpan(person: {
  birthDate?: FamilyDate;
  deathDate?: FamilyDate;
  livingStatus: string;
}): string {
  const birth = yearOf(person.birthDate);
  const death = yearOf(person.deathDate);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return '';
}

export function dateSortValue(date: FamilyDate | undefined): number {
  if (!date || !date.value) return Number.MAX_SAFE_INTEGER;
  const time = Date.parse(date.value);
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}
