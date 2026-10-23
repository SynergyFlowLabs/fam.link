/**
 * GEDCOM 5.5.1 parser — the incoming half of the no-lock-in promise.
 *
 * Pure function: GEDCOM text → individuals + families + warnings. Tolerant by
 * design: real-world files are full of spec violations, so unknown tags are
 * skipped quietly, recoverable oddities become warnings, and only structural
 * nonsense (a file with no individuals) is an error for the caller.
 *
 * fam.link keeps its model richer than GEDCOM: import is a guided review, and
 * what doesn't fit is reported on the review screen, never silently dropped.
 */

export interface ParsedIndividual {
  xref: string;
  /** Raw NAME payload, e.g. "Zainab /Khan/" — split later in planning. */
  nameRaw: string | null;
  /** NAME lines beyond the first (kept for warnings / future use). */
  altNames: string[];
  gender: "m" | "f" | "x" | null;
  birthDateText: string | null;
  birthPlace: string | null;
  deathDateText: string | null;
  deathPlace: string | null;
  /** Any 1 DEAT line exists (even "Y" with no date) → planner marks deceased. */
  hasDeathEvent: boolean;
  /** NOTE payloads (CONT/CONC already joined), "MEMORY: " prefix intact. */
  notes: string[];
  /** Generic 1 EVEN / 1 RESI … timeline entries (for fam.link person_events). */
  events: { kind: string | null; dateText: string | null; placeText: string | null; note: string | null; source: string | null }[];
}

export interface ParsedFamily {
  xref: string;
  husbandXref: string | null;
  wifeXref: string | null;
  childXrefs: string[];
  marriageDateText: string | null;
  marriagePlaceText: string | null;
  divorced: boolean;
}

export interface ParsedGedcom {
  charSet: string | null;
  source: string | null;
  individuals: ParsedIndividual[];
  families: ParsedFamily[];
  warnings: string[];
}

interface GedcomLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

const MAX_FILE_CHARS = 6_000_000; // callers cap bytes; this is a belt-and-braces guard

export function parseGedcom(text: string): ParsedGedcom {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
  if (text.length > MAX_FILE_CHARS) {
    throw new Error("This file is too large to import.");
  }

  const warnings: string[] = [];
  const rawLines = text.split(/\r\n|\r|\n/);

  // --- tokenize ---------------------------------------------------------------
  const lines: GedcomLine[] = [];
  let skippedLines = 0;
  for (const raw of rawLines) {
    if (raw.trim() === "") continue;
    const m = /^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/.exec(raw);
    if (!m) {
      skippedLines++;
      continue;
    }
    lines.push({
      level: Number(m[1]),
      xref: m[2] ?? null,
      tag: m[3].toUpperCase(),
      value: (m[4] ?? "").trim(),
    });
  }
  if (skippedLines > 0) {
    warnings.push(`${skippedLines} unreadable line(s) were skipped.`);
  }

  // --- walk records -------------------------------------------------------------
  const individuals: ParsedIndividual[] = [];
  const families: ParsedFamily[] = [];
  const seenIndi = new Set<string>();
  const seenFam = new Set<string>();
  let charSet: string | null = null;
  let source: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.level !== 0) continue;

    if (line.tag === "HEAD") {
      for (let j = i + 1; j < lines.length && lines[j].level > 0; j++) {
        const l = lines[j];
        if (l.level === 1 && l.tag === "CHAR" && l.value) charSet = l.value.toUpperCase();
        if (l.level === 1 && l.tag === "SOUR" && l.value) source = l.value;
      }
      continue;
    }
    if (line.tag === "TRLR") break;

    if (line.tag === "INDI" && line.xref) {
      const xref = line.xref;
      if (seenIndi.has(xref)) {
        warnings.push(`Duplicate individual ${xref} — the second copy was skipped.`);
        while (i + 1 < lines.length && lines[i + 1].level > 0) i++;
        continue;
      }
      seenIndi.add(xref);

      const indi: ParsedIndividual = {
        xref,
        nameRaw: null,
        altNames: [],
        gender: null,
        birthDateText: null,
        birthPlace: null,
        deathDateText: null,
        deathPlace: null,
        hasDeathEvent: false,
        notes: [],
        events: [],
      };
      // 1 BIRT / 1 DEAT open a nested event; 2 DATE / 2 PLAC fill it.
      // 1 NOTE opens a note; 2 CONT (newline) / 2 CONC (glued) extend it.
      let inEvent: "BIRT" | "DEAT" | null = null;
      let note: string | null = null;

      const flushNote = () => {
        if (note !== null && note.trim() !== "") indi.notes.push(note.trim());
        note = null;
      };

      let currentEvent: { kind: string | null; dateText: string | null; placeText: string | null; note: string | null; source: string | null } | null = null;
      const flushEvent = () => {
        if (currentEvent) {
          // Only keep events with something to show — at least kind or date/place/note/source
          if (currentEvent.kind || currentEvent.dateText || currentEvent.placeText || currentEvent.note || currentEvent.source) {
            indi.events.push({ ...currentEvent });
          }
          currentEvent = null;
        }
      };
      for (let j = i + 1; j < lines.length && lines[j].level > 0; j++) {
        const l = lines[j];
        if (l.level === 1) {
          flushNote();
          flushEvent();
          inEvent = null;
          switch (l.tag) {
            case "NAME":
              if (l.value) {
                if (indi.nameRaw === null) indi.nameRaw = l.value;
                else indi.altNames.push(l.value);
              }
              break;
            case "SEX": {
              const v = l.value.toUpperCase();
              indi.gender = v === "M" ? "m" : v === "F" ? "f" : v === "X" ? "x" : null;
              break;
            }
            case "BIRT":
              inEvent = "BIRT";
              break;
            case "DEAT":
              inEvent = "DEAT";
              indi.hasDeathEvent = true; // even "1 DEAT Y" with no dates
              break;
            case "EVEN":
              inEvent = "EVEN" as unknown as typeof inEvent;
              currentEvent = { kind: l.value || null, dateText: null, placeText: null, note: null, source: null };
              break;
            case "RESI":
              inEvent = "EVEN" as unknown as typeof inEvent;
              currentEvent = { kind: "relocation", dateText: null, placeText: l.value || null, note: null, source: null };
              break;
            case "OCCU":
            case "RELI":
            case "EDUC":
              inEvent = "EVEN" as unknown as typeof inEvent;
              currentEvent = { kind: "custom", dateText: null, placeText: null, note: l.value || null, source: null };
              break;
            case "NOTE":
              note = l.value;
              break;
            default:
              break;
          }
        } else if (l.level >= 2) {
          if (note !== null && (l.tag === "CONT" || l.tag === "CONC")) {
            note += (l.tag === "CONT" ? "\n" : "") + l.value;
          } else if (inEvent === "BIRT" && l.level === 2 && l.tag === "DATE" && l.value) {
            indi.birthDateText = l.value;
          } else if (inEvent === "BIRT" && l.level === 2 && l.tag === "PLAC" && l.value) {
            indi.birthPlace = l.value;
          } else if (inEvent === "DEAT" && l.level === 2 && l.tag === "DATE" && l.value) {
            indi.deathDateText = l.value;
          } else if (inEvent === "DEAT" && l.level === 2 && l.tag === "PLAC" && l.value) {
            indi.deathPlace = l.value;
          } else if (currentEvent && l.level === 2) {
            if (l.tag === "TYPE" && l.value) currentEvent.kind = l.value;
            else if (l.tag === "DATE" && l.value) currentEvent.dateText = l.value;
            else if (l.tag === "PLAC" && l.value) currentEvent.placeText = l.value;
            else if (l.tag === "NOTE" && l.value) currentEvent.note = currentEvent.note ? currentEvent.note + "\n" + l.value : l.value;
            else if (l.tag === "SOUR" && l.value) currentEvent.source = currentEvent.source ? currentEvent.source + "; " + l.value : l.value;
          }
          // Level >=3 continuations for notes inside events (e.g. 3 CONT)
          if (currentEvent && currentEvent.note && (l.tag === "CONT" || l.tag === "CONC")) {
            // Only if we are inside an EVEN note continuation — handled loosely
          }
        }
      }
      flushEvent();
      flushNote();
      if (indi.altNames.length > 0) {
        warnings.push(`${xref} has ${indi.altNames.length + 1} names — only the first was imported.`);
      }
      individuals.push(indi);
      continue;
    }

    if (line.tag === "FAM" && line.xref) {
      const xref = line.xref;
      if (seenFam.has(xref)) {
        warnings.push(`Duplicate family ${xref} — the second copy was skipped.`);
        while (i + 1 < lines.length && lines[i + 1].level > 0) i++;
        continue;
      }
      seenFam.add(xref);

      const fam: ParsedFamily = {
        xref,
        husbandXref: null,
        wifeXref: null,
        childXrefs: [],
        marriageDateText: null,
        marriagePlaceText: null,
        divorced: false,
      };
      let inMarr = false;
      for (let j = i + 1; j < lines.length && lines[j].level > 0; j++) {
        const l = lines[j];
        if (l.level === 1) {
          inMarr = false;
          if (l.tag === "HUSB" && l.value) fam.husbandXref = l.value;
          else if (l.tag === "WIFE" && l.value) fam.wifeXref = l.value;
          else if (l.tag === "CHIL" && l.value) fam.childXrefs.push(l.value);
          else if (l.tag === "MARR") inMarr = true;
          else if (l.tag === "DIV") fam.divorced = true;
        } else if (l.level === 2 && inMarr) {
          if (l.tag === "DATE" && l.value) fam.marriageDateText = l.value;
          else if (l.tag === "PLAC" && l.value) fam.marriagePlaceText = l.value;
        }
      }
      families.push(fam);
      continue;
    }

    // Unknown level-0 record (REPO, NOTE, OBJM, SUBM …) — skip quietly.
    while (i + 1 < lines.length && lines[i + 1].level > 0) i++;
  }

  // --- cross-reference sanity -----------------------------------------------------
  const indiXrefs = new Set(individuals.map((p) => p.xref));
  for (const fam of families) {
    if (fam.husbandXref && !indiXrefs.has(fam.husbandXref)) {
      warnings.push(`Family ${fam.xref} references a missing person (${fam.husbandXref}) — that partner was skipped.`);
      fam.husbandXref = null;
    }
    if (fam.wifeXref && !indiXrefs.has(fam.wifeXref)) {
      warnings.push(`Family ${fam.xref} references a missing person (${fam.wifeXref}) — that partner was skipped.`);
      fam.wifeXref = null;
    }
    const before = fam.childXrefs.length;
    fam.childXrefs = fam.childXrefs.filter((c) => indiXrefs.has(c));
    if (fam.childXrefs.length !== before) {
      warnings.push(`Family ${fam.xref} references ${before - fam.childXrefs.length} missing child(ren) — those links were skipped.`);
    }
  }

  return { charSet, source, individuals, families, warnings };
}

/** "Zainab /Khan/" → { first: "Zainab", last: "Khan" }. Tolerant of the
 *  many real-world shapes: no slashes, suffixes, extra slashes. */
export function splitGedcomName(
  nameRaw: string | null,
): { first: string | null; last: string | null } {
  if (nameRaw === null || nameRaw.trim() === "") return { first: null, last: null };
  const slashMatch = /^([^/]*)\/([^/]*)\/\s*(.*)$/.exec(nameRaw);
  if (slashMatch) {
    const first = slashMatch[1].trim();
    const last = slashMatch[2].trim();
    const suffix = slashMatch[3].trim();
    return {
      first: [first, suffix].filter(Boolean).join(" ") || null,
      last: last || null,
    };
  }
  // No slashes at all: treat the whole payload as a given name.
  return { first: nameRaw.trim() || null, last: null };
}
