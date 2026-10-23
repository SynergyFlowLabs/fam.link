import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractYearEnhanced,
  decadeOf,
  buildTimelineEntries,
  compareTimeline,
  hotspotCounts,
  classifyBranches,
  decadesInEntries,
  type TimelineEntry,
  type TimelinePersonRef,
} from "./timeline.ts";

function mkEntry(over: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: over.id ?? "event:x",
    sourceId: over.sourceId ?? "x",
    personId: over.personId ?? "p",
    kind: over.kind ?? "event",
    eventKind: over.eventKind,
    title: over.title ?? "",
    body: over.body ?? "",
    dateText: over.dateText ?? null,
    placeText: over.placeText ?? null,
    authorOrSource: over.authorOrSource ?? null,
    year: over.year ?? null,
    decade: over.decade ?? "Unknown",
    createdAtMs: over.createdAtMs ?? 0,
  };
}

const PERSON: TimelinePersonRef = { id: "p1", firstName: "A", lastName: null, living: false };

describe("timeline fuzzy sort", () => {
  it("extractYearEnhanced handles c. 1947, before Partition, Eid 1994", () => {
    assert.equal(extractYearEnhanced("c. 1947"), 1947);
    assert.equal(extractYearEnhanced("before Partition"), 1946);
    assert.equal(extractYearEnhanced("Partition"), 1947);
    assert.equal(extractYearEnhanced("after Partition"), 1948);
    assert.equal(extractYearEnhanced("Eid 1994"), 1994);
    assert.equal(extractYearEnhanced("before 1947"), 1946);
    assert.equal(extractYearEnhanced(null), null);
  });

  it("decadeOf Unknown and numeric", () => {
    assert.equal(decadeOf(1947), "1940s");
    assert.equal(decadeOf(2004), "2000s");
    assert.equal(decadeOf(null), "Unknown");
  });

  it("buildTimeline merges and sorts by year then kind", () => {
    const personsById = new Map([["p1", PERSON]]);
    const memories = [
      { id: "m1", personId: "p1", body: "story", occurredText: "2004", authorName: null, createdAt: new Date("2004-06-01") },
      { id: "m2", personId: "p1", body: "old", occurredText: null, authorName: null, createdAt: new Date("2020-01-01") },
    ];
    const events = [
      { id: "e1", personId: "p1", kind: "birth", dateText: "1918", placeText: null, note: null, source: null, createdAt: new Date("1918-01-01") },
      { id: "e2", personId: "p1", kind: "death", dateText: "2004", placeText: null, note: null, source: null, createdAt: new Date("2004-12-01") },
    ];
    const entries = buildTimelineEntries(memories, events, personsById);
    assert.equal(entries.length, 4);
    assert.equal(entries[0].sourceId, "e1"); // 1918 birth first
    // Same year 2004: life events (death) sort before memories
    assert.equal(entries[1].sourceId, "e2");
    assert.equal(entries[2].sourceId, "m1");
    assert.equal(entries[3].sourceId, "m2"); // unknown year last
  });

  it("compareTimeline: 'before Partition' sorts before 1947", () => {
    const a = mkEntry({ year: 1946, dateText: "before Partition" });
    const b = mkEntry({ year: 1947, dateText: "1947" });
    assert.ok(compareTimeline(a, b) < 0);
    assert.ok(compareTimeline(b, a) > 0);
  });

  it("hotspot counts per branch", () => {
    const paternal = new Set(["p1", "p2"]);
    const maternal = new Set(["m1"]);
    const entries = [
      mkEntry({ personId: "p1" }),
      mkEntry({ personId: "p1" }),
      mkEntry({ personId: "m1" }),
      mkEntry({ personId: "other" }),
    ];
    const counts = hotspotCounts(entries, { paternal, maternal });
    assert.equal(counts.paternal, 2);
    assert.equal(counts.maternal, 1);
    assert.equal(counts.other, 1);
    assert.equal(counts.total, 4);
  });

  it("classifyBranches paternal/maternal heuristic", () => {
    const persons = [
      { id: "focus", gender: null },
      { id: "dad", gender: "m" as const },
      { id: "mom", gender: "f" as const },
      { id: "grandpa", gender: "m" as const },
    ];
    const unions = [
      { id: "u1", partnerAId: "dad", partnerBId: "mom" },
      { id: "u2", partnerAId: "grandpa", partnerBId: null },
    ];
    const links = [
      { unionId: "u1", childId: "focus" },
      { unionId: "u2", childId: "dad" },
    ];
    const { paternal, maternal } = classifyBranches(persons, unions, links, "focus");
    // paternal side = dad's branch (dad + grandpa; spouses included per branch-scope);
    // maternal = mom's own branch root
    assert.ok(paternal.has("dad"));
    assert.ok(paternal.has("grandpa"));
    assert.ok(maternal.has("mom"));
  });

  it("decadesInEntries sorted, Unknown last", () => {
    const entries = [mkEntry({ decade: "2000s" }), mkEntry({ decade: "1940s" }), mkEntry({ decade: "Unknown" })];
    assert.deepEqual(decadesInEntries(entries), ["1940s", "2000s", "Unknown"]);
  });
});
