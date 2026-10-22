/** Shapes passed from server pages to the client canvas. */

export interface CanvasPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  alsoKnownAs: string | null;
  gender: "m" | "f" | "x" | null;
  living: boolean;
  birthDateText: string | null;
  birthPlace: string | null;
  deathDateText: string | null;
  deathPlace: string | null;
  memoryCount: number;
  /** True when details are hidden for a living person on a public share view. */
  redacted?: boolean;
}

export interface CanvasUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
  status: "married" | "partners" | "divorced" | "separated" | "widowed" | null;
}

export interface CanvasLink {
  unionId: string;
  childId: string;
}

export function displayName(p: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : "Unknown";
}

export function lifeLine(p: {
  living: boolean;
  birthDateText: string | null;
  deathDateText: string | null;
}): string {
  if (p.living) {
    return p.birthDateText ? `b. ${p.birthDateText}` : "";
  }
  const birth = p.birthDateText ?? "?";
  const death = p.deathDateText ?? "?";
  return `${birth} – ${death}`;
}

export const REDACTED_NAME = "Living relative";

/**
 * Privacy for public share views: living relatives keep their place in the
 * tree structure but lose names, dates, places, and memory counts. Deceased
 * relatives are shown in full. Returns the same object if not living.
 */
export function redactPerson(p: CanvasPerson): CanvasPerson {
  if (!p.living) return p;
  return {
    ...p,
    firstName: null,
    lastName: null,
    alsoKnownAs: null,
    gender: null,
    birthDateText: null,
    birthPlace: null,
    deathDateText: null,
    deathPlace: null,
    memoryCount: 0,
    redacted: true,
  };
}
