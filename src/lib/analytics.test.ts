import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  branchCoverage,
  childlessUnions,
  computeInsights,
  generationGaps,
  parseYear,
  rootPersons,
  sparseBranchInsight,
  unrememberedPeople,
  type AnalyticsInput,
  type AnalyticsPerson,
} from "./analytics.ts";

const P = (id: string, over: Partial<AnalyticsPerson> = {}): AnalyticsPerson => ({
  id,
  firstName: id,
  lastName: null,
  living: false,
  gender: null,
  birthDateText: null,
  ...over,
});

const BASE: AnalyticsInput = {
  persons: [],
  unions: [],
  links: [],
  memories: [],
  paternal: [],
  maternal: [],
};

describe("analytics", () => {
  it("branchCoverage buckets persons and memories", () => {
    const persons = [
      P("dad"),
      P("mom"),
      P("kid"),
      P("friend"),
      P("friend2"),
    ];
    const input: AnalyticsInput = {
      ...BASE,
      persons,
      paternal: ["dad", "kid"],
      maternal: ["mom"],
      memories: [{ personId: "dad" }],
    };
    const cov = branchCoverage(input);
    const paternal = cov.find((c) => c.branch === "paternal")!;
    const maternal = cov.find((c) => c.branch === "maternal")!;
    const other = cov.find((c) => c.branch === "other")!;
    assert.equal(paternal.persons, 2);
    assert.equal(paternal.withMemories, 1);
    assert.equal(paternal.coverage, 0.5);
    assert.equal(maternal.coverage, 0);
    assert.equal(other.persons, 2);
  });

  it("sparseBranchInsight fires only for a genuinely sparse known branch", () => {
    const cov = [
      { branch: "paternal" as const, persons: 10, withMemories: 1, coverage: 0.1 },
      { branch: "maternal" as const, persons: 8, withMemories: 6, coverage: 0.75 },
      { branch: "other" as const, persons: 5, withMemories: 0, coverage: 0 },
    ];
    const insight = sparseBranchInsight(cov);
    assert.ok(insight);
    assert.ok(insight.title.includes("paternal"));
    // both sides healthy → quiet
    assert.equal(
      sparseBranchInsight([
        { branch: "paternal", persons: 10, withMemories: 8, coverage: 0.8 },
        { branch: "maternal", persons: 8, withMemories: 6, coverage: 0.75 },
      ]),
      null,
    );
    // tiny trees don't nag
    assert.equal(
      sparseBranchInsight([
        { branch: "paternal", persons: 2, withMemories: 0, coverage: 0 },
        { branch: "maternal", persons: 3, withMemories: 3, coverage: 1 },
      ]),
      null,
    );
  });

  it("unrememberedPeople counts and samples", () => {
    const persons = [P("a"), P("b"), P("c"), P("d")];
    const res = unrememberedPeople(persons, [{ personId: "a" }]);
    assert.equal(res.count, 3);
    assert.deepEqual(res.names, ["b", "c", "d"]);
  });

  it("rootPersons and childlessUnions find structural gaps", () => {
    const persons = [P("gm"), P("m"), P("k")];
    const unions = [{ id: "u1", partnerAId: "m", partnerBId: null }];
    const links = [{ unionId: "u1", childId: "k" }];
    assert.deepEqual(rootPersons(persons, links).map((p) => p.id), ["gm", "m"]);
    assert.deepEqual(childlessUnions(unions, links), []);
    assert.equal(childlessUnions([...unions, { id: "u2", partnerAId: "gm", partnerBId: null }], links).length, 1);
  });

  it("parseYear handles fuzzy date text", () => {
    assert.equal(parseYear("c. 1947"), 1947);
    assert.equal(parseYear("Eid 1994"), 1994);
    assert.equal(parseYear("before Partition"), null);
    assert.equal(parseYear(null), null);
    assert.equal(parseYear("12"), null);
    assert.equal(parseYear("12345"), null); // 12345 → picks 1234? guard: 5-digit token
  });

  it("generationGaps finds empty decades between births", () => {
    const persons = [
      P("g1", { birthDateText: "1905" }),
      P("g2", { birthDateText: "1952" }),
      P("g3", { birthDateText: "1980" }),
    ];
    const gaps = generationGaps(persons);
    assert.deepEqual(gaps, [
      { from: 1910, to: 1949 },
      { from: 1960, to: 1979 },
    ]);
    // too little data → no gap claims
    assert.deepEqual(generationGaps([P("x", { birthDateText: "1950" })]), []);
    assert.deepEqual(generationGaps([]), []);
  });

  it("computeInsights assembles everything and stays quiet on empty data", () => {
    const empty = computeInsights(BASE);
    assert.equal(empty.insights.length, 0);
    assert.equal(empty.unremembered.count, 0);

    const input: AnalyticsInput = {
      ...BASE,
      persons: [
        P("g1", { birthDateText: "1905" }),
        P("g2", { birthDateText: "1952" }),
        P("k", { living: true }),
      ],
      paternal: ["g1", "g2"],
      maternal: ["k"],
      memories: [{ personId: "g1" }],
    };
    const res = computeInsights(input);
    assert.ok(res.gaps.some((g) => g.from === 1910));
    assert.equal(res.unremembered.count, 2);
  });
});
