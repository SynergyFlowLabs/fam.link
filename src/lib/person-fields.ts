/**
 * Pure parsing/normalisation of the person fact fields shared by every
 * capture path — direct edits (owner/editor), quick-add, and community
 * suggestions on public trees. No DB, no FormData dependency beyond a
 * get()-able source, so it is unit-testable and reusable.
 */

export interface PersonFields {
  firstName: string | null;
  lastName: string | null;
  alsoKnownAs: string | null;
  gender: "m" | "f" | "x" | null;
  living: boolean;
  birthDateText: string | null;
  birthPlace: string | null;
  deathDateText: string | null;
  deathPlace: string | null;
  notes: string | null;
}

type FieldSource = { get(name: string): unknown };

export function parsePersonFields(source: FieldSource): PersonFields {
  const text = (name: string): string | null => {
    const v = String(source.get(name) ?? "").trim();
    return v.length > 0 ? v : null;
  };
  const gender = String(source.get("gender") ?? "");
  const living =
    source.get("living") === "on" ||
    source.get("living") === "true" ||
    source.get("living") === true;
  return {
    firstName: text("firstName"),
    lastName: text("lastName"),
    alsoKnownAs: text("alsoKnownAs"),
    gender:
      gender === "m" || gender === "f" || gender === "x"
        ? (gender as "m" | "f" | "x")
        : null,
    living,
    birthDateText: text("birthDateText"),
    birthPlace: text("birthPlace"),
    // a living person has no death facts
    deathDateText: living ? null : text("deathDateText"),
    deathPlace: living ? null : text("deathPlace"),
    notes: text("notes"),
  };
}

export function displayNameOf(fields: {
  firstName: string | null;
  lastName: string | null;
}): string {
  return (
    [fields.firstName, fields.lastName].filter(Boolean).join(" ") || "Someone"
  );
}

/**
 * Parses a suggestion payload (JSON from the DB) back into PersonFields.
 * Returns null when the shape is wrong — never trusts stored JSON blindly.
 */
export function parseSuggestionPayload(raw: string): PersonFields | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  // `living` must be a real boolean when present — a junk payload is
  // rejected rather than silently reinterpreted as "deceased".
  if ("living" in v && typeof v.living !== "boolean") return null;
  const str = (x: unknown): string | null =>
    typeof x === "string" && x.trim().length > 0 ? x.trim() : null;
  const gender = str(v.gender);
  return {
    firstName: str(v.firstName),
    lastName: str(v.lastName),
    alsoKnownAs: str(v.alsoKnownAs),
    gender:
      gender === "m" || gender === "f" || gender === "x"
        ? (gender as "m" | "f" | "x")
        : null,
    living: v.living === true,
    birthDateText: str(v.birthDateText),
    birthPlace: str(v.birthPlace),
    deathDateText: v.living === true ? null : str(v.deathDateText),
    deathPlace: v.living === true ? null : str(v.deathPlace),
    notes: str(v.notes),
  };
}
