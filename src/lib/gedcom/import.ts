/**
 * GEDCOM import planner — turns a parsed file into the exact rows that will
 * be inserted, with every skip and caveat surfaced as a warning. The review
 * screen shows this plan; nothing touches the database until the owner
 * confirms. (Product brief: "import as a review workflow, never a blind
 * overwrite".)
 *
 * Invariant kept: one GEDCOM individual = one person row (xrefs are deduped
 * in the parser), so pedigree collapse inside the file survives import. The
 * internal model stays richer than GEDCOM — fam.link's own "MEMORY: " notes
 * written by the exporter round-trip back into real memories.
 */

import { splitGedcomName, type ParsedGedcom } from "./parse.ts";

export interface PlanEvent {
  kind: "birth" | "death" | "marriage" | "divorce" | "relocation" | "custom";
  dateText: string | null;
  placeText: string | null;
  note: string | null;
  source: string | null;
}

export interface PlanPerson {
  /** GEDCOM xref — unique within this plan, mapped to a UUID on insert. */
  localId: string;
  firstName: string | null;
  lastName: string | null;
  gender: "m" | "f" | "x" | null;
  living: boolean;
  birthDateText: string | null;
  birthPlace: string | null;
  deathDateText: string | null;
  deathPlace: string | null;
  notes: string | null;
  /** fam.link round-trip: NOTEs the exporter wrote as "MEMORY: …". */
  memories: { body: string }[];
  /** Life events (person_events) — round-tripped via EVEN. */
  events: PlanEvent[];
}

export interface PlanUnion {
  localId: string;
  partnerAId: string;
  partnerBId: string | null;
  status: "married" | "partners" | "divorced" | null;
  dateText: string | null;
  placeText: string | null;
}

export interface PlanLink {
  unionLocalId: string;
  childLocalId: string;
}

export interface ImportStats {
  individuals: number;
  families: number;
  unionsPlanned: number;
  parentChildLinks: number;
  living: number;
  deceased: number;
  unnamed: number;
  memories: number;
  events: number;
  earliestYear: number | null;
  latestYear: number | null;
}

export interface ImportPlan {
  persons: PlanPerson[];
  unions: PlanUnion[];
  links: PlanLink[];
  stats: ImportStats;
  warnings: string[];
}

const MEMORY_PREFIX = "MEMORY: ";

/** Rough year for the date-span stat: first 3-4 digit group in the text. */
function roughYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /\b(\d{3,4})\b/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 100 && n <= 2100 ? n : null;
}

export function planImport(parsed: ParsedGedcom): ImportPlan {
  const warnings = [...parsed.warnings];

  // --- persons ---------------------------------------------------------------
  const normalizeEventKind = (raw: string | null): PlanEvent["kind"] => {
    if (!raw) return "custom";
    const k = raw.trim().toLowerCase();
    if (k === "birth" || k === "birt") return "birth";
    if (k === "death" || k === "deat" || k === "died") return "death";
    if (k === "marriage" || k === "married" || k === "marr") return "marriage";
    if (k === "divorce" || k === "divorced" || k === "div") return "divorce";
    if (k === "relocation" || k === "move" || k === "moved" || k === "residence" || k === "resi") return "relocation";
    return "custom";
  };
  const clamp = (v: string | null, max: number): string | null => {
    if (!v) return null;
    const t = v.trim();
    if (!t) return null;
    return t.length > max ? t.slice(0, max).trim() : t;
  };
  const persons: PlanPerson[] = parsed.individuals.map((indi) => {
    const { first, last } = splitGedcomName(indi.nameRaw);
    const memoryNotes: string[] = [];
    const plainNotes: string[] = [];
    for (const note of indi.notes) {
      if (note.startsWith(MEMORY_PREFIX)) {
        memoryNotes.push(note.slice(MEMORY_PREFIX.length).trim());
      } else {
        plainNotes.push(note);
      }
    }
    const events: PlanEvent[] = (indi.events ?? []).map((ev) => ({
      kind: normalizeEventKind(ev.kind),
      dateText: clamp(ev.dateText, 200),
      placeText: clamp(ev.placeText, 200),
      note: clamp(ev.note, 2000),
      source: clamp(ev.source, 500),
    }));
    return {
      localId: indi.xref,
      firstName: first,
      lastName: last,
      gender: indi.gender,
      living: !indi.hasDeathEvent,
      birthDateText: indi.birthDateText,
      birthPlace: indi.birthPlace,
      deathDateText: indi.deathDateText,
      deathPlace: indi.deathPlace,
      notes: plainNotes.length > 0 ? plainNotes.join("\n\n") : null,
      memories: memoryNotes
        .filter((m) => m !== "")
        .map((body) => ({ body })),
      events,
    };
  });

  const personByLocalId = new Map(persons.map((p) => [p.localId, p]));

  // --- unions ------------------------------------------------------------------
  const unions: PlanUnion[] = [];
  const skippedChildLinks = new Map<string, number>(); // family xref -> skipped count
  for (const fam of parsed.families) {
    const a = fam.husbandXref ?? fam.wifeXref;
    const b = fam.husbandXref !== null && fam.wifeXref !== null ? fam.wifeXref : null;
    if (!a || !personByLocalId.has(a)) {
      // No importable partner: a union needs at least one partner.
      if (fam.childXrefs.length > 0) skippedChildLinks.set(fam.xref, fam.childXrefs.length);
      continue;
    }
    if (b !== null && !personByLocalId.has(b)) {
      skippedChildLinks.set(fam.xref, fam.childXrefs.length);
      continue; // defensive — parser already nulls dangling refs
    }
    const status: PlanUnion["status"] = fam.divorced
      ? "divorced"
      : fam.marriageDateText || fam.marriagePlaceText
        ? "married"
        : null;
    unions.push({
      localId: fam.xref,
      partnerAId: a,
      partnerBId: b,
      status,
      dateText: fam.marriageDateText,
      placeText: fam.marriagePlaceText,
    });
  }
  for (const [famXref, count] of skippedChildLinks) {
    warnings.push(
      `Family ${famXref} has no importable parents — its ${count} child link(s) were skipped.`,
    );
  }

  // --- parent-child links (with DAG guard) ---------------------------------------
  const unionByLocalId = new Map(unions.map((u) => [u.localId, u]));
  let links: PlanLink[] = [];
  for (const fam of parsed.families) {
    const union = unionByLocalId.get(fam.xref);
    if (!union) continue;
    for (const childXref of fam.childXrefs) {
      if (!personByLocalId.has(childXref)) continue; // parser warned already
      links.push({ unionLocalId: fam.xref, childLocalId: childXref });
    }
  }
  // A malformed file can declare someone their own ancestor. fam.link's graph
  // is a DAG — drop links that participate in cycles, with a warning.
  const cyclic = findCyclicLinks(unions, links);
  if (cyclic.size > 0) {
    links = links.filter((l) => !cyclic.has(`${l.unionLocalId}→${l.childLocalId}`));
    warnings.push(
      `${cyclic.size} parent-child link(s) formed a loop in the file (someone as their own ancestor) and were skipped.`,
    );
  }

  // --- stats ----------------------------------------------------------------------
  const years = persons
    .flatMap((p) => [roughYear(p.birthDateText), roughYear(p.deathDateText)])
    .filter((y): y is number => y !== null)
    .sort((x, y) => x - y);

  const stats: ImportStats = {
    individuals: persons.length,
    families: parsed.families.length,
    unionsPlanned: unions.length,
    parentChildLinks: links.length,
    living: persons.filter((p) => p.living).length,
    deceased: persons.filter((p) => !p.living).length,
    unnamed: persons.filter((p) => !p.firstName && !p.lastName).length,
    memories: persons.reduce((n, p) => n + p.memories.length, 0),
    events: persons.reduce((n, p) => n + p.events.length, 0),
    earliestYear: years.length > 0 ? years[0] : null,
    latestYear: years.length > 0 ? years[years.length - 1] : null,
  };

  if (stats.unnamed > 0) {
    warnings.push(
      `${stats.unnamed} person(s) have no name in the file — they'll appear as unknown placeholders (you can name them later).`,
    );
  }

  return { persons, unions, links, stats, warnings };
}

/**
 * Links (union→child) that participate in parent→child cycles. In fam.link's
 * DAG a person can never be their own ancestor; a malformed GEDCOM can claim
 * it. Strategy: build child→parent edges (a link contributes child→partnerA
 * and child→partnerB), find strongly connected components; any edge whose
 * endpoints share an SCC lies on a cycle. A link is cyclic if any of its
 * edges is. (May over-drop slightly in pathological files — the warning on
 * the review screen covers it, and the alternative is a corrupt tree.)
 */
function findCyclicLinks(
  unions: PlanUnion[],
  links: PlanLink[],
): Set<string> {
  const partnersOf = new Map<string, [string, string | null]>();
  for (const u of unions) partnersOf.set(u.localId, [u.partnerAId, u.partnerBId]);

  // child -> set of parent person ids
  const edges = new Map<string, Set<string>>();
  const linkEdges = new Map<string, [child: string, parent: string][]>();
  for (const l of links) {
    const partners = partnersOf.get(l.unionLocalId);
    if (!partners) continue;
    const [a, b] = partners;
    const list: [string, string][] = [[l.childLocalId, a]];
    if (b !== null) list.push([l.childLocalId, b]);
    linkEdges.set(`${l.unionLocalId}→${l.childLocalId}`, list);
    for (const [child, parent] of list) {
      const set = edges.get(child) ?? new Set<string>();
      set.add(parent);
      edges.set(child, set);
    }
  }

  // Tarjan SCC over the child→parent graph.
  const nodes = new Set<string>([...edges.keys()]);
  for (const targets of edges.values()) for (const t of targets) nodes.add(t);
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccOf = new Map<string, number>();
  let sccCount = 0;

  const strongconnect = (v: string) => {
    // Iterative DFS to survive deep ancestries without blowing the stack.
    const frames: { node: string; iter: Iterator<string> }[] = [];
    indices.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    const push = (n: string) => {
      frames.push({ node: n, iter: (edges.get(n) ?? new Set<string>())[Symbol.iterator]() });
    };
    push(v);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const next = frame.iter.next();
      if (next.done) {
        frames.pop();
        for (const w of edges.get(frame.node) ?? []) {
          if (onStack.has(w)) {
            low.set(frame.node, Math.min(low.get(frame.node) ?? 0, indices.get(w) ?? 0));
          }
        }
        if ((low.get(frame.node) ?? 0) === (indices.get(frame.node) ?? -1)) {
          let w: string;
          do {
            w = stack.pop() as string;
            onStack.delete(w);
            sccOf.set(w, sccCount);
          } while (w !== frame.node);
          sccCount++;
        }
        if (frames.length > 0) {
          const parentFrame = frames[frames.length - 1];
          low.set(
            parentFrame.node,
            Math.min(low.get(parentFrame.node) ?? 0, low.get(frame.node) ?? 0),
          );
        }
      } else {
        const w = next.value;
        if (!indices.has(w)) {
          indices.set(w, index);
          low.set(w, index);
          index++;
          stack.push(w);
          onStack.add(w);
          push(w);
        } else if (onStack.has(w)) {
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, indices.get(w) ?? 0));
        }
      }
    }
  };
  for (const n of nodes) {
    if (!indices.has(n)) strongconnect(n);
  }

  const cyclic = new Set<string>();
  for (const [key, list] of linkEdges) {
    for (const [child, parent] of list) {
      if (sccOf.get(child) === sccOf.get(parent)) {
        cyclic.add(key);
        break;
      }
    }
  }
  return cyclic;
}
