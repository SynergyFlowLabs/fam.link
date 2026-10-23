import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterByBranch, filterLinksByBranch, filterUnionsByBranch, getBranchPersonIds } from "./branch-scope.ts";

const persons = [{ id: "dad" }, { id: "mom" }, { id: "child" }, { id: "grandpa" }, { id: "grandma" }, { id: "momdad" }];
const unions = [
  { id: "u1", partnerAId: "grandpa", partnerBId: "grandma" },
  { id: "u2", partnerAId: "dad", partnerBId: "mom" },
  { id: "u3", partnerAId: "momdad", partnerBId: null }, // mom's parent single
];
const links = [
  { unionId: "u1", childId: "dad" },
  { unionId: "u2", childId: "child" },
  { unionId: "u3", childId: "mom" },
];

describe("branch-scope", () => {
  it("null scope returns null (tree-wide)", () => {
    assert.equal(getBranchPersonIds(null, persons, unions, links), null);
    assert.equal(getBranchPersonIds(undefined, persons, unions, links), null);
  });
  it("unknown root returns empty set", () => {
    const ids = getBranchPersonIds("unknown", persons, unions, links);
    assert.equal(ids!.size, 0);
  });
  it("dad branch includes ancestors, descendants, spouse, but not spouse ancestors beyond one hop", () => {
    const ids = getBranchPersonIds("dad", persons, unions, links)!;
    assert.ok(ids.has("dad"));
    assert.ok(ids.has("grandpa"));
    assert.ok(ids.has("grandma"));
    assert.ok(ids.has("child"));
    assert.ok(ids.has("mom"), "spouse of dad included");
    assert.ok(!ids.has("momdad"), "mom's parent (spouse ancestor) not included — one hop rule");
  });
  it("child branch includes both sides via ancestors (full pedigree)", () => {
    const ids = getBranchPersonIds("child", persons, unions, links)!;
    assert.ok(ids.has("child"));
    assert.ok(ids.has("dad"));
    assert.ok(ids.has("mom"));
    assert.ok(ids.has("grandpa"));
    assert.ok(ids.has("momdad"));
  });
  it("filterByBranch keeps only branch persons", () => {
    const ids = new Set(["dad", "child"]);
    assert.deepEqual(filterByBranch(persons as never, ids).map((p) => p.id).sort(), ["child", "dad"]);
    assert.equal(filterByBranch(persons as never, null).length, persons.length);
  });
  it("filterUnionsByBranch keeps unions with at least one partner in branch", () => {
    const ids = new Set(["dad", "child"]);
    const filtered = filterUnionsByBranch(unions as never, ids);
    assert.ok(filtered.some((u) => u.id === "u2"));
    assert.ok(!filtered.some((u) => u.id === "u3"));
  });
  it("filterLinksByBranch keeps links where union and child in branch", () => {
    const ids = new Set(["dad", "mom", "child"]);
    const filtered = filterLinksByBranch(links as never, ids, unions as never);
    assert.ok(filtered.some((l) => l.childId === "child"));
    // u1 child dad is in branch but union u1 not in filtered unions (grandparents not in branch) — so not included
    assert.ok(!filtered.some((l) => l.unionId === "u1"));
  });
});
