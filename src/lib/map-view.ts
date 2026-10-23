/**
 * Map view assembly — server-side row → MapPath shaping shared by the app
 * and share map pages. Pure over plain row shapes, so it stays testable
 * without React or db.
 */

import { displayName } from "./canvas-types.ts";
import {
  buildMigrationPaths,
  buildPlaceStops,
  eventPlaceStops,
  type GeocodeLike,
  type PlaceStop,
} from "./places.ts";
import { decadeOf } from "./timeline.ts";

export interface MapPersonRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  living: boolean;
  birthPlace: string | null;
  birthDateText: string | null;
  deathPlace: string | null;
  deathDateText: string | null;
}

export interface MapEventRow {
  personId: string;
  kind: string;
  placeText: string | null;
  dateText: string | null;
  createdAt?: Date | string | number | null;
}

export interface MapStopView {
  lat: number;
  lng: number;
  kind: string;
  label: string;
  placeText: string;
  displayName: string | null;
  dateText: string | null;
  year: number | null;
}

export interface MapPathView {
  personId: string;
  personName: string;
  branch: "paternal" | "maternal" | "other";
  stops: MapStopView[];
}

/**
 * One migration path per person whose stops geocoded. Stops are ordered
 * birth → events (by fuzzy year) → death; only geocoded stops survive;
 * consecutive duplicate places collapse (buildMigrationPaths).
 */
export function buildMapPaths(
  personRows: MapPersonRow[],
  eventRows: MapEventRow[],
  geocodeByKey: Map<string, GeocodeLike>,
  branchSets: { paternal: Set<string>; maternal: Set<string> },
): MapPathView[] {
  const eventsByPerson = new Map<string, MapEventRow[]>();
  for (const e of eventRows) {
    const arr = eventsByPerson.get(e.personId) ?? [];
    arr.push(e);
    eventsByPerson.set(e.personId, arr);
  }
  const paths: MapPathView[] = [];
  for (const p of personRows) {
    const stops: PlaceStop[] = [];
    const birth = buildPlaceStops("birth", p.birthPlace, p.birthDateText);
    if (birth) stops.push(birth);
    stops.push(...eventPlaceStops(eventsByPerson.get(p.id) ?? []));
    const death = buildPlaceStops("death", p.deathPlace, p.deathDateText);
    if (death) stops.push(...[death]);
    // restore life order: birth first, death last, events between by year
    stops.sort((a, b) => {
      if (a.kind === "birth") return -1;
      if (b.kind === "birth") return 1;
      if (a.kind === "death") return 1;
      if (b.kind === "death") return -1;
      const ay = a.year ?? Number.POSITIVE_INFINITY;
      const by = b.year ?? Number.POSITIVE_INFINITY;
      if (ay !== by) return ay - by;
      return a.createdAtMs - b.createdAtMs;
    });
    const path = buildMigrationPaths(p.id, stops, (k) => geocodeByKey.get(k) ?? null);
    if (!path) continue;
    const branch = branchSets.paternal.has(p.id)
      ? "paternal"
      : branchSets.maternal.has(p.id)
        ? "maternal"
        : "other";
    paths.push({
      personId: p.id,
      personName: displayName(p),
      branch,
      stops: path.stops.map((s) => ({
        lat: s.geo.lat,
        lng: s.geo.lng,
        kind: s.kind,
        label: s.label,
        placeText: s.placeText,
        displayName: (s.geo as { displayName?: string | null }).displayName ?? null,
        dateText: s.dateText,
        year: s.year,
      })),
    });
  }
  return paths;
}

/** Decade labels present in a set of paths, sorted ascending. */
export function mapDecades(paths: MapPathView[]): string[] {
  const set = new Set<string>();
  for (const p of paths) for (const s of p.stops) set.add(decadeOf(s.year));
  const arr = [...set];
  arr.sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return parseInt(a, 10) - parseInt(b, 10);
  });
  return arr;
}
