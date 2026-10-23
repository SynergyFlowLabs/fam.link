import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWalkPath,
  displayNameOfPerson,
  lifeLineOf,
  relationForStep,
  type WalkLink,
  type WalkPerson,
  type WalkUnion,
} from "./walkthrough.ts";

const P = (id: string, over: Partial<WalkPerson> = {}): WalkPerson => ({
  id,
  firstName: id,
  lastName: null,
  living: false,
  gender: null,
  birthDateText: null,
  deathDateText: null,
  birthPlace: null,
  deathPlace: null,
  photoMediaId: null,
  ...over,
});

// qasim → (union u1: qasim+amina) → yusuf → (union u2: yusuf+farida) → sara
const persons: WalkPerson[] = [
  P("qasim", { firstName: "Qasim" }),
  P("amina", { firstName: "Amina" }),
  P("yusuf", { firstName: "Yusuf" }),
  P("farida", { firstName: "Farida" }),
  P("sara", { firstName: "Sara", living: true }),
];
const unions: WalkUnion[] = [
  { id: "u1", partnerAId: "qasim", partnerBId: "amina" },
  { id: "u2", partnerAId: "yusuf", partnerBId: "farida" },
];
const links: WalkLink[] = [
  { unionId: "u1", childId: "yusuf" },
  { unionId: "u2", childId: "sara" },
];

describe("walkthrough", () => {
  it("walks ancestors: child → parent → grandparent", () => {
    const path = buildWalkPath("sara", persons, unions, links, "ancestors");
    assert.deepEqual(path.map((p) => p.id), ["sara", "yusuf", "qasim"]);
  });

  it("walks descendants: elder → child → grandchild", () => {
    const path = buildWalkPath("qasim", persons, unions, links, "descendants");
    assert.deepEqual(path.map((p) => p.id), ["qasim", "yusuf", "sara"]);
  });

  it("cycles and missing people terminate the path", () => {
    const cycUnions: WalkUnion[] = [{ id: "u1", partnerAId: "a", partnerBId: null }];
    const cycLinks: WalkLink[] = [
      { unionId: "u1", childId: "a" }, // a is a's own parent — loop!
    ];
    const path = buildWalkPath("a", [P("a")], cycUnions, cycLinks, "ancestors");
    assert.deepEqual(path.map((p) => p.id), ["a"]);
    assert.equal(buildWalkPath("ghost", persons, unions, links, "ancestors").length, 0);
  });

  it("relationForStep names generations", () => {
    const path = buildWalkPath("sara", persons, unions, links, "ancestors");
    assert.equal(relationForStep(path, 0, "ancestors"), "starting point");
    assert.equal(relationForStep(path, 1, "ancestors"), "parent");
    assert.equal(relationForStep(path, 2, "ancestors"), "grandparent");
    assert.equal(relationForStep([persons[0]!, persons[2]!, persons[4]!][0] ? [persons[0]!, persons[2]!, persons[4]!] : [], 2, "descendants"), "grandchild");
  });

  it("lifeLine and display names", () => {
    const p = P("x", {
      firstName: "Yusuf",
      lastName: "Khan",
      birthDateText: "1918",
      birthPlace: "Jalandhar",
      deathDateText: "2004",
      deathPlace: "Lahore",
    });
    assert.equal(displayNameOfPerson(p), "Yusuf Khan");
    assert.equal(lifeLineOf(p), "1918 · Jalandhar — 2004 · Lahore");
    assert.equal(lifeLineOf(P("y")), "");
  });
});
