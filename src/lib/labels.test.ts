import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLabelName,
  isValidLabelName,
  labelColorFor,
  labelKey,
  hasLabel,
  matchesLabelFilter,
  LABEL_COLORS,
} from "./labels.ts";

describe("normalizeLabelName", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normalizeLabelName("  Immigrant  "), "Immigrant");
    assert.equal(normalizeLabelName("Primary  caregiver"), "Primary caregiver");
    assert.equal(normalizeLabelName(""), null);
    assert.equal(normalizeLabelName("   "), null);
  });
  it("caps at 40 chars", () => {
    const long = "a".repeat(50);
    assert.equal(normalizeLabelName(long)?.length, 40);
  });
});

describe("isValidLabelName", () => {
  it("accepts normal names", () => {
    assert.equal(isValidLabelName("Immigrant"), true);
    assert.equal(isValidLabelName("Veteran"), true);
    assert.equal(isValidLabelName("Family historian"), true);
  });
  it("rejects empty and control chars", () => {
    assert.equal(isValidLabelName(""), false);
    assert.equal(isValidLabelName("   "), false);
    assert.equal(isValidLabelName("hello\u0000"), false);
  });
});

describe("labelColorFor", () => {
  it("is deterministic for same name", () => {
    assert.equal(labelColorFor("Immigrant"), labelColorFor("Immigrant"));
  });
  it("returns explicit color when valid", () => {
    assert.equal(labelColorFor("Veteran", "#ff0000"), "#ff0000");
  });
  it("ignores invalid explicit color", () => {
    const c = labelColorFor("Veteran", "not-a-color");
    assert.ok(LABEL_COLORS.includes(c as never));
  });
  it("falls back to palette", () => {
    const c = labelColorFor("Unknown");
    assert.ok(LABEL_COLORS.includes(c as never));
  });
});

describe("labelKey", () => {
  it("lowercases and trims", () => {
    assert.equal(labelKey("Immigrant"), "immigrant");
    assert.equal(labelKey("  VETERAN "), "veteran");
  });
});

describe("hasLabel", () => {
  it("case-insensitive match", () => {
    assert.equal(hasLabel(["Immigrant", "Veteran"], "immigrant"), true);
    assert.equal(hasLabel(["Immigrant"], "Veteran"), false);
  });
});

describe("matchesLabelFilter", () => {
  it("null filter matches all", () => {
    assert.equal(matchesLabelFilter(["Immigrant"], null), true);
    assert.equal(matchesLabelFilter([], null), true);
  });
  it("unlabeled filter", () => {
    assert.equal(matchesLabelFilter([], "__unlabeled"), true);
    assert.equal(matchesLabelFilter(["Immigrant"], "__unlabeled"), false);
  });
  it("specific label filter", () => {
    assert.equal(matchesLabelFilter(["Immigrant", "Veteran"], "Veteran"), true);
    assert.equal(matchesLabelFilter(["Immigrant"], "Veteran"), false);
  });
});
