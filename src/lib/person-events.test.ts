import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_KINDS,
  compareEvents,
  extractYear,
  normalizeKind,
  sortEvents,
  validateDateText,
  validateNote,
  validatePlaceText,
  validateSource,
} from "./person-events.ts";

describe("person-events", () => {
  it("normalizeKind trims and lowercases", () => {
    assert.equal(normalizeKind("Birth"), "birth");
    assert.equal(normalizeKind("  MARRIAGE "), "marriage");
    assert.equal(normalizeKind("custom"), "custom");
    assert.equal(normalizeKind("unknown"), null);
    assert.equal(normalizeKind(""), null);
  });

  it("validateDateText respects limits", () => {
    assert.equal(validateDateText(null), null);
    assert.equal(validateDateText(""), null);
    assert.equal(validateDateText("c. 1947"), null);
    assert.equal(validateDateText("x".repeat(200)), null);
    assert.ok(validateDateText("x".repeat(201))!.includes("200"));
  });

  it("validatePlaceText respects limits", () => {
    assert.equal(validatePlaceText("Lahore"), null);
    assert.ok(validatePlaceText("x".repeat(201))!.includes("200"));
  });

  it("validateNote and Source limits", () => {
    assert.equal(validateNote("hello"), null);
    assert.ok(validateNote("x".repeat(2001))!.includes("2000"));
    assert.equal(validateSource("Interview Oct 2026"), null);
    assert.ok(validateSource("x".repeat(501))!.includes("500"));
  });

  it("extractYear finds first plausible year", () => {
    assert.equal(extractYear("c. 1947"), 1947);
    assert.equal(extractYear("before Partition"), null);
    assert.equal(extractYear("Eid 1994"), 1994);
    assert.equal(extractYear("Ramadan 1978 (Hijri 1398)"), 1978);
    assert.equal(extractYear(null), null);
    assert.equal(extractYear(""), null);
  });

  it("sortEvents: year first, then kind order, then createdAt", () => {
    const events = [
      { id: "1", personId: "p", kind: "death" as const, dateText: "2004", createdAt: 3 },
      { id: "2", personId: "p", kind: "birth" as const, dateText: "1918", createdAt: 1 },
      { id: "3", personId: "p", kind: "marriage" as const, dateText: "1945", createdAt: 2 },
      { id: "4", personId: "p", kind: "custom" as const, dateText: null, createdAt: 4 },
    ];
    const sorted = sortEvents(events);
    assert.deepEqual(
      sorted.map((e) => e.id),
      ["2", "3", "1", "4"],
    );
  });

  it("compareEvents: unknown year sorts last", () => {
    const a = { id: "a", personId: "p", kind: "birth" as const, dateText: null };
    const b = { id: "b", personId: "p", kind: "birth" as const, dateText: "1900" };
    assert.ok(compareEvents(a, b) > 0);
    assert.ok(compareEvents(b, a) < 0);
  });

  it("EVENT_KINDS contains expected values", () => {
    assert.ok(EVENT_KINDS.includes("birth"));
    assert.ok(EVENT_KINDS.includes("custom"));
    assert.equal(EVENT_KINDS.length, 6);
  });
});
