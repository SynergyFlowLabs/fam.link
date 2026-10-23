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

// --------------------------------------------- tidy hourglass (large trees)

test("bow-tie: cousin who is also a son-in-law keeps his collateral row", () => {
  // The Quraysh shape: uncle's son (cousin) marries the focus's daughter.
  const you = person("you");
  const dad = person("dad");
  const mom = person("mom");
  const grandpa = person("grandpa");
  const grandma = person("grandma");
  const uncle = person("uncle");
  const uncleWife = person("uncleWife");
  const cousin = person("cousin"); // uncle's son
  const daughter = person("daughter"); // you's daughter
  const grandchild = person("grandchild"); // cousin + daughter's child
  const uGP = union(grandpa.id, grandma.id);
  const uParents = union(dad.id, mom.id);
  const uGrand = union(uncle.id, uncleWife.id);
  const uYou = union(you.id, null);
  const uMarry = union(cousin.id, daughter.id);
  const input: LayoutInput = {
    persons: [
      you, dad, mom, grandpa, grandma, uncle, uncleWife, cousin, daughter,
      grandchild,
    ],
    unions: [uGP, uParents, uGrand, uYou, uMarry],
    links: [
      link(uGP, dad.id),
      link(uGP, uncle.id),
      link(uParents, you.id),
      link(uYou, daughter.id),
      link(uGrand, cousin.id),
      link(uMarry, grandchild.id),
    ],
    focusPersonId: you.id,
  };
  const g = gens(input);
  // the uncle's sibship stays whole: dad and uncle share row -1
  assert.equal(g.dad, -1);
  assert.equal(g.uncle, -1);
  assert.equal(g.uncleWife, -1);
  // the cousin is a collateral (row 0), his wife a descendant (+1) — a
  // cross-row couple, not a reason to split the uncle's sibship
  assert.equal(g.cousin, 0);
  assert.equal(g.daughter, 1);
  // their child follows the deeper parent: a grandchild at +2
  assert.equal(g.grandchild, 2);

  const result = layoutTree(input);
  const nodes = nodesById(result);
  // dad sits exactly under the parents' midpoint, and so does the uncle's
  // family stay contiguous around him — no row mixing
  const mid = (nodes.get("dad")!.x + nodes.get("mom")!.x) / 2;
  assert.ok(
    Math.abs(nodes.get("uncle")!.x - mid) > NODE_W,
    "uncle flanks outboard, not on top of the direct line",
  );
  // the couple edge crosses rows but spouses keep their own rows
  assert.notEqual(nodes.get("cousin")!.generation, nodes.get("daughter")!.generation);
  // grandchild centered under the true couple midpoint
  const coupleMid = (nodes.get("cousin")!.x + nodes.get("daughter")!.x) / 2;
  assert.ok(
    Math.abs(coupleMid - nodes.get("grandchild")!.x) <= NODE_W,
    "grandchild under the couple midpoint",
  );
});

test("remarriage: both spouses sit beside their shared partner, each family's children under its own midpoint", () => {
  const p = person("p");
  const s1 = person("s1");
  const s2 = person("s2");
  const k1 = person("k1"); // child of p + s1
  const k2 = person("k2"); // child of p + s2
  const u1 = union(p.id, s1.id);
  const u2 = union(p.id, s2.id);
  const input: LayoutInput = {
    persons: [p, s1, s2, k1, k2],
    unions: [u1, u2],
    links: [link(u1, k1.id), link(u2, k2.id)],
    focusPersonId: p.id,
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  // spouse chain: s1 - p - s2, all adjacent
  const xs = [nodes.get("s1")!.x, nodes.get("p")!.x, nodes.get("s2")!.x];
  for (let i = 1; i < xs.length; i++) {
    assert.ok(
      Math.abs(xs[i] - xs[i - 1] - (NODE_W + COUPLE_GAP)) < 0.5,
      `spouse chain adjacent at ${i}`,
    );
  }
  // each family's child centers under that family's own midpoint
  assert.ok(
    Math.abs((nodes.get("p")!.x + nodes.get("s1")!.x) / 2 - nodes.get("k1")!.x) <= NODE_W / 2,
    "k1 under p+s1 midpoint",
  );
  assert.ok(
    Math.abs((nodes.get("p")!.x + nodes.get("s2")!.x) / 2 - nodes.get("k2")!.x) <= NODE_W / 2,
    "k2 under p+s2 midpoint",
  );
});

test("wide descendants: eight children stay contiguous and centered under the couple", () => {
  const dad = person("dad");
  const mom = person("mom");
  const kids = Array.from({ length: 8 }, (_, i) => person(`k${i}`));
  const u = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [dad, ...kids, mom],
    unions: [u],
    links: kids.map((k) => link(u, k.id)),
    focusPersonId: "dad",
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  const mid = (nodes.get("dad")!.x + nodes.get("mom")!.x) / 2;
  const centroid =
    kids.reduce((s, k) => s + nodes.get(k.id)!.x, 0) / kids.length;
  assert.ok(Math.abs(mid - centroid) < 1, `contiguous family centered: ${mid} vs ${centroid}`);
  const sorted = kids.map((k) => nodes.get(k.id)!.x).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i] - sorted[i - 1] >= NODE_W - 0.5, "children don't overlap");
  }
});

test("siblings in birth order around the focus (direct child under the midpoint)", () => {
  const dad = person("dad");
  const mom = person("mom");
  const sibs = ["s1", "s2", "focus", "s4"].map((id) => person(id));
  const u = union(dad.id, mom.id);
  const input: LayoutInput = {
    persons: [dad, mom, ...sibs.map((s) => ({ id: s.id, birthHint: null }))],
    unions: [u],
    links: sibs.map((s) => link(u, s.id)),
    focusPersonId: "focus",
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  const mid = (nodes.get("dad")!.x + nodes.get("mom")!.x) / 2;
  assert.ok(
    Math.abs(nodes.get("focus")!.x - mid) < 1,
    "focus (direct child) exactly under the parents' midpoint",
  );
  const c = nodes.get("focus")!.x;
  assert.ok(nodes.get("s2")!.x < c, "older sibling left");
  assert.ok(nodes.get("s4")!.x > c, "younger sibling right");
  assert.ok(nodes.get("s1")!.x < nodes.get("s2")!.x, "birth order kept");
});

test("birth hints order siblings", () => {
  const dad = person("dad");
  const a = { id: "a", birthHint: "1990" };
  const b = { id: "b", birthHint: "c. 1985" };
  const c = { id: "c", birthHint: null };
  const u = union(dad.id, null);
  const input: LayoutInput = {
    persons: [dad, a, b, c],
    unions: [u],
    links: [link(u, "a"), link(u, "b"), link(u, "c")],
    focusPersonId: "dad",
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  assert.ok(nodes.get("b")!.x < nodes.get("a")!.x, "1985 before 1990");
  assert.ok(nodes.get("a")!.x < nodes.get("c")!.x, "unknown year last");
});

test("in-law parents sit above the spouse, one row up", () => {
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
  assert.equal(g.spDad, -1);
  assert.equal(g.spMom, -1);
  const result = layoutTree(input);
  const nodes = nodesById(result);
  // spouse's parents' midpoint sits over the spouse
  const mid = (nodes.get("spDad")!.x + nodes.get("spMom")!.x) / 2;
  assert.ok(
    Math.abs(mid - nodes.get("spouse")!.x) <= NODE_W / 2,
    "in-law couple centered over the spouse",
  );
});

test("direct-line ancestors sit exactly above their child", () => {
  const ids = ["g0", "g1", "g2", "g3", "g4"];
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
  for (let i = 1; i < ids.length; i++) {
    assert.ok(
      Math.abs(nodes.get(ids[i])!.x - nodes.get(ids[i - 1])!.x) < 1,
      `${ids[i]} exactly above ${ids[i - 1]}`,
    );
  }
});

test("large generated tree: placed, overlap-free, deterministic", () => {
  // Seeded PRNG → same tree every run.
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const persons: LayoutPerson[] = [];
  const unions: LayoutUnion[] = [];
  const links: LayoutLink[] = [];
  let n = 0;
  const newId = () => `p${++n}`;
  const root = newId();
  persons.push({ id: root });
  // generations of descendants: each person 0..n may get a spouse + children
  const frontier = [root];
  for (let depth = 0; depth < 5; depth++) {
    const next: string[] = [];
    for (const id of [...frontier]) {
      if (rnd() < 0.7) {
        const spouse = newId();
        persons.push({ id: spouse });
        const u = union(id, spouse);
        unions.push(u);
        const kids = Math.floor(rnd() * 5);
        for (let k = 0; k < kids; k++) {
          const kid = newId();
          persons.push({ id: kid, birthHint: String(1900 + depth * 25 + k) });
          links.push(link(u, kid));
          next.push(kid);
        }
      } else {
        const u = union(id, null);
        unions.push(u);
        const kids = Math.floor(rnd() * 3);
        for (let k = 0; k < kids; k++) {
          const kid = newId();
          persons.push({ id: kid, birthHint: String(1900 + depth * 25 + k) });
          links.push(link(u, kid));
          next.push(kid);
        }
      }
    }
    frontier.push(...next);
  }
  // sprinkle two ancestor generations above the root
  let anc = root;
  for (let i = 0; i < 2; i++) {
    const parent = newId();
    persons.push({ id: parent });
    const u = union(parent, null);
    unions.push(u);
    links.push(link(u, anc));
    anc = parent;
  }
  const input: LayoutInput = {
    persons,
    unions,
    links,
    focusPersonId: root,
  };
  const result = layoutTree(input);
  assert.equal(result.nodes.length, persons.length, "everyone placed");
  // no same-row overlaps
  const byRow = new Map<number, { id: string; x: number }[]>();
  for (const nd of result.nodes) {
    const list = byRow.get(nd.generation) ?? [];
    list.push({ id: nd.id, x: nd.x });
    byRow.set(nd.generation, list);
  }
  for (const [, list] of byRow) {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i].x - sorted[i - 1].x >= NODE_W - 0.5,
        `${sorted[i - 1].id}/${sorted[i].id} overlap in a ${list.length}-unit row`,
      );
    }
  }
  // deterministic
  assert.deepEqual(layoutTree(input), result);
});

test("two independent descendant branches never interleave", () => {
  const dad = person("dad");
  const mom = person("mom");
  const s1 = { id: "s1", birthHint: "1950" };
  const s2 = { id: "s2", birthHint: "1955" };
  const u = union(dad.id, mom.id);
  const u1 = union("s1", null);
  const u2 = union("s2", null);
  const k1 = Array.from({ length: 3 }, (_, i) => person(`a${i}`));
  const k2 = Array.from({ length: 3 }, (_, i) => person(`b${i}`));
  const input: LayoutInput = {
    persons: [dad, mom, s1, s2, ...k1, ...k2],
    unions: [u, u1, u2],
    links: [
      link(u, "s1"),
      link(u, "s2"),
      ...k1.map((k) => link(u1, k.id)),
      ...k2.map((k) => link(u2, k.id)),
    ],
    focusPersonId: "s1",
  };
  const result = layoutTree(input);
  const nodes = nodesById(result);
  // every aN sits left of every bN (s1's family left, s2's family right)
  for (const a of k1) {
    for (const b of k2) {
      assert.ok(
        nodes.get(a.id)!.x < nodes.get(b.id)!.x,
        `${a.id} (${nodes.get(a.id)!.x}) should be left of ${b.id} (${nodes.get(b.id)!.x})`,
      );
    }
  }
});
