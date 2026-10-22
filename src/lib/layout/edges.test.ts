import test from "node:test";
import assert from "node:assert/strict";
import { coupleEdgeD, parentChildEdgeD } from "./edges.ts";

test("couple on the same row: straight line, inset from card edges", () => {
  const d = coupleEdgeD({ x: 100, y: 200 }, { x: 300, y: 200 }, 120);
  assert.equal(d, "M 163 200 L 237 200");
});

test("couple with no gap between cards: touches card edges exactly", () => {
  const d = coupleEdgeD({ x: 100, y: 200 }, { x: 224, y: 200 }, 120);
  // raw edges at 160 and 164 -> gap 4 <= 12, so no inset
  assert.equal(d, "M 160 200 L 164 200");
});

test("couple in different rows: soft S-curve between card edges", () => {
  const d = coupleEdgeD({ x: 100, y: 200 }, { x: 300, y: 280 }, 120);
  assert.ok(d.startsWith("M 163 200 C "), `starts at left card edge: ${d}`);
  assert.ok(d.endsWith("237 280"), `ends at right card edge: ${d}`);
  // sag toward the middle on both control points
  assert.ok(d.includes("215 232"), `control 1 sags: ${d}`);
  assert.ok(d.includes("185 248"), `control 2 sags: ${d}`);
});

test("child directly below: plain vertical drop", () => {
  const d = parentChildEdgeD(200, 230, 200.5, 400);
  assert.equal(d, "M 200 230 L 200.5 400");
});

test("offset child: rounded orthogonal bus at 45% of the gap", () => {
  const d = parentChildEdgeD(200, 230, 500, 400);
  // busY = 230 + 170*0.45 = 306.5, r = 14
  assert.equal(
    d,
    "M 200 230 L 200 292.5 Q 200 306.5 214 306.5 L 486 306.5 Q 500 306.5 500 320.5 L 500 400",
  );
});

test("siblings share the same bus height", () => {
  const c1 = parentChildEdgeD(200, 230, 300, 400);
  const c2 = parentChildEdgeD(200, 230, 700, 400);
  // both horizontal runs sit at y = 306.5
  assert.ok(c1.includes("306.5"), c1);
  assert.ok(c2.includes("306.5"), c2);
});

test("child to the left mirrors the routing", () => {
  const d = parentChildEdgeD(500, 230, 200, 400);
  assert.equal(
    d,
    "M 500 230 L 500 292.5 Q 500 306.5 486 306.5 L 214 306.5 Q 200 306.5 200 320.5 L 200 400",
  );
});

test("tight spacing: corner radius clamps to the space available", () => {
  // dx = 10, dy = 30 -> busY = 243.5, r = min(14, 4, 12.5, 15.5) = 4
  const d = parentChildEdgeD(200, 230, 210, 260);
  assert.equal(
    d,
    "M 200 230 L 200 239.5 Q 200 243.5 204 243.5 L 206 243.5 Q 210 243.5 210 247.5 L 210 260",
  );
});

test("degenerate: no vertical room falls back to a straight line", () => {
  const d = parentChildEdgeD(200, 230, 500, 236);
  assert.equal(d, "M 200 230 L 500 236");
});
