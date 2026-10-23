import test from "node:test";
import assert from "node:assert/strict";
import { buildCollapseGraph, getDescendantBranchIds, branchCount, getVisibleIds, isInViewport, collapsedAncestorsOf } from "./collapse-store.ts";

function union(a: string, b: string | null, id: string) {
  return { id, partnerAId: a, partnerBId: b };
}

test("descendant branch includes children + spouses, deduped via DAG", () => {
  // grandpa+grandma -> dad + uncle ; dad+mom -> you + sib ; you+spouse -> kid
  const unions = [
    union("grandpa", "grandma", "u1"),
    union("dad", "mom", "u2"),
    union("you", "spouse", "u3"),
  ];
  const links = [
    { unionId: "u1", childId: "dad" },
    { unionId: "u1", childId: "uncle" },
    { unionId: "u2", childId: "you" },
    { unionId: "u2", childId: "sib" },
    { unionId: "u3", childId: "kid" },
  ];
  const g = buildCollapseGraph({ unions, links });
  // branch of dad should include you, sib, kid, spouse
  const branch = getDescendantBranchIds("dad", g);
  assert.ok(branch.has("you"));
  assert.ok(branch.has("sib"));
  assert.ok(branch.has("kid"));
  assert.ok(branch.has("spouse"), "spouse of descendant included");
  assert.ok(!branch.has("dad"), "root not included");
  assert.ok(!branch.has("grandpa"), "ancestors not included");
  assert.ok(!branch.has("uncle"), "uncle not descendant of dad");
  assert.equal(branchCount("dad", g), branch.size);
});

test("collapsing hides descendants but keeps collapsed node visible", () => {
  const unions = [union("dad", "mom", "u1"), union("you", null, "u2")];
  const links = [{ unionId: "u1", childId: "you" }, { unionId: "u2", childId: "kid" }];
  const g = buildCollapseGraph({ unions, links });
  const all = ["dad", "mom", "you", "kid"];
  const visible = getVisibleIds(all, new Set(["dad"]), g);
  assert.ok(visible.has("dad"), "collapsed node stays");
  assert.ok(visible.has("mom"), "spouse of collapsed node stays (not descendant)");
  assert.ok(!visible.has("you"), "descendant hidden");
  assert.ok(!visible.has("kid"), "grandchild hidden");
});

test("pedigree collapse cousin marriage deduped", () => {
  // gf+gm1 -> dad ; gf+gm2 -> mom ; dad+mom -> you (cousin marriage)
  const unions = [union("gf", "gm1", "u1"), union("gf", "gm2", "u2"), union("dad", "mom", "u3")];
  const links = [{ unionId: "u1", childId: "dad" }, { unionId: "u2", childId: "mom" }, { unionId: "u3", childId: "you" }];
  const g = buildCollapseGraph({ unions, links });
  const branch = getDescendantBranchIds("gf", g);
  // gf's branch includes dad,mom,you via both marriages, deduped
  assert.ok(branch.has("dad"));
  assert.ok(branch.has("mom"));
  assert.ok(branch.has("you"));
  assert.equal(branch.size, 3);
});

test("viewport culling buffer", () => {
  const view = { x: 0, y: 0, w: 800, h: 600 };
  assert.ok(isInViewport({ x: 400, y: 300 }, view));
  assert.ok(!isInViewport({ x: 2000, y: 300 }, view));
  assert.ok(isInViewport({ x: 900, y: 300 }, view, 200), "buffer includes near viewport");
  assert.ok(!isInViewport({ x: 2000, y: 300 }, view, 200));
});

test("collapsedAncestorsOf finds ancestor collapses", () => {
  const unions = [union("gp", null, "u1"), union("dad", "mom", "u2"), union("you", null, "u3")];
  const links = [{ unionId: "u1", childId: "dad" }, { unionId: "u2", childId: "you" }, { unionId: "u3", childId: "kid" }];
  // manually build parentUnionsByChild
  const parentUnionsByChild = new Map<string, string[]>([["dad", ["u1"]], ["you", ["u2"]], ["kid", ["u3"]]]);
  const partnerOf = (uid: string) => {
    const map: Record<string, string[]> = { u1: ["gp"], u2: ["dad", "mom"], u3: ["you"] };
    return map[uid] ?? [];
  };
  const collapsed = new Set(["gp", "dad", "other"]);
  const ancestors = collapsedAncestorsOf("kid", collapsed, parentUnionsByChild, partnerOf);
  assert.ok(ancestors.includes("dad"));
  assert.ok(ancestors.includes("gp"));
  assert.ok(!ancestors.includes("other"));
});
