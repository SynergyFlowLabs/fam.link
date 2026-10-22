import test from "node:test";
import assert from "node:assert/strict";
import { writeGedcom, type GedcomInput } from "./writer.ts";

function baseInput(): GedcomInput {
  return {
    treeName: "Test family",
    persons: [
      {
        id: "child",
        firstName: "Ali",
        lastName: "Raza",
        gender: "m",
        living: true,
        birthDateText: "c. 1989",
        birthPlace: "Karachi",
        deathDateText: null,
        deathPlace: null,
        notes: null,
        memories: [],
      },
      {
        id: "dad",
        firstName: "Ahmed",
        lastName: "Raza",
        gender: "m",
        living: false,
        birthDateText: "1952",
        birthPlace: "Lahore",
        deathDateText: "2020",
        deathPlace: null,
        notes: "Kept a pocket watch from Amritsar.",
        memories: [
          { body: "Called everyone by name.", occurredText: "summers", authorName: "Ali" },
        ],
      },
      {
        id: "mom",
        firstName: "Farida",
        lastName: null,
        gender: "f",
        living: true,
        birthDateText: null,
        birthPlace: null,
        deathDateText: null,
        deathPlace: null,
        notes: null,
        memories: [],
      },
    ],
    unions: [{ id: "u1", partnerAId: "dad", partnerBId: "mom", status: "married", dateText: "1979", placeText: null }],
    links: [{ unionId: "u1", childId: "child" }],
  };
}

test("well-formed document: HEAD, records, TRLR", () => {
  const g = writeGedcom(baseInput());
  const lines = g.split("\n");
  assert.equal(lines[0], "0 HEAD");
  assert.equal(lines[lines.length - 2], "0 TRLR");
  assert.ok(g.includes("2 VERS 5.5.1"));
  assert.ok(g.includes("1 CHAR UTF-8"));
});

test("individuals: names, sex, fuzzy dates, places", () => {
  const g = writeGedcom(baseInput());
  assert.ok(g.includes("1 NAME Ali /Raza/"));
  assert.ok(g.includes("1 SEX M"));
  assert.ok(g.includes("2 DATE c. 1989")); // fuzzy date survives verbatim
  assert.ok(g.includes("2 PLAC Karachi"));
  assert.ok(g.includes("1 NAME Ahmed /Raza/"));
  assert.ok(g.includes("1 DEAT"));
  assert.ok(g.includes("2 DATE 2020"));
});

test("family: husband, wife, child cross-references resolve", () => {
  const g = writeGedcom(baseInput());
  const lines = g.split("\n");
  const husb = lines.find((l) => l.startsWith("1 HUSB "));
  const wife = lines.find((l) => l.startsWith("1 WIFE "));
  const chil = lines.find((l) => l.startsWith("1 CHIL "));
  assert.ok(husb && wife && chil);
  // the child xref must point at an existing INDI record for "child"
  const childXref = chil.split(" ")[2];
  const indiLine = lines.find((l) => l.startsWith(`0 ${childXref} INDI`));
  assert.ok(indiLine, "CHIL xref resolves to an INDI");
  assert.ok(g.includes("1 MARR"));
  assert.ok(g.includes("2 DATE 1979"));
});

test("notes and memories export as NOTE lines", () => {
  const g = writeGedcom(baseInput());
  assert.ok(g.includes("1 NOTE Kept a pocket watch from Amritsar."));
  assert.ok(g.includes("1 NOTE MEMORY: Called everyone by name. (summers) — remembered by Ali"));
});

test("unknown persons are legal: empty name parts", () => {
  const input = baseInput();
  input.persons.push({
    id: "unknown",
    firstName: null,
    lastName: null,
    gender: null,
    living: false,
    birthDateText: "c. 1885",
    birthPlace: null,
    deathDateText: null,
    deathPlace: null,
    notes: null,
    memories: [],
  });
  const g = writeGedcom(input);
  assert.ok(g.includes("1 NAME  //"));
  assert.ok(g.includes("2 DATE c. 1885"));
});

test("single-parent family: no WIFE line when partnerB is null", () => {
  const input = baseInput();
  input.unions = [{ id: "u1", partnerAId: "mom", partnerBId: null, status: null, dateText: null, placeText: null }];
  const g = writeGedcom(input);
  assert.ok(!g.includes("1 WIFE"));
  assert.ok(g.includes("1 HUSB"));
});

test("multi-line notes use CONT continuation", () => {
  const input = baseInput();
  input.persons[0].notes = "line one\nline two";
  const g = writeGedcom(input);
  assert.ok(g.includes("1 NOTE line one"));
  assert.ok(g.includes("2 CONT line two"));
});

test("unicode names survive (UTF-8)", () => {
  const input = baseInput();
  input.persons[0].firstName = "زینب";
  input.persons[0].lastName = "خان";
  const g = writeGedcom(input);
  assert.ok(g.includes("1 NAME زینب /خان/"));
});
