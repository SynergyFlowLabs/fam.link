import test from "node:test";
import assert from "node:assert/strict";
import { parseGedcom, splitGedcomName } from "./parse.ts";

const MINIMAL = `0 HEAD
1 CHAR UTF-8
1 SOUR TESTAPP
0 @I1@ INDI
1 NAME Zainab /Khan/
1 SEX F
1 BIRT
2 DATE 1930
2 PLAC Multan
1 DEAT
2 DATE 2010
0 @I2@ INDI
1 NAME Ahmed /Khan/
1 SEX M
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I1@
1 MARR
2 DATE 1955
2 PLAC Lahore
1 CHIL @I3@
0 TRLR
`;

test("parses HEAD metadata", () => {
  const p = parseGedcom(MINIMAL);
  assert.equal(p.charSet, "UTF-8");
  assert.equal(p.source, "TESTAPP");
});

test("parses individuals with events", () => {
  const p = parseGedcom(MINIMAL);
  assert.equal(p.individuals.length, 2);
  const z = p.individuals[0];
  assert.equal(z.nameRaw, "Zainab /Khan/");
  assert.equal(z.gender, "f");
  assert.equal(z.birthDateText, "1930");
  assert.equal(z.birthPlace, "Multan");
  assert.equal(z.deathDateText, "2010");
  assert.equal(z.hasDeathEvent, true);
  const a = p.individuals[1];
  assert.equal(a.hasDeathEvent, false);
  assert.equal(a.birthDateText, null);
});

test("parses families with partners, marriage, children", () => {
  const p = parseGedcom(MINIMAL);
  assert.equal(p.families.length, 1);
  const f = p.families[0];
  assert.equal(f.husbandXref, "@I2@");
  assert.equal(f.wifeXref, "@I1@");
  // @I3@ is referenced as a child but never declared — dropped (warning below)
  assert.deepEqual(f.childXrefs, []);
  assert.equal(f.marriageDateText, "1955");
  assert.equal(f.marriagePlaceText, "Lahore");
  assert.equal(f.divorced, false);
  // dangling child ref @I3@ is dropped with a warning
  assert.ok(
    p.warnings.some((w) => w.includes("@F1@") && w.includes("missing child")),
  );
});

test("CONT and CONC join notes correctly", () => {
  const p = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME A /B/
1 NOTE first line
2 CONT second line
2 CONC glued
0 TRLR
`);
  assert.deepEqual(p.individuals[0].notes, ["first line\nsecond lineglued"]);
});

test("bare 1 DEAT Y means deceased", () => {
  const p = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME A /B/
1 DEAT Y
0 TRLR
`);
  assert.equal(p.individuals[0].hasDeathEvent, true);
  assert.equal(p.individuals[0].deathDateText, null);
});

test("duplicate xrefs are skipped with a warning", () => {
  const p = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME A /B/
0 @I1@ INDI
1 NAME C /D/
0 TRLR
`);
  assert.equal(p.individuals.length, 1);
  assert.ok(p.warnings.some((w) => w.includes("Duplicate individual")));
});

test("divorce flag is captured", () => {
  const p = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME A /B/
0 @I2@ INDI
1 NAME C /D/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 DIV
2 DATE 1990
0 TRLR
`);
  assert.equal(p.families[0].divorced, true);
});

test("CRLF and BOM are tolerated", () => {
  const text = "\uFEFF0 HEAD\r\n0 @I1@ INDI\r\n1 NAME A /B/\r\n0 TRLR\r\n";
  const p = parseGedcom(text);
  assert.equal(p.individuals.length, 1);
  assert.equal(p.individuals[0].nameRaw, "A /B/");
});

test("multiple NAME lines keep the first and warn", () => {
  const p = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Mary /Smith/
1 NAME Mary /Jones/
0 TRLR
`);
  assert.equal(p.individuals[0].nameRaw, "Mary /Smith/");
  assert.equal(p.individuals[0].altNames.length, 1);
  assert.ok(p.warnings.some((w) => w.includes("names")));
});

test("splitGedcomName shapes", () => {
  assert.deepEqual(splitGedcomName("Zainab /Khan/"), { first: "Zainab", last: "Khan" });
  assert.deepEqual(splitGedcomName("John /Smith/ Jr."), { first: "John Jr.", last: "Smith" });
  assert.deepEqual(splitGedcomName("/OnlySurname/"), { first: null, last: "OnlySurname" });
  assert.deepEqual(splitGedcomName("NoSlashes"), { first: "NoSlashes", last: null });
  assert.deepEqual(splitGedcomName(null), { first: null, last: null });
  assert.deepEqual(splitGedcomName("  "), { first: null, last: null });
});
