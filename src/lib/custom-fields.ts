/**
 * Custom field definitions & values — pure helpers.
 *
 * Each tree can define named slots (e.g. "Occupation", "Military service")
 * with a kind: text | number | date | select. Values are stored per person
 * (and optionally per memory) as text, validated per kind.
 */

export type FieldKind = "text" | "number" | "date" | "select";

export const FIELD_KINDS: readonly FieldKind[] = ["text", "number", "date", "select"] as const;

export const MAX_FIELD_NAME = 40;
export const MAX_SELECT_OPTIONS = 20;
export const MAX_SELECT_OPTION_LEN = 30;
export const MAX_TEXT_VALUE = 500;

export function isFieldKind(v: string): v is FieldKind {
  return (FIELD_KINDS as readonly string[]).includes(v);
}

export function normalizeFieldName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(/\s+/g, " ");
  if (t.length === 0) return null;
  if (t.length > MAX_FIELD_NAME) return t.slice(0, MAX_FIELD_NAME).trim();
  return t;
}

export function isValidFieldName(raw: string): boolean {
  const n = normalizeFieldName(raw);
  if (!n) return false;
  if (/[\u0000-\u001f\u007f]/.test(n)) return false;
  return true;
}

export function parseSelectOptions(raw: string | null | undefined): string[] | null {
  if (raw == null || String(raw).trim() === "") return null;
  // Accept either JSON array string (from DB) or comma/newline separated user input
  const s = String(raw).trim();
  // Try JSON first
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter((x) => x.length > 0);
    }
  } catch {
    // not JSON — fall through to split
  }
  return s
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export function validateFieldDef(input: {
  name: string;
  kind: string;
  optionsRaw?: string | null;
}): { ok: true; name: string; kind: FieldKind; options: string[] | null } | { ok: false; error: string } {
  const name = normalizeFieldName(input.name);
  if (!name) return { ok: false, error: "Give the field a name." };
  if (!isFieldKind(input.kind)) return { ok: false, error: "Pick a field type: text, number, date or select." };
  const kind = input.kind as FieldKind;

  let options: string[] | null = null;
  if (kind === "select") {
    const parsed = parseSelectOptions(input.optionsRaw ?? "");
    if (!parsed || parsed.length === 0) {
      return { ok: false, error: "Select fields need at least one option (comma or newline separated)." };
    }
    if (parsed.length > MAX_SELECT_OPTIONS) {
      return { ok: false, error: `At most ${MAX_SELECT_OPTIONS} options.` };
    }
    const seen = new Set<string>();
    for (const o of parsed) {
      if (o.length > MAX_SELECT_OPTION_LEN) {
        return { ok: false, error: `Option "${o.slice(0, 20)}…" is too long (max ${MAX_SELECT_OPTION_LEN}).` };
      }
      const k = o.toLowerCase();
      if (seen.has(k)) return { ok: false, error: `Duplicate option "${o}".` };
      seen.add(k);
    }
    options = parsed;
  } else {
    if (input.optionsRaw && String(input.optionsRaw).trim() !== "") {
      return { ok: false, error: "Only select fields have options." };
    }
  }
  return { ok: true, name, kind, options };
}

export function validateFieldValue(
  kind: FieldKind,
  raw: string,
  selectOptions?: string[] | null,
): { ok: true; normalized: string } | { ok: false; error: string } {
  const value = String(raw).trim();
  if (value.length === 0) return { ok: false, error: "Value can't be empty." };
  if (value.length > MAX_TEXT_VALUE) return { ok: false, error: `Keep it under ${MAX_TEXT_VALUE} characters.` };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: "Value contains invalid characters." };

  if (kind === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, error: "Enter a number." };
    return { ok: true, normalized: String(n) };
  }
  if (kind === "select") {
    const opts = selectOptions ?? [];
    const lower = value.toLowerCase();
    const match = opts.find((o) => o.toLowerCase() === lower);
    if (!match) return { ok: false, error: `Pick one of: ${opts.join(", ")}` };
    return { ok: true, normalized: match };
  }
  // text and date: fuzzy text, same philosophy — accept any readable string
  return { ok: true, normalized: value };
}

/** For filtering: does a person's field value match a filter text (case-insensitive contains)? */
export function matchesFieldFilter(
  values: Map<string, string>, // field name key (lowercase) -> value
  filterField: string | null,
  filterQuery: string | null,
): boolean {
  if (!filterField) return true;
  if (!filterQuery || filterQuery.trim() === "") {
    // filtering by field existence: person has any value for that field
    return values.has(filterField.toLowerCase());
  }
  const v = values.get(filterField.toLowerCase());
  if (!v) return false;
  return v.toLowerCase().includes(filterQuery.trim().toLowerCase());
}

/** Parse optionsJson from DB → string[] or null */
export function parseStoredOptions(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr.map((x) => String(x));
    return null;
  } catch {
    return null;
  }
}
