/**
 * Family book (issue #39) — pure data aggregation for the keepsake PDF
 * and print view. Privacy is structural: living persons are omitted or
 * redacted HERE, so no rendering path can leak them.
 */

export type LivingMode = "include" | "omit" | "redact";

export interface BookPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  alsoKnownAs: string | null;
  living: boolean;
  gender: string | null;
  birthDateText: string | null;
  deathDateText: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  notes: string | null;
  photoMediaId: string | null;
  /** Generation from the focus person (0 = focus). */
  generation: number;
  relation: string | null;
}

export interface BookEvent {
  id: string;
  personId: string;
  kind: string;
  dateText: string | null;
  placeText: string | null;
  note: string | null;
}

export interface BookMemory {
  id: string;
  personId: string;
  kind: string;
  body: string;
  occurredText: string | null;
  authorName: string | null;
  mediaId: string | null;
  /** Voice-clip length in seconds, when known. */
  durationSeconds: number | null;
}

export interface BookInput {
  treeName: string;
  focusPersonId: string | null;
  persons: BookPerson[];
  events: BookEvent[];
  memories: BookMemory[];
  livingMode: LivingMode;
}

export interface BookPersonSection {
  id: string;
  displayName: string;
  redacted: boolean;
  generation: number;
  relation: string | null;
  photoMediaId: string | null;
  facts: [string, string][];
  lifeLine: string | null;
  notes: string | null;
  events: BookEvent[];
  memories: BookMemory[];
}

export interface Book {
  title: string;
  includeLiving: boolean;
  stats: {
    totalPersons: number;
    livingIncluded: number;
    memorizedPersons: number;
    memories: number;
    voiceMemories: number;
    photoMemories: number;
    generations: number;
  };
  chapters: { generation: number; sections: BookPersonSection[] }[];
  timeline: { dateText: string; text: string }[];
}

export function personDisplayName(p: BookPerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed";
}

function factList(p: BookPerson): [string, string][] {
  const facts: [string, string][] = [];
  if (p.alsoKnownAs) facts.push(["Known as", p.alsoKnownAs]);
  if (p.birthDateText || p.birthPlace)
    facts.push(["Born", [p.birthDateText, p.birthPlace].filter(Boolean).join(" · ")]);
  if (p.deathDateText || p.deathPlace)
    facts.push(["Died", [p.deathDateText, p.deathPlace].filter(Boolean).join(" · ")]);
  return facts;
}

function lifeLine(p: BookPerson): string | null {
  const birth = [p.birthDateText, p.birthPlace].filter(Boolean).join(" · ");
  const death = [p.deathDateText, p.deathPlace].filter(Boolean).join(" · ");
  const line = [birth, death].filter(Boolean).join(" — ");
  return line || null;
}

/**
 * Build the whole book. Redacted living persons keep their slot in the
 * line (the structure survives) with every identifying detail stripped;
 * omitted ones vanish entirely.
 */
export function buildBook(input: BookInput): Book {
  const { livingMode } = input;
  const persons =
    livingMode === "omit" ? input.persons.filter((p) => !p.living) : input.persons;

  const eventsByPerson = new Map<string, BookEvent[]>();
  for (const e of input.events) {
    const list = eventsByPerson.get(e.personId) ?? [];
    list.push(e);
    eventsByPerson.set(e.personId, list);
  }
  const memoriesByPerson = new Map<string, BookMemory[]>();
  for (const m of input.memories) {
    const list = memoriesByPerson.get(m.personId) ?? [];
    list.push(m);
    memoriesByPerson.set(m.personId, list);
  }

  const sections: BookPersonSection[] = persons.map((p) => {
    const redacted = livingMode === "redact" && p.living;
    if (redacted) {
      return {
        id: p.id,
        displayName: "A living relative",
        redacted: true,
        generation: p.generation,
        relation: p.relation,
        photoMediaId: null,
        facts: [["Status", "Living — details kept private"]] as [string, string][],
        lifeLine: null,
        notes: null,
        events: [],
        memories: [],
      };
    }
    return {
      id: p.id,
      displayName: personDisplayName(p),
      redacted: false,
      generation: p.generation,
      relation: p.relation,
      photoMediaId: p.photoMediaId,
      facts: factList(p),
      lifeLine: lifeLine(p),
      notes: p.notes,
      events: eventsByPerson.get(p.id) ?? [],
      memories: memoriesByPerson.get(p.id) ?? [],
    };
  });

  sections.sort(
    (a, b) => a.generation - b.generation || a.displayName.localeCompare(b.displayName),
  );

  const generations = [...new Set(sections.map((s) => s.generation))].sort((a, b) => a - b);
  const chapters = generations.map((g) => ({
    generation: g,
    sections: sections.filter((s) => s.generation === g),
  }));

  const timeline = input.events
    .filter((e) => {
      const person = persons.find((p) => p.id === e.personId);
      return person && !(livingMode === "redact" && person.living);
    })
    .map((e) => {
      const person = persons.find((p) => p.id === e.personId)!;
      return {
        dateText: e.dateText ?? "Undated",
        text: `${personDisplayName(person)} — ${e.kind}${e.placeText ? ` · ${e.placeText}` : ""}${e.note ? ` · ${e.note}` : ""}`,
      };
    })
    .slice(0, 120);

  return {
    title: input.treeName,
    includeLiving: livingMode !== "omit",
    stats: {
      totalPersons: sections.length,
      livingIncluded: sections.filter(
        (s) => !s.redacted && persons.find((p) => p.id === s.id)?.living,
      ).length,
      memorizedPersons: new Set(input.memories.map((m) => m.personId)).size,
      memories: input.memories.length,
      voiceMemories: input.memories.filter((m) => m.kind === "voice").length,
      photoMemories: input.memories.filter((m) => m.kind === "photo").length,
      generations: generations.length,
    },
    chapters,
    timeline,
  };
}

/** The filename the download gets: "raza-khan-family-book.pdf". */
export function bookFileName(treeName: string): string {
  const slug = treeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "family"}-book.pdf`;
}
