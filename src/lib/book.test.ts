import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bookFileName,
  buildBook,
  personDisplayName,
  type BookEvent,
  type BookMemory,
  type BookPerson,
} from "./book.ts";

const P = (id: string, over: Partial<BookPerson> = {}): BookPerson => ({
  id,
  firstName: id,
  lastName: null,
  alsoKnownAs: null,
  living: false,
  gender: null,
  birthDateText: null,
  deathDateText: null,
  birthPlace: null,
  deathPlace: null,
  notes: null,
  photoMediaId: null,
  generation: 0,
  relation: null,
  ...over,
});

const E = (id: string, personId: string, over: Partial<BookEvent> = {}): BookEvent => ({
  id,
  personId,
  kind: "birth",
  dateText: "1947",
  placeText: null,
  note: null,
  ...over,
});

const M = (id: string, personId: string, over: Partial<BookMemory> = {}): BookMemory => ({
  id,
  personId,
  kind: "text",
  body: `story-${id}`,
  occurredText: null,
  authorName: "Nusrat",
  mediaId: null,
  durationSeconds: null,
  ...over,
});

describe("family book", () => {
  it("personDisplayName falls back to Unnamed", () => {
    assert.equal(personDisplayName(P("a", { firstName: "Yusuf", lastName: "Khan" })), "Yusuf Khan");
    assert.equal(personDisplayName(P("b", { firstName: null })), "Unnamed");
  });

  it("include mode keeps living persons with full details", () => {
    const book = buildBook({
      treeName: "Khan",
      focusPersonId: null,
      persons: [P("elder"), P("jr", { living: true, birthDateText: "1990" })],
      events: [],
      memories: [],
      livingMode: "include",
    });
    const jr = book.chapters[0]!.sections.find((s) => s.id === "jr")!;
    assert.equal(jr.redacted, false);
    assert.deepEqual(jr.facts, [["Born", "1990"]]);
    assert.equal(book.stats.livingIncluded, 1);
  });

  it("redact mode strips living persons but keeps their slot", () => {
    const book = buildBook({
      treeName: "Khan",
      focusPersonId: null,
      persons: [
        P("elder"),
        P("jr", { living: true, birthDateText: "1990", birthPlace: "Lahore", photoMediaId: "ph" }),
      ],
      events: [E("e1", "jr", { dateText: "2010" })],
      memories: [M("m1", "jr")],
      livingMode: "redact",
    });
    const jr = book.chapters[0]!.sections.find((s) => s.id === "jr")!;
    assert.equal(jr.redacted, true);
    assert.equal(jr.displayName, "A living relative");
    assert.equal(jr.photoMediaId, null);
    assert.deepEqual(jr.facts, [["Status", "Living — details kept private"]]);
    assert.equal(jr.events.length, 0);
    assert.equal(jr.memories.length, 0);
    // structure intact — both appear
    assert.equal(book.stats.totalPersons, 2);
    // timeline hides living entries in redact mode
    assert.equal(book.timeline.length, 0);
  });

  it("omit mode removes living persons entirely", () => {
    const book = buildBook({
      treeName: "Khan",
      focusPersonId: null,
      persons: [P("elder"), P("jr", { living: true })],
      events: [E("e1", "jr")],
      memories: [],
      livingMode: "omit",
    });
    assert.equal(book.stats.totalPersons, 1);
    assert.ok(!book.chapters[0]!.sections.some((s) => s.id === "jr"));
    assert.equal(book.includeLiving, false);
  });

  it("chapters group by generation and stats count media kinds", () => {
    const book = buildBook({
      treeName: "Khan",
      focusPersonId: null,
      persons: [P("g0"), P("g1", { generation: 1 }), P("g2", { generation: 1 })],
      events: [],
      memories: [M("m1", "g0"), M("m2", "g0", { kind: "voice", durationSeconds: 30 }), M("m3", "g1", { kind: "photo" })],
      livingMode: "omit",
    });
    assert.equal(book.chapters.length, 2);
    assert.deepEqual(book.chapters.map((c) => c.generation), [0, 1]);
    assert.equal(book.stats.generations, 2);
    assert.equal(book.stats.memories, 3);
    assert.equal(book.stats.voiceMemories, 1);
    assert.equal(book.stats.photoMemories, 1);
    assert.equal(book.stats.memorizedPersons, 2);
  });

  it("bookFileName slugs the tree name", () => {
    assert.equal(bookFileName("The Raza–Khan family"), "the-raza-khan-family-book.pdf");
    assert.equal(bookFileName("…"), "family-book.pdf");
  });
});
