import test from "node:test";
import assert from "node:assert/strict";
import {
  assignGenerations,
  layoutTree,
  NODE_W,
  COUPLE_GAP,
  type LayoutInput,
  type LayoutPerson,
  type LayoutUnion,
  type LayoutLink,
  type LayoutResult,
} from "./engine.ts";

let seq = 0;
const uid = (p: string) => `${p}${++seq}`;

function person(id?: string): LayoutPerson {
  return { id: id ?? uid("p") };
}
function union(a: string, b: string | null): LayoutUnion {
  return { id: uid("u"), partnerAId: a, partnerBId: b };
}
function link(u: LayoutUnion, child: string): LayoutLink {
  return { unionId: u.id, childId: child };
}

function gens(input: LayoutInput): Record<string, number> {
  return Object.fromEntries(assignGenerations(input));
}

function nodesById(result: LayoutResult): Map<string, { x: number; y: number; generation: number }> {
  return new Map(result.nodes.map((n) => [n.id, n]));
}

// ---------------------------------------------------------------- generations

test("linear family: parents -1, grandparents -2, siblings 0, children +1", () => {
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const gf = person("gf"); // dad's father
  const gm = person("gm"); // dad's mother
  const sib = person("sib"); // your sibling
  const kid = person("kid"); // your child
  const u1 = union(gf.id, gm.id);
  const u2 = union(dad.id, mom.id);
  const u3 = union(you.id, null);
  const input: LayoutInput = {
    persons: [you, dad, mom, gf, gm, sib, kid],
    unions: [u1, u2, u3],
    links: [link(u1, dad.id), link(u2, you.id), link(u2, sib.id), link(u3, kid.id)],
    focusPersonId: you.id,
  };
  const g = gens(input);
  assert.equal(g.you, 0);
  assert.equal(g.dad, -1);
  assert.equal(g.mom, -1);
  assert.equal(g.gf, -2);
  assert.equal(g.gm, -2);
  assert.equal(g.sib, 0);
  assert.equal(g.kid, 1);
});

test("pedigree collapse: shared grandfather appears once at -2", () => {
  // Dad and Mom are both children of GF (half-siblings) — cousin marriage.
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const gf = person("gf");
  const gm1 = person("gm1"); // dad's mother
  const gm2 = person("gm2"); // mom's mother
  const u1 = union(gf.id, gm1.id);
  const u2 = union(gf.id, gm2.id);
  const u3 = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [you, dad, mom, gf, gm1, gm2],
    unions: [u1, u2, u3],
    links: [link(u1, dad.id), link(u2, mom.id), link(u3, you.id)],
    focusPersonId: you.id,
  };
  const g = gens(input);
  assert.equal(g.you, 0);
  assert.equal(g.dad, -1);
  assert.equal(g.mom, -1);
  // GF is reachable via two paths but is ONE node at generation -2
  assert.equal(g.gf, -2);
  assert.equal(g.gm1, -2);
  assert.equal(g.gm2, -2);
  const result = layoutTree(input);
  const gfNodes = result.nodes.filter((n) => n.id === gf.id);
  assert.equal(gfNodes.length, 1);
});

test("spouse and in-laws: spouse at 0, spouse's parents at -1", () => {
  const you = person("you");
  const spouse = person("spouse");
  const spDad = person("spDad");
  const spMom = person("spMom");
  const u1 = union(spDad.id, spMom.id);
  const u2 = union(you.id, spouse.id);
  const input: LayoutInput = {
    persons: [you, spouse, spDad, spMom],
    unions: [u1, u2],
    links: [link(u1, spouse.id)],
    focusPersonId: you.id,
  };
  const g = gens(input);
  assert.equal(g.spouse, 0);
  assert.equal(g.spDad, -1);
  assert.equal(g.spMom, -1);
});

test("single parent: child is +1 below a lone parent", () => {
  const you = person("you");
  const kid = person("kid");
  const u = union(you.id, null);
  const input: LayoutInput = {
    persons: [you, kid],
    unions: [u],
    links: [link(u, kid.id)],
    focusPersonId: you.id,
  };
  const g = gens(input);
  assert.equal(g.kid, 1);
});

// --------------------------------------------------------------------- layout

test("every person gets exactly one positioned node", () => {
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const u = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [you, dad, mom],
    unions: [u],
    links: [link(u, you.id)],
    focusPersonId: you.id,
  };
  const result = layoutTree(input);
  assert.equal(result.nodes.length, 3);
  for (const p of input.persons) {
    assert.ok(result.nodes.some((n) => n.id === p.id), `${p.id} placed`);
  }
});

test("no two nodes in the same generation overlap", () => {
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const sib = person("sib");
  const kid = person("kid");
  const u = union(dad.id, mom.id);
  const u2 = union(you.id, null);
  const input: LayoutInput = {
    persons: [you, dad, mom, sib, kid],
    unions: [u, u2],
    links: [link(u, you.id), link(u, sib.id), link(u2, kid.id)],
    focusPersonId: you.id,
  };
  const result = layoutTree(input);
  const byGen = new Map<number, { id: string; x: number }[]>();
  for (const n of result.nodes) {
    const list = byGen.get(n.generation) ?? [];
    list.push({ id: n.id, x: n.x });
    byGen.set(n.generation, list);
  }
  for (const [, list] of byGen) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        assert.ok(
          Math.abs(list[i].x - list[j].x) >= NODE_W + COUPLE_GAP - 0.5,
          `${list[i].id} and ${list[j].id} overlap (dx=${Math.abs(list[i].x - list[j].x)})`,
        );
      }
    }
  }
});

test("same-row spouses are adjacent and are each other's nearest neighbor", () => {
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const u = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [you, dad, mom],
    unions: [u],
    links: [link(u, you.id)],
    focusPersonId: you.id,
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  const dx = Math.abs(nodes.get("dad")!.x - nodes.get("mom")!.x);
  assert.ok(Math.abs(dx - (NODE_W + COUPLE_GAP)) < 0.5, `spouses adjacent, dx=${dx}`);
});

test("children center under their parents' union midpoint", () => {
  const dad = person("dad");
  const mom = person("mom");
  const c1 = person("c1");
  const c2 = person("c2");
  const c3 = person("c3");
  const u = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [dad, mom, c1, c2, c3],
    unions: [u],
    links: [link(u, c1.id), link(u, c2.id), link(u, c3.id)],
    focusPersonId: c2.id,
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  const mid = (nodes.get("dad")!.x + nodes.get("mom")!.x) / 2;
  const centroid = (nodes.get("c1")!.x + nodes.get("c2")!.x + nodes.get("c3")!.x) / 3;
  assert.ok(
    Math.abs(mid - centroid) <= NODE_W,
    `family centered: mid=${mid}, centroid=${centroid}`,
  );
});

test("deterministic: same input yields identical output", () => {
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const u = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [you, dad, mom],
    unions: [u],
    links: [link(u, you.id)],
    focusPersonId: you.id,
  };
  assert.deepEqual(layoutTree(input), layoutTree(input));
});

test("lone focus: one node, sane bounds, no crash", () => {
  const you = person("you");
  const result = layoutTree({
    persons: [you],
    unions: [],
    links: [],
    focusPersonId: you.id,
  });
  assert.equal(result.nodes.length, 1);
  assert.ok(result.width > 0 && result.height > 0);
});

test("disconnected person is still placed without crashing", () => {
  const you = person("you");
  const stranger = person("stranger");
  const result = layoutTree({
    persons: [you, stranger],
    unions: [],
    links: [],
    focusPersonId: you.id,
  });
  assert.equal(result.nodes.length, 2);
});

test("deep chain: 6 generations up, each one row apart", () => {
  const ids = ["g0", "g1", "g2", "g3", "g4", "g5"]; // g0 = focus, g1 = parent…
  const persons = ids.map((id) => person(id));
  const unions: LayoutUnion[] = [];
  const links: LayoutLink[] = [];
  for (let i = 1; i < ids.length; i++) {
    const u = union(ids[i], null);
    unions.push(u);
    links.push(link(u, ids[i - 1]));
  }
  const input: LayoutInput = {
    persons,
    unions,
    links,
    focusPersonId: "g0",
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  for (let i = 0; i < ids.length; i++) {
    assert.equal(nodes.get(ids[i])!.generation, i === 0 ? 0 : -i);
  }
  // rows are ROW_GAP apart vertically
  assert.ok(Math.abs(nodes.get("g0")!.y - nodes.get("g1")!.y - 128) < 0.5);
});
