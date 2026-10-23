import test from "node:test";
import assert from "node:assert/strict";
import { coupleEdgeD, parentChildEdgeD, relationLabel, relationStrokeProps } from "./edges.ts";

test("coupleEdgeD straight when same row", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 200, y: 0 };
  const d = coupleEdgeD(a, b, 172);
  assert.ok(d.startsWith("M"));
  assert.ok(d.includes("L"));
});

test("parentChildEdgeD direct drop when almost aligned", () => {
  const d = parentChildEdgeD(0, 0, 1, 20);
  assert.ok(d.startsWith("M"));
});

test("relationStrokeProps maps kinds to dash patterns", () => {
  assert.deepEqual(relationStrokeProps("biological"), {});
  assert.equal(relationStrokeProps("adoptive").strokeDasharray, "8 5");
  assert.equal(relationStrokeProps("step").strokeDasharray, "4 6");
  assert.equal(relationStrokeProps("foster").strokeDasharray, "2 5");
  assert.deepEqual(relationStrokeProps(null), {});
});

test("relationLabel humanizes", () => {
  assert.equal(relationLabel("adoptive"), "adopted");
  assert.equal(relationLabel("step"), "step");
  assert.equal(relationLabel("foster"), "foster");
  assert.equal(relationLabel("biological"), "biological");
  assert.equal(relationLabel(null), "biological");
});
