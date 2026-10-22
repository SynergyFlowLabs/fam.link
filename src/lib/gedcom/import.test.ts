import test from "node:test";
import assert from "node:assert/strict";
import { planImport } from "./import.ts";
import { parseGedcom } from "./parse.ts";
import { writeGedcom, type GedcomInput } from "./writer.ts";

test("plans persons: names, gender, living inference", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Ahmed /Raza/
1 SEX M
1 BIRT
2 DATE 1952
1 DEAT
2 DATE 2020
0 @I2@ INDI
1 NAME Bilal /Raza/
1 SEX M
0 TRLR
`);
  const plan = planImport(parsed);
  assert.equal(plan.persons.length, 2);
  const ahmed = plan.persons[0];
  assert.equal(ahmed.firstName, "Ahmed");
  assert.equal(ahmed.lastName, "Raza");
  assert.equal(ahmed.gender, "m");
  assert.equal(ahmed.living, false);
  assert.equal(ahmed.deathDateText, "2020");
  const bilal = plan.persons[1];
  assert.equal(bilal.living, true);
  assert.equal(plan.stats.living, 1);
  assert.equal(plan.stats.deceased, 1);
  assert.equal(plan.stats.earliestYear, 1952);
  assert.equal(plan.stats.latestYear, 2020);
});

test("plans unions: marriage status, single-parent families", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Ahmed /Raza/
0 @I2@ INDI
1 NAME Zainab /Raza/
0 @I3@ INDI
1 NAME Bilal /Raza/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 1980
1 CHIL @I3@
0 @F2@ FAM
1 WIFE @I2@
1 CHIL @I3@
0 TRLR
`);
  const plan = planImport(parsed);
  assert.equal(plan.unions.length, 2);
  const married = plan.unions.find((u) => u.localId === "@F1@");
  assert.equal(married?.status, "married");
  assert.equal(married?.partnerAId, "@I1@");
  assert.equal(married?.partnerBId, "@I2@");
  assert.equal(married?.dateText, "1980");
  const single = plan.unions.find((u) => u.localId === "@F2@");
  assert.equal(single?.partnerAId, "@I2@");
  assert.equal(single?.partnerBId, null);
  assert.equal(single?.status, null); // no MARR evidence
  // Bilal links to both unions (biological + the single-parent one)
  assert.equal(plan.links.length, 2);
  assert.equal(plan.stats.parentChildLinks, 2);
});

test("family with no parents: union skipped, child links skipped with warning", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Orphan /Child/
0 @F1@ FAM
1 CHIL @I1@
0 TRLR
`);
  const plan = planImport(parsed);
  assert.equal(plan.unions.length, 0);
  assert.equal(plan.links.length, 0);
  assert.ok(
    plan.warnings.some((w) => w.includes("@F1@") && w.includes("skipped")),
  );
});

test("divorced family status", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME A /B/
0 @I2@ INDI
1 NAME C /D/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 DIV
0 TRLR
`);
  const plan = planImport(parsed);
  assert.equal(plan.unions[0].status, "divorced");
});

test("pedigree collapse: one individual referenced by two families stays one person", () => {
  // Grandfather appears as child in F1 and husband in F2 — classic collapse.
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Grandpa /Khan/
0 @I2@ INDI
1 NAME Grandma /Khan/
0 @I3@ INDI
1 Name Father /Khan/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 @F2@ FAM
1 HUSB @I3@
1 CHIL @I4@
0 TRLR
`);
  const plan = planImport(parsed);
  // @I4@ is dangling (not declared) — its link is dropped with a warning
  assert.equal(plan.persons.length, 3);
  assert.equal(plan.links.length, 1);
});

test("cycle: a person declared as their own ancestor gets the link dropped", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Loop /Khan/
0 @I2@ INDI
1 Name Other /Khan/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I1@
0 TRLR
`);
  const plan = planImport(parsed);
  assert.equal(plan.links.length, 0);
  assert.ok(plan.warnings.some((w) => w.includes("loop")));
  // persons and the union survive
  assert.equal(plan.persons.length, 2);
  assert.equal(plan.unions.length, 1);
});

test("fam.link MEMORY: notes round-trip into memories, plain notes stay notes", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME A /B/
1 NOTE MEMORY: Her rotis were legendary (Eid 1994) — remembered by Farida
2 CONT second line of the memory
1 NOTE A plain note line
0 TRLR
`);
  const plan = planImport(parsed);
  const p = plan.persons[0];
  assert.equal(p.memories.length, 1);
  assert.equal(
    p.memories[0].body,
    "Her rotis were legendary (Eid 1994) — remembered by Farida\nsecond line of the memory",
  );
  assert.equal(p.notes, "A plain note line");
  assert.equal(plan.stats.memories, 1);
});

test("unnamed individuals are counted and warned about (unknown placeholders)", () => {
  const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME //
0 TRLR
`);
  const plan = planImport(parsed);
  assert.equal(plan.persons[0].firstName, null);
  assert.equal(plan.persons[0].lastName, null);
  assert.equal(plan.stats.unnamed, 1);
  assert.ok(plan.warnings.some((w) => w.includes("no name")));
});

// ---------------------------------------------------------------------------
// The crown jewel: fam.link's own export re-imports losslessly (structure).
// ---------------------------------------------------------------------------

function demoInput(): GedcomInput {
  return {
    treeName: "Round-trip family",
    persons: [
      {
        id: "p1",
        firstName: "Ali",
        lastName: "Raza",
        gender: "m",
        living: true,
        birthDateText: "c. 1989",
        birthPlace: "Karachi",
        deathDateText: null,
        deathPlace: null,
        notes: "Loves cricket.\nSecond line.",
        memories: [
          { body: "Flew a kite off the roof", occurredText: "Basant 1995", authorName: "Sara" },
        ],
      },
      {
        id: "p2",
        firstName: "Ahmed",
        lastName: "Raza",
        gender: "m",
        living: false,
        birthDateText: "1952",
        birthPlace: "Lahore",
        deathDateText: "2020",
        deathPlace: "Multan",
        notes: null,
        memories: [],
      },
      {
        id: "p3",
        firstName: null,
        lastName: null,
        gender: null,
        living: true,
        birthDateText: null,
        birthPlace: null,
        deathDateText: null,
        deathPlace: null,
        notes: null,
        memories: [],
      },
    ],
    unions: [
      { id: "u1", partnerAId: "p2", partnerBId: "p3", status: "married", dateText: "1980", placeText: "Lahore" },
      { id: "u2", partnerAId: "p1", partnerBId: null, status: null, dateText: null, placeText: null },
    ],
    links: [{ unionId: "u1", childId: "p1" }],
  };
}

test("round-trip: writeGedcom → parseGedcom → planImport preserves the tree", () => {
  const text = writeGedcom(demoInput());
  const plan = planImport(parseGedcom(text));

  assert.equal(plan.stats.individuals, 3);
  assert.equal(plan.stats.unionsPlanned, 2);
  assert.equal(plan.stats.parentChildLinks, 1);
  assert.equal(plan.stats.memories, 1);
  assert.deepEqual(
    plan.warnings.filter((w) => w.includes("no name")),
    ["1 person(s) have no name in the file — they'll appear as unknown placeholders (you can name them later)."],
  );

  const byName = new Map(plan.persons.map((p) => [`${p.firstName} ${p.lastName}`, p]));
  const ali = byName.get("Ali Raza");
  assert.ok(ali);
  assert.equal(ali.gender, "m");
  assert.equal(ali.living, true);
  assert.equal(ali.birthDateText, "c. 1989");
  assert.equal(ali.birthPlace, "Karachi");
  assert.equal(ali.notes, "Loves cricket.\nSecond line.");
  assert.equal(ali.memories.length, 1);
  assert.match(ali.memories[0].body, /Flew a kite off the roof/);
  assert.match(ali.memories[0].body, /remembered by Sara/);

  const ahmed = byName.get("Ahmed Raza");
  assert.ok(ahmed);
  assert.equal(ahmed.living, false);
  assert.equal(ahmed.deathDateText, "2020");
  assert.equal(ahmed.deathPlace, "Multan");

  // union structure: married 1980 Lahore, child Ali
  const married = plan.unions.find((u) => u.status === "married");
  assert.ok(married);
  assert.equal(married.dateText, "1980");
  assert.equal(married.placeText, "Lahore");
  const partners = [married.partnerAId, married.partnerBId].sort();
  assert.deepEqual(partners, [
    plan.persons.find((p) => p.firstName === "Ahmed")!.localId,
    plan.persons.find((p) => p.firstName === null)!.localId,
  ].sort());
  assert.deepEqual(
    plan.links.map((l) => l.childLocalId),
    [plan.persons.find((p) => p.firstName === "Ali")!.localId],
  );
});
