import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlaceStops,
  buildMigrationPaths,
  collectPlaceKeys,
  decadeStart,
  eventPlaceStops,
  inDecadeRange,
  normalizePlaceKey,
  shortPlaceLabel,
  type GeocodeLike,
} from "./places.ts";

describe("places", () => {
  it("normalizePlaceKey dedupes punctuation, case, diacritics", () => {
    assert.equal(normalizePlaceKey("Lahore,"), normalizePlaceKey("lahore"));
    assert.equal(normalizePlaceKey("  Multan, ~1900 "), "multan 1900");
    assert.equal(normalizePlaceKey("São Paulo"), "sao paulo");
    assert.equal(normalizePlaceKey(null), null);
    assert.equal(normalizePlaceKey("   "), null);
  });

  it("collectPlaceKeys returns distinct keys", () => {
    const keys = collectPlaceKeys(["Lahore", "lahore,", null, "", "Jalandhar"]);
    assert.deepEqual([...keys].sort(), ["jalandhar", "lahore"]);
  });

  it("buildPlaceStops skips empty places, parses years", () => {
    const s = buildPlaceStops("birth", "Jalandhar, Punjab", "c. 1930");
    assert.ok(s);
    assert.equal(s!.placeKey, "jalandhar punjab");
    assert.equal(s!.year, 1930);
    assert.equal(s!.label, "Born");
    assert.equal(buildPlaceStops("death", "  ", "2001"), null);
  });

  it("eventPlaceStops ordered by year then kind", () => {
    const stops = eventPlaceStops([
      { kind: "relocation", placeText: "Lahore", dateText: "1947", createdAt: 1 },
      { kind: "marriage", placeText: "Jalandhar", dateText: "1946", createdAt: 2 },
      { kind: "custom", placeText: null, dateText: "1950", createdAt: 3 },
    ]);
    assert.equal(stops.length, 2);
    assert.equal(stops[0].placeKey, "jalandhar");
    assert.equal(stops[1].placeKey, "lahore");
  });

  it("buildMigrationPaths keeps only geocoded, dedupes consecutive repeats", () => {
    const geos: Record<string, GeocodeLike> = {
      jalandhar: { lat: 31.33, lng: 75.58 },
      lahore: { lat: 31.55, lng: 74.34 },
    };
    const stops = [
      buildPlaceStops("birth", "Jalandhar", "1930")!,
      eventPlaceStops([{ kind: "relocation", placeText: "Lahore", dateText: "1947" }])[0],
      eventPlaceStops([{ kind: "custom", placeText: "Lahore", dateText: "1950" }])[0],
      buildPlaceStops("death", "Karachi", "2001")!, // not geocoded → dropped
    ];
    const path = buildMigrationPaths("p1", stops, (k) => geos[k] ?? null);
    assert.ok(path);
    assert.equal(path!.stops.length, 2); // jalandhar + lahore (second lahore deduped, karachi dropped)
    assert.equal(path!.stops[0].placeKey, "jalandhar");
    assert.equal(path!.stops[1].placeKey, "lahore");
  });

  it("buildMigrationPaths returns null when nothing geocoded", () => {
    const stops = [buildPlaceStops("birth", "Nowhere", null)!];
    assert.equal(buildMigrationPaths("p1", stops, () => null), null);
  });

  it("inDecadeRange filters", () => {
    assert.ok(inDecadeRange(1947, 1940, 1949));
    assert.ok(!inDecadeRange(1951, 1940, 1949));
    assert.ok(!inDecadeRange(null, 1940, null));
    assert.ok(inDecadeRange(1947, null, null));
  });

  it("decadeStart and shortPlaceLabel", () => {
    assert.equal(decadeStart("1940s"), 1940);
    assert.equal(decadeStart("Unknown"), null);
    assert.equal(shortPlaceLabel("Punjab, Pakistan, Asia", "x"), "Punjab, Pakistan");
    assert.equal(shortPlaceLabel(null, "Lahore"), "Lahore");
  });
});
