import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {

  normalizeFieldName,
  isValidFieldName,
  parseSelectOptions,
  validateFieldDef,
  validateFieldValue,
  matchesFieldFilter,
  parseStoredOptions,
  FIELD_KINDS,
  filterDefsForViewer,
  canSeeField,
  isFieldVisibility,
} from "./custom-fields.ts";

describe("normalizeFieldName", () => {
  it("trims and caps", () => {
    assert.equal(normalizeFieldName("  Occupation  "), "Occupation");
    assert.equal(normalizeFieldName(""), null);
    assert.equal(normalizeFieldName("a".repeat(50))?.length, 40);
  });
});

describe("isValidFieldName", () => {
  it("accepts normal", () => {
    assert.equal(isValidFieldName("Occupation"), true);
    assert.equal(isValidFieldName("Military service"), true);
  });
  it("rejects empty", () => {
    assert.equal(isValidFieldName(""), false);
    assert.equal(isValidFieldName("   "), false);
  });
});

describe("parseSelectOptions", () => {
  it("parses comma separated", () => {
    assert.deepEqual(parseSelectOptions("Army, Navy, Air Force"), ["Army", "Navy", "Air Force"]);
  });
  it("parses newline separated", () => {
    assert.deepEqual(parseSelectOptions("Army\nNavy\nAir Force"), ["Army", "Navy", "Air Force"]);
  });
  it("parses JSON array", () => {
    assert.deepEqual(parseSelectOptions('["Army","Navy"]'), ["Army", "Navy"]);
  });
  it("returns null for empty", () => {
    assert.equal(parseSelectOptions(""), null);
    assert.equal(parseSelectOptions(null), null);
  });
});

describe("validateFieldDef", () => {
  it("valid text field", () => {
    const r = validateFieldDef({ name: "Occupation", kind: "text", optionsRaw: "" });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.name, "Occupation");
      assert.equal(r.kind, "text");
    }
  });
  it("valid select field", () => {
    const r = validateFieldDef({ name: "Branch", kind: "select", optionsRaw: "Army, Navy" });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.options, ["Army", "Navy"]);
  });
  it("select needs options", () => {
    const r = validateFieldDef({ name: "Branch", kind: "select", optionsRaw: "" });
    assert.equal(r.ok, false);
  });
  it("text should not have options", () => {
    const r = validateFieldDef({ name: "Occupation", kind: "text", optionsRaw: "Army" });
    assert.equal(r.ok, false);
  });
  it("unknown kind fails", () => {
    const r = validateFieldDef({ name: "X", kind: "unknown", optionsRaw: "" });
    assert.equal(r.ok, false);
  });
  it("duplicate options rejected", () => {
    const r = validateFieldDef({ name: "X", kind: "select", optionsRaw: "Army, army" });
    assert.equal(r.ok, false);
  });
});

describe("validateFieldValue", () => {
  it("text passes", () => {
    const r = validateFieldValue("text", "Farmer", null);
    assert.equal(r.ok, true);
  });
  it("number validates", () => {
    assert.equal(validateFieldValue("number", "1947", null).ok, true);
    assert.equal(validateFieldValue("number", "not-a-number", null).ok, false);
    assert.equal(validateFieldValue("number", "", null).ok, false);
  });
  it("select validates against options", () => {
    assert.equal(validateFieldValue("select", "Army", ["Army", "Navy"]).ok, true);
    assert.equal(validateFieldValue("select", "army", ["Army", "Navy"]).ok, true); // case-insensitive
    assert.equal(validateFieldValue("select", "Air Force", ["Army", "Navy"]).ok, false);
  });
  it("date is fuzzy text", () => {
    assert.equal(validateFieldValue("date", "c. 1947", null).ok, true);
    assert.equal(validateFieldValue("date", "before Partition", null).ok, true);
  });
});

describe("matchesFieldFilter", () => {
  it("no filter matches all", () => {
    const m = new Map([["occupation", "Farmer"]]);
    assert.equal(matchesFieldFilter(m, null, null), true);
  });
  it("field existence filter", () => {
    const m = new Map([["occupation", "Farmer"]]);
    assert.equal(matchesFieldFilter(m, "occupation", null), true);
    assert.equal(matchesFieldFilter(m, "branch", null), false);
    assert.equal(matchesFieldFilter(new Map(), "occupation", null), false);
  });
  it("value contains filter", () => {
    const m = new Map([["occupation", "Farmer"]]);
    assert.equal(matchesFieldFilter(m, "occupation", "farm"), true);
    assert.equal(matchesFieldFilter(m, "occupation", "teacher"), false);
    assert.equal(matchesFieldFilter(m, "occupation", "FARM"), true);
  });
});

describe("parseStoredOptions", () => {
  it("parses JSON", () => {
    assert.deepEqual(parseStoredOptions('["a","b"]'), ["a", "b"]);
  });
  it("null for empty", () => {
    assert.equal(parseStoredOptions(null), null);
    assert.equal(parseStoredOptions(""), null);
  });
  it("FIELD_KINDS includes expected", () => {
    assert.ok(FIELD_KINDS.includes("text"));
    assert.ok(FIELD_KINDS.includes("select"));
  });

  it("visibility: private fields are owner-only everywhere", () => {
    const defs = [
      { id: "f1", visibility: "shared" as const },
      { id: "f2", visibility: "private" as const },
      { id: "f3" }, // legacy row — defaults to shared
    ];
    assert.deepEqual(filterDefsForViewer(defs, true).map((d) => d.id), ["f1", "f2", "f3"]);
    assert.deepEqual(filterDefsForViewer(defs, false).map((d) => d.id), ["f1", "f3"]);
    assert.ok(canSeeField("private", true));
    assert.equal(canSeeField("private", false), false);
    assert.ok(canSeeField("shared", false));
    assert.ok(canSeeField(null, false)); // legacy → shared
    assert.ok(isFieldVisibility("private"));
    assert.equal(isFieldVisibility("secret"), false);
  });
});
