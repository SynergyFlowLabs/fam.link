import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  displayNameOf,
  parsePersonFields,
  parseSuggestionPayload,
} from "./person-fields.ts";

function formOf(entries: Record<string, unknown>) {
  return { get: (name: string) => entries[name] };
}

describe("parsePersonFields", () => {
  it("collects and trims text fields", () => {
    const f = parsePersonFields(
      formOf({
        firstName: "  Fatimah ",
        lastName: "bint Muhammad",
        birthDateText: "c. 605",
        birthPlace: "Mecca",
      }),
    );
    assert.equal(f.firstName, "Fatimah");
    assert.equal(f.lastName, "bint Muhammad");
    assert.equal(f.birthDateText, "c. 605");
    assert.equal(f.notes, null);
    assert.equal(f.living, false);
  });

  it("normalises the living checkbox in all its form shapes", () => {
    for (const v of ["on", "true", true]) {
      assert.equal(parsePersonFields(formOf({ living: v })).living, true);
    }
    assert.equal(parsePersonFields(formOf({ living: "false" })).living, false);
    assert.equal(parsePersonFields(formOf({})).living, false);
  });

  it("accepts only known genders", () => {
    assert.equal(parsePersonFields(formOf({ gender: "f" })).gender, "f");
    assert.equal(parsePersonFields(formOf({ gender: "m" })).gender, "m");
    assert.equal(parsePersonFields(formOf({ gender: "x" })).gender, "x");
    assert.equal(parsePersonFields(formOf({ gender: "F" })).gender, null);
    assert.equal(parsePersonFields(formOf({ gender: "robot" })).gender, null);
  });

  it("a living person never carries death facts", () => {
    const f = parsePersonFields(
      formOf({
        living: "on",
        deathDateText: "1998",
        deathPlace: "Lahore",
      }),
    );
    assert.equal(f.deathDateText, null);
    assert.equal(f.deathPlace, null);
  });

  it("deceased persons keep their death facts", () => {
    const f = parsePersonFields(
      formOf({ deathDateText: "632", deathPlace: "Medina" }),
    );
    assert.equal(f.deathDateText, "632");
    assert.equal(f.deathPlace, "Medina");
  });

  it("fuzzy dates pass through untouched (never parsed or reformatted)", () => {
    const f = parsePersonFields(
      formOf({ birthDateText: "before Partition, c. 1947" }),
    );
    assert.equal(f.birthDateText, "before Partition, c. 1947");
  });
});

describe("parseSuggestionPayload", () => {
  it("round-trips fields parsed from a form", () => {
    const original = parsePersonFields(
      formOf({
        firstName: "Qusayy",
        lastName: "ibn Kilab",
        gender: "m",
        birthDateText: "c. 400",
        deathDateText: "c. 480",
        notes: "Assembled the Quraysh confederacy.",
      }),
    );
    const back = parseSuggestionPayload(JSON.stringify(original));
    assert.deepEqual(back, original);
  });

  it("strips death facts for living suggestions", () => {
    const back = parseSuggestionPayload(
      JSON.stringify({
        firstName: "X",
        living: true,
        deathDateText: "should vanish",
      }),
    );
    assert.equal(back?.deathDateText, null);
  });

  it("returns null for junk", () => {
    assert.equal(parseSuggestionPayload("not json"), null);
    assert.equal(parseSuggestionPayload("42"), null);
    assert.equal(parseSuggestionPayload("null"), null);
    assert.equal(parseSuggestionPayload('{"living":"yes-please"}'), null);
  });

  it("an empty-ish payload is still a valid (blank) edit", () => {
    const back = parseSuggestionPayload("{}");
    assert.equal(back?.living, false);
    assert.equal(back?.firstName, null);
  });
});

describe("displayNameOf", () => {
  it("joins names, falls back to Someone", () => {
    assert.equal(
      displayNameOf({ firstName: "Ali", lastName: "ibn Abi Talib" }),
      "Ali ibn Abi Talib",
    );
    assert.equal(displayNameOf({ firstName: null, lastName: null }), "Someone");
    assert.equal(displayNameOf({ firstName: "Zoya", lastName: null }), "Zoya");
  });
});
