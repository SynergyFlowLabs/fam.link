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
