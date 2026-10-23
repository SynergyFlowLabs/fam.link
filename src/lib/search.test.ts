import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { breadcrumbNames, describeRelationship, findRelationshipPath, matchesFilters, searchPersons } from "./search.ts";

const persons = [
  { id: "p1", firstName: "Ali", lastName: "Raza", alsoKnownAs: "Chotu", birthPlace: "Karachi", deathPlace: null, birthDateText: "1989", deathDateText: null, labels: [{ name: "Veteran" }], customFields: [{ fieldName: "Occupation", value: "Teacher" }], events: [{ placeText: "Lahore", dateText: "c. 1947", note: "Moved", source: null, kind: "relocation" }] },
  { id: "p2", firstName: "Yusuf", lastName: "Khan", alsoKnownAs: null, birthPlace: "Jalandhar", deathPlace: "Lahore", birthDateText: "1918", deathDateText: "2004", labels: [], customFields: [] },
  { id: "p3", firstName: "Farida", lastName: "Khan", alsoKnownAs: null, birthPlace: "Lahore", deathPlace: null, birthDateText: "1945", deathDateText: null, labels: [{ name: "Immigrant" }], customFields: [] },
] as const;

describe("searchPersons", () => {
  it("matches by name (case-insensitive, partial)", () => {
    const hits = searchPersons("ali", persons as never);
    assert.equal(hits[0].id, "p1");
    assert.equal(hits[0].matchedField, "name");
  });
  it("matches alsoKnownAs", () => {
    const hits = searchPersons("chotu", persons as never);
    assert.equal(hits[0].id, "p1");
  });
  it("matches place across birthPlace", () => {
    const hits = searchPersons("jala", [{ id: "x", firstName: "A", lastName: "B", alsoKnownAs: null, birthPlace: "Jalandhar", deathPlace: null, birthDateText: null, deathDateText: null, labels: [], customFields: [] } as never]);
    assert.equal(hits.length, 1);
  });
  it("matches label", () => {
    const hits = searchPersons("veteran", persons as never);
    assert.equal(hits[0].id, "p1");
    assert.equal(hits[0].matchedField, "label");
  });
  it("matches custom field value", () => {
    const hits = searchPersons("teacher", persons as never);
    assert.equal(hits[0].id, "p1");
  });
  it("matches event placeText", () => {
    const hits = searchPersons("lahore", persons as never);
    // p2 has deathPlace Lahore, p3 birthPlace Lahore, p1 event Lah — all may match, but at least p1 in results
    assert.ok(hits.some((h) => h.id === "p1"));
  });
  it("multi-token AND (all tokens must appear)", () => {
    assert.equal(searchPersons("ali raza", persons as never)[0].id, "p1");
    assert.equal(searchPersons("ali xyz", persons as never).length, 0);
  });
  it("skips redacted persons", () => {
    const hits = searchPersons("ali", [{ id: "p1", firstName: "Ali", lastName: "Raza", alsoKnownAs: null, birthPlace: null, deathPlace: null, birthDateText: null, deathDateText: null, redacted: true } as never]);
    assert.equal(hits.length, 0);
  });
  it("empty query returns no hits", () => {
    assert.equal(searchPersons("", persons as never).length, 0);
  });
  it("respects limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, firstName: "Test", lastName: `${i}`, alsoKnownAs: null, birthPlace: null, deathPlace: null, birthDateText: null, deathDateText: null } as never));
    assert.equal(searchPersons("test", many as never, { limit: 5 }).length, 5);
  });
});

describe("matchesFilters", () => {
  it("label filter", () => {
    assert.equal(matchesFilters(persons[0] as never, { label: "Veteran" }), true);
    assert.equal(matchesFilters(persons[1] as never, { label: "Veteran" }), false);
  });
  it("unlabeled special", () => {
    assert.equal(matchesFilters(persons[1] as never, { label: "__unlabeled" }), true);
    assert.equal(matchesFilters(persons[0] as never, { label: "__unlabeled" }), false);
  });
});

describe("findRelationshipPath", () => {
  const unions = [
    { id: "u1", partnerAId: "p1", partnerBId: "p2" },
    { id: "u2", partnerAId: "p3", partnerBId: null },
  ];
  const links = [
    { unionId: "u1", childId: "p3" }, // p1 & p2 are parents of p3
  ];
  it("finds parent -> child", () => {
    const path = findRelationshipPath("p1", "p3", unions, links);
    assert.ok(path);
    assert.deepEqual(path!.ids, ["p1", "p3"]);
    assert.equal(path!.steps[0].relation, "child");
  });
  it("finds child -> parent (reverse)", () => {
    const path = findRelationshipPath("p3", "p1", unions, links);
    assert.ok(path);
    assert.equal(path!.steps[0].relation, "parent");
  });
  it("finds spouse", () => {
    const path = findRelationshipPath("p1", "p2", unions, links);
    assert.ok(path);
    assert.equal(path!.steps[0].relation, "spouse");
  });
  it("handles pedigree collapse cycle without infinite loop", () => {
    // p1 is his own ancestor via loop — BFS visited prevents infinite loop
    const loopLinks = [...links, { unionId: "u2", childId: "p1" }];
    const path = findRelationshipPath("p1", "p2", unions, loopLinks);
    assert.ok(path);
  });
  it("same person => empty steps", () => {
    const path = findRelationshipPath("p1", "p1", unions, links);
    assert.ok(path);
    assert.equal(path!.steps.length, 0);
  });
  it("no path => null", () => {
    const path = findRelationshipPath("p1", "pX", unions, links);
    assert.equal(path, null);
  });
  it("describeRelationship: ancestor label", () => {
    const unions2 = [{ id: "u1", partnerAId: "g1", partnerBId: "g2" }, { id: "u2", partnerAId: "p1", partnerBId: null }];
    const links2 = [{ unionId: "u1", childId: "p1" }, { unionId: "u2", childId: "c1" }];
    const path = findRelationshipPath("c1", "g1", unions2, links2);
    assert.ok(path);
    const byId = new Map([["c1", { id: "c1", firstName: "Child", lastName: "A" } as never], ["p1", { id: "p1", firstName: "Parent", lastName: "A" } as never], ["g1", { id: "g1", firstName: "Grandpa", lastName: "A" } as never], ["g2", { id: "g2", firstName: "Grandma", lastName: "A" } as never]]);
    const label = describeRelationship("c1", "g1", path!, byId);
    assert.ok(label.includes("grandparent"));
  });
  it("breadcrumbNames", () => {
    const path = findRelationshipPath("p3", "p1", unions, links)!;
    const byId = new Map(persons.map((p) => [p.id, p as never]));
    const bc = breadcrumbNames(path, byId as never);
    assert.deepEqual(bc, ["Farida Khan", "Ali Raza"]);
  });
});
