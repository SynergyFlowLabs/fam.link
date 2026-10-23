import test from "node:test";
import assert from "node:assert/strict";
import { layoutFan, layoutList, layoutPedigree, layoutDescendant, layoutWithKind, LAYOUT_KINDS } from "./strategies.ts";
import { layoutTree, NODE_W, type LayoutInput, type LayoutPerson, type LayoutUnion, type LayoutLink } from "./engine.ts";

let seq = 1000;
const uid = (p: string) => `${p}${++seq}`;
function person(id?: string): LayoutPerson { return { id: id ?? uid("p") }; }
function union(a: string, b: string | null): LayoutUnion { return { id: uid("u"), partnerAId: a, partnerBId: b }; }
function link(u: LayoutUnion, child: string): LayoutLink { return { unionId: u.id, childId: child }; }

function simpleTree() {
  // hourglass shape: grandparents -> parents -> you + sib -> kids
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const gf = person("gf");
  const gm = person("gm");
  const sib = person("sib");
  const kid = person("kid");
  const uGF = union(gf.id, gm.id);
  const uPar = union(dad.id, mom.id);
  const uYou = union(you.id, null);
  const persons = [you, dad, mom, gf, gm, sib, kid];
  const unions = [uGF, uPar, uYou];
  const links = [link(uGF, dad.id), link(uPar, you.id), link(uPar, sib.id), link(uYou, kid.id)];
  const input: LayoutInput = { persons, unions, links, focusPersonId: you.id };
  return { input, you, dad, mom, gf, gm, sib, kid };
}

for (const kind of LAYOUT_KINDS) {
  test(`${kind}: deterministic`, () => {
    const { input } = simpleTree();
    const a = layoutWithKind(input, kind);
    const b = layoutWithKind(input, kind);
    assert.deepEqual(a, b);
    if (kind === "pedigree" || kind === "descendant") {
      // pedigree/descendant are filtered views — they don't include everyone
      assert.ok(a.nodes.length > 0 && a.nodes.length <= input.persons.length);
      assert.ok(a.nodes.some((n) => n.id === input.focusPersonId));
    } else {
      assert.equal(a.nodes.length, input.persons.length);
      for (const p of input.persons) assert.ok(a.nodes.some((n) => n.id === p.id));
    }
  });
}

test("pedigree: only focus + ancestors, focus at rightmost column", () => {
  const { input, you, dad, kid } = simpleTree();
  const res = layoutPedigree(input);
  const ids = new Set(res.nodes.map((n) => n.id));
  assert.ok(ids.has(you.id));
  assert.ok(ids.has(dad.id));
  // kid is descendant — should not be in pedigree
  assert.ok(!ids.has(kid.id), "pedigree excludes descendants");
  // focus x is max x (rightmost)
  const focus = res.nodes.find((n) => n.id === you.id)!;
  const maxX = Math.max(...res.nodes.map((n) => n.x));
  assert.equal(focus.x, maxX);
});

test("descendant: only focus + descendants, focus at top row", () => {
  const { input, you, gf, kid, sib } = simpleTree();
  const res = layoutDescendant(input);
  const ids = new Set(res.nodes.map((n) => n.id));
  assert.ok(ids.has(you.id));
  assert.ok(ids.has(kid.id));
  assert.ok(ids.has(sib.id));
  assert.ok(!ids.has(gf.id), "descendant excludes ancestors");
  const focus = res.nodes.find((n) => n.id === you.id)!;
  const minY = Math.min(...res.nodes.map((n) => n.y));
  assert.equal(focus.y, minY);
});

test("fan: renders 3+ generations with focus at center, ring distribution", () => {
  const { input, you } = simpleTree();
  const res = layoutFan(input);
  const focus = res.nodes.find((n) => n.id === you.id)!;
  assert.ok(Math.abs(focus.x - res.focusX) < 1);
  assert.ok(Math.abs(focus.y - res.focusY) < 1);
  // width == height for fan (square)
  assert.equal(res.width, res.height);
  // 3 generations present: -2, -1, 0, +1 at least 3 rings
  const gens = new Set(res.nodes.map((n) => n.generation));
  assert.ok(gens.size >= 3);
});

test("list: indented, printable, keyboard-navigable order (generation asc)", () => {
  const { input } = simpleTree();
  const res = layoutList(input);
  // y strictly increasing along sorted order
  for (let i = 1; i < res.nodes.length; i++) {
    assert.ok(res.nodes[i].y > res.nodes[i - 1].y, "list y increases");
  }
  // indent grows with generation
  const gf = res.nodes.find((n) => n.id === "gf")!;
  const you = res.nodes.find((n) => n.id === "you")!;
  const kid = res.nodes.find((n) => n.id === "kid")!;
  assert.ok(gf.x < you.x, "ancestor indented less than focus");
  assert.ok(you.x < kid.x, "descendant indented more");
});

test("pedigree/descendant overlap-free per generation", () => {
  const { input } = simpleTree();
  for (const fn of [layoutPedigree, layoutDescendant]) {
    const res = fn(input);
    // For pedigree columns: same x (generation) should have y separated by NODE_H + gap
    const byGen = new Map<number, typeof res.nodes>();
    for (const n of res.nodes) {
      const list = byGen.get(n.generation) ?? [];
      list.push(n);
      byGen.set(n.generation, list);
    }
    for (const [, list] of byGen) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          // For pedigree/descendant, same generation means same column or row — check not overlapping by using appropriate axis
          // Pedigree: same gen -> same x, check y
          // Descendant: same gen -> same y, check x
          // We check both axes conservatively: at least one axis separated
          const xOverlap = Math.abs(a.x - b.x) < NODE_W - 0.5;
          const yOverlap = Math.abs(a.y - b.y) < 60 - 0.5;
          assert.ok(!(xOverlap && yOverlap), `${a.id} and ${b.id} overlap in ${fn.name}`);
        }
      }
    }
  }
});

test("hourglass unchanged: layoutWithKind hourglass equals layoutTree", () => {
  const { input } = simpleTree();
  assert.deepEqual(layoutWithKind(input, "hourglass"), layoutTree(input));
});
