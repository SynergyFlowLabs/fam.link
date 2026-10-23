/**
 * fam.link places — pure helpers for geocoded place history & migration paths.
 *
 * Invariant (AGENTS.md): places stay free-form fuzzy text ("Lahore",
 * "Multan, ~1900", "the village near Jalandhar"). Geocodes are ADDITIVE:
 * a separate cache table keyed by normalized place text; lat/lng is never
 * user-entered and never required. A place without a geocode simply has no
 * pin — never an error.
 */

import { extractYearEnhanced } from "./timeline.ts";

/** A life stop for one person, ordered chronologically. */
export interface PlaceStop {
  kind: string; // "birth" | "death" | event kind
  label: string; // display: "Born", "Died", "Marriage"…
  placeText: string;
  placeKey: string; // normalized — the geocode cache key
  dateText: string | null;
  year: number | null;
  order: number; // sort weight within a person's life
  createdAtMs: number; // tiebreaker / fallback order
}

export interface PlaceStopInput {
  kind: string;
  placeText: string | null | undefined;
  dateText?: string | null;
  createdAt?: Date | string | number | null;
}

export interface GeocodeLike {
  lat: number;
  lng: number;
  displayName?: string | null;
}

/** Life-event kind → chronological weight (mirrors person-events KIND_ORDER). */
const STOP_ORDER: Record<string, number> = {
  birth: 0,
  marriage: 1,
  relocation: 2,
  divorce: 3,
  death: 4,
  custom: 5,
};

export function stopLabel(kind: string): string {
  switch (kind) {
    case "birth":
      return "Born";
    case "death":
      return "Died";
    case "marriage":
      return "Married";
    case "divorce":
      return "Divorced";
    case "relocation":
      return "Moved to";
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

/**
 * Normalized dedup key for a place string: lowercase, strip diacritics and
 * punctuation, collapse whitespace. "Lahore," / "lahore" / "Lahore" → one key.
 */
export function normalizePlaceKey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?"'()\[\]~\u2013\u2014-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > 0 ? s : null;
}

/** Collect the distinct normalized place keys in a set of place texts. */
export function collectPlaceKeys(texts: (string | null | undefined)[]): Set<string> {
  const keys = new Set<string>();
  for (const t of texts) {
    const k = normalizePlaceKey(t);
    if (k) keys.add(k);
  }
  return keys;
}

/** Chronological place stops for one person (birth → events → death). */
export function buildPlaceStops(
  kind: "birth" | "death",
  placeText: string | null | undefined,
  dateText: string | null | undefined,
): PlaceStop | null {
  const place = placeText?.trim();
  if (!place) return null;
  const key = normalizePlaceKey(place);
  if (!key) return null;
  const year = extractYearEnhanced(dateText ?? null);
  return {
    kind,
    label: stopLabel(kind),
    placeText: place,
    placeKey: key,
    dateText: dateText ?? null,
    year,
    order: STOP_ORDER[kind] ?? 99,
    createdAtMs: 0,
  };
}

/** From raw person_events rows: place stops for events that have a place. */
export function eventPlaceStops(
  events: {
    kind: string;
    placeText: string | null;
    dateText: string | null;
    createdAt?: Date | string | number | null;
  }[],
): PlaceStop[] {
  const stops: PlaceStop[] = [];
  for (const e of events) {
    const place = e.placeText?.trim();
    if (!place) continue;
    const key = normalizePlaceKey(place);
    if (!key) continue;
    stops.push({
      kind: e.kind,
      label: stopLabel(e.kind),
      placeText: place,
      placeKey: key,
      dateText: e.dateText ?? null,
      year: extractYearEnhanced(e.dateText),
      order: STOP_ORDER[e.kind] ?? 99,
      createdAtMs: e.createdAt ? new Date(e.createdAt).getTime() : 0,
    });
  }
  stops.sort((a, b) => {
    const ay = a.year ?? Number.POSITIVE_INFINITY;
    const by = b.year ?? Number.POSITIVE_INFINITY;
    if (ay !== by) return ay - by;
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAtMs - b.createdAtMs;
  });
  return stops;
}

export interface MigrationPath<ASGEO extends GeocodeLike> {
  personId: string;
  /** Ordered geocoded stops — consecutive pairs are path segments. */
  stops: (PlaceStop & { geo: ASGEO })[];
}

/**
 * Migration path per person: birth → events → death, keeping only stops that
 * geocoded, deduping consecutive repeats (Jalandhar → Lahore stays; three
 * "Lahore" entries collapse to one). Paths with a single geocoded stop are
 * kept (a pin, no line) — caller decides how to render.
 */
export function buildMigrationPaths<ASGEO extends GeocodeLike>(
  personId: string,
  stops: PlaceStop[],
  geocodeOf: (placeKey: string) => ASGEO | null | undefined,
): MigrationPath<ASGEO> | null {
  const geocoded: (PlaceStop & { geo: ASGEO })[] = [];
  for (const s of stops) {
    const geo = geocodeOf(s.placeKey);
    if (!geo) continue;
    const prev = geocoded[geocoded.length - 1];
    if (prev && prev.placeKey === s.placeKey) {
      // same consecutive place — keep the earliest-labeled stop only
      continue;
    }
    geocoded.push({ ...s, geo });
  }
  if (geocoded.length === 0) return null;
  return { personId, stops: geocoded };
}

/** Decade filter: entry matches if its year falls in [from, to] (inclusive decades as years). */
export function inDecadeRange(year: number | null, fromYear: number | null, toYear: number | null): boolean {
  if (fromYear == null && toYear == null) return true;
  if (year == null) return false; // filtered views exclude undated stops
  if (fromYear != null && year < fromYear) return false;
  if (toYear != null && year > toYear) return false;
  return true;
}

/** "1940s" → 1940 */
export function decadeStart(decade: string): number | null {
  const m = decade.match(/^(\d{3})0s$/);
  return m ? parseInt(`${m[1]}0`, 10) : null;
}

/** Parse a Nominatim-style display_name into a shorter friendly label. */
export function shortPlaceLabel(displayName: string | null | undefined, fallback: string): string {
  if (!displayName) return fallback;
  const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ") || fallback;
}
