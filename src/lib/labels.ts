/**
 * Labels — pure helpers for the lightweight classification system.
 *
 * Labels are tree-scoped names (e.g. "Immigrant", "Veteran") that can be
 * attached to people and memories. The definition lives in `label_defs`;
 * attachments are junction rows. This module is pure so it is unit tested
 * without DB.
 */

export const LABEL_COLORS = [
  "#2f5d50", // evergreen
  "#b98a2f", // gold
  "#96574f", // rosewood
  "#5b7a99", // slate blue
  "#7a6a4a", // olive
  "#6b5b8a", // muted purple
  "#4a8a7a", // teal
  "#8a5a3a", // burnt sienna
] as const;

export const MAX_LABEL_NAME = 40;

/** Normalise a label name as the user typed it → trimmed, or null if empty. */
export function normalizeLabelName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(/\s+/g, " ");
  if (t.length === 0) return null;
  if (t.length > MAX_LABEL_NAME) return t.slice(0, MAX_LABEL_NAME).trim();
  return t;
}

/** Whether a label name is acceptable (same as normalize returning non-null + extra checks). */
export function isValidLabelName(raw: string): boolean {
  const n = normalizeLabelName(raw);
  if (!n) return false;
  if (n.length < 1 || n.length > MAX_LABEL_NAME) return false;
  // allow any visible unicode except control chars, but keep it simple
  if (/[\u0000-\u001f\u007f]/.test(n)) return false;
  return true;
}

/** Deterministic color for a label name (when no explicit color is stored). */
export function labelColorFor(name: string, explicit?: string | null): string {
  if (explicit && /^#[0-9a-fA-F]{6}$/.test(explicit)) return explicit;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return LABEL_COLORS[hash % LABEL_COLORS.length];
}

/** Case-insensitive key for uniqueness within a tree. */
export function labelKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Filter helper: does a person/memory's label set contain a given label name?
 * `labels` are the resolved label names attached to that entity.
 */
export function hasLabel(labels: string[], wanted: string): boolean {
  const k = labelKey(wanted);
  return labels.some((l) => labelKey(l) === k);
}

/**
 * Filter helper: person matches label filter (null = no filter, "" = unlabeled only).
 * Returns true if:
 * - filter is null → always true (no filter)
 * - filter === "__unlabeled" → person has no labels
 * - otherwise → person has that label
 */
export function matchesLabelFilter(
  personLabels: string[],
  filter: string | null,
): boolean {
  if (filter == null) return true;
  if (filter === "__unlabeled") return personLabels.length === 0;
  return hasLabel(personLabels, filter);
}
