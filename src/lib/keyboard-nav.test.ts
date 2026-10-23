import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stepFocus, siblingsAtGeneration, CANVAS_SHORTCUTS, type NavNode } from "./keyboard-nav.ts";

const NODES: NavNode[] = [
  { id: "gp1", generation: -2 },
  { id: "dad", generation: -1 },
  { id: "mom", generation: -1 },
  { id: "me", generation: 0 },
  { id: "kid", generation: 1 },
];

describe("keyboard-nav", () => {
  it("stepFocus walks forward and backward in engine order", () => {
    assert.equal(stepFocus(NODES, "gp1", 1), "dad");
    assert.equal(stepFocus(NODES, "dad", 1), "mom");
    assert.equal(stepFocus(NODES, "mom", -1), "dad");
  });

  it("stepFocus wraps at both ends", () => {
    assert.equal(stepFocus(NODES, "kid", 1), "gp1");
    assert.equal(stepFocus(NODES, "gp1", -1), "kid");
  });

  it("stepFocus starts at an end when nothing is focused", () => {
    assert.equal(stepFocus(NODES, null, 1), "gp1");
    assert.equal(stepFocus(NODES, null, -1), "kid");
  });

  it("stepFocus is stable on single-node and empty trees", () => {
    const one = [{ id: "only", generation: 0 }];
    assert.equal(stepFocus(one, "only", 1), "only");
    assert.equal(stepFocus(one, "only", -1), "only");
    assert.equal(stepFocus([], null, 1), null);
    assert.equal(stepFocus(NODES, "ghost", 1), "gp1");
  });

  it("siblingsAtGeneration collects same-generation ids", () => {
    assert.deepEqual(siblingsAtGeneration(NODES, -1), ["dad", "mom"]);
    assert.deepEqual(siblingsAtGeneration(NODES, 2), []);
  });

  it("CANVAS_SHORTCUTS covers the full keyboard story", () => {
    const keys = CANVAS_SHORTCUTS.map((s) => s.keys).join(" ");
    for (const expected of ["←", "Enter", "*", "?"]) {
      assert.ok(keys.includes(expected), `missing ${expected}`);
    }
  });
});
