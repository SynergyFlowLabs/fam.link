export const EVENT_KINDS = [
  "birth",
  "death",
  "marriage",
  "divorce",
  "relocation",
  "custom",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface PersonEventInput {
  id: string;
  personId: string;
  kind: EventKind;
  dateText?: string | null;
  placeText?: string | null;
  note?: string | null;
  source?: string | null;
  createdAt?: Date | string | number | null;
}

export function normalizeKind(v: unknown): EventKind | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return (EVENT_KINDS as readonly string[]).includes(s) ? (s as EventKind) : null;
}

export function validateDateText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > 200) return "Date must be 200 characters or fewer.";
  return null;
}

export function validatePlaceText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > 200) return "Place must be 200 characters or fewer.";
  return null;
}

export function validateNote(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > 2000) return "Note must be 2000 characters or fewer.";
  return null;
}

export function validateSource(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > 500) return "Source must be 500 characters or fewer.";
  return null;
}

// Very light fuzzy-date year extraction for sorting only.
// Never used to reject input; null means "unknown / unparseable" and sorts last.
export function extractYear(dateText: string | null | undefined): number | null {
  if (!dateText) return null;
  const s = dateText.trim();
  // Handle "c. 1947", "before 1965", "Eid 1994", "Ramadan 1978 (Hijri 1398)"
  // Just pull the first plausible 3-4 digit year.
  const m = s.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
  if (m) {
    const y = parseInt(m[1], 10);
    if (y >= 500 && y <= 2100) return y;
  }
  return null;
}

const KIND_ORDER: Record<EventKind, number> = {
  birth: 0,
  marriage: 1,
  relocation: 2,
  divorce: 3,
  death: 4,
  custom: 5,
};

export function compareEvents(
  a: PersonEventInput,
  b: PersonEventInput,
): number {
  const ay = extractYear(a.dateText ?? null);
  const by = extractYear(b.dateText ?? null);
  if (ay != null && by != null && ay !== by) return ay - by;
  if (ay != null && by == null) return -1;
  if (ay == null && by != null) return 1;
  const ak = KIND_ORDER[a.kind] ?? 99;
  const bk = KIND_ORDER[b.kind] ?? 99;
  if (ak !== bk) return ak - bk;
  // Fallback: createdAt
  const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ac - bc;
}

export function sortEvents<T extends PersonEventInput>(events: T[]): T[] {
  return [...events].sort(compareEvents);
}
