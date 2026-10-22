import test from "node:test";
import assert from "node:assert/strict";
import {
  displayName,
  lifeLine,
  redactPerson,
  REDACTED_NAME,
  type CanvasPerson,
} from "./canvas-types.ts";

function person(overrides: Partial<CanvasPerson> = {}): CanvasPerson {
  return {
    id: "p1",
    firstName: "Ali",
    lastName: "Raza",
    alsoKnownAs: "Chotu",
    gender: "m",
    living: true,
    birthDateText: "1989",
    birthPlace: "Karachi",
    deathDateText: null,
    deathPlace: null,
    memoryCount: 3,
    ...overrides,
  };
}

test("redactPerson strips every detail from a living person", () => {
  const r = redactPerson(person());
  assert.equal(r.redacted, true);
  assert.equal(r.firstName, null);
  assert.equal(r.lastName, null);
  assert.equal(r.alsoKnownAs, null);
  assert.equal(r.gender, null);
  assert.equal(r.birthDateText, null);
  assert.equal(r.birthPlace, null);
  assert.equal(r.deathDateText, null);
  assert.equal(r.deathPlace, null);
  assert.equal(r.memoryCount, 0);
  // structure survives — id and living flag stay
  assert.equal(r.id, "p1");
  assert.equal(r.living, true);
});

test("redactPerson leaves deceased relatives fully intact", () => {
  const grandma = person({
    living: false,
    deathDateText: "1998",
    deathPlace: "Lahore",
  });
  const r = redactPerson(grandma);
  assert.deepEqual(r, grandma);
  assert.equal(r.redacted, undefined);
});

test("redacted nodes still show a lifeLine", () => {
  const r = redactPerson(person());
  assert.equal(lifeLine(r), "");
});

test("displayName helpers unchanged for normal persons", () => {
  assert.equal(displayName(person()), "Ali Raza");
  assert.equal(
    displayName(person({ firstName: null, lastName: null })),
    "Unknown",
  );
});

test("REDACTED_NAME is stable copy used across canvas and share UI", () => {
  assert.equal(REDACTED_NAME, "Living relative");
});
