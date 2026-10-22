/**
 * GEDCOM 5.5.1 writer — the no-lock-in promise in code.
 *
 * Pure function: fam.link's internal model → GEDCOM text. The internal model
 * stays richer than GEDCOM (memories, fuzzy places, unknown placeholders);
 * export maps what fits and preserves the rest as NOTEs.
 *
 * fam.link dates are fuzzy free text ("c. 1947", "before Partition"). They are
 * written as-is into DATE lines — strict GEDCOM date grammar is not enforced,
 * and importing apps display them as text. This is a deliberate trade-off:
 * the human's words survive the transfer.
 */

export interface GedcomPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  gender: "m" | "f" | "x" | null;
  living: boolean;
  birthDateText: string | null;
  birthPlace: string | null;
  deathDateText: string | null;
  deathPlace: string | null;
  notes: string | null;
  memories: { body: string; occurredText: string | null; authorName: string | null }[];
}

export interface GedcomUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
  status: string | null;
  dateText: string | null;
  placeText: string | null;
}

export interface GedcomLink {
  unionId: string;
  childId: string;
}

export interface GedcomInput {
  treeName: string;
  persons: GedcomPerson[];
  unions: GedcomUnion[];
  links: GedcomLink[];
}

/** Multi-line text → NOTE + CONT lines. */
function noteLines(text: string, prefix = ""): string[] {
  const lines = text.split(/\r?\n/);
  return lines.map((line, i) =>
    `${i === 0 ? "1 NOTE" : "2 CONT"} ${prefix}${line}`.trimEnd(),
  );
}

function escapeLine(s: string): string {
  // GEDCOM has no escape syntax for content; just guard line breaks.
  return s.replace(/\r?\n/g, " ");
}

export function writeGedcom(input: GedcomInput): string {
  const out: string[] = [];

  const indiXref = new Map<string, string>();
  const famXref = new Map<string, string>();
  input.persons.forEach((p, i) => indiXref.set(p.id, `@I${i + 1}@`));
  input.unions.forEach((u, i) => famXref.set(u.id, `@F${i + 1}@`));

  out.push("0 HEAD");
  out.push("1 SOUR fam.link");
  out.push("2 NAME fam.link");
  out.push("2 VERS 0.1");
  out.push("1 GEDC");
  out.push("2 VERS 5.5.1");
  out.push("2 FORM LINEAGE-LINKED");
  out.push("1 CHAR UTF-8");
  if (input.treeName) out.push(`1 DEST ANY`);

  for (const p of input.persons) {
    out.push(`0 ${indiXref.get(p.id)} INDI`);
    const given = p.firstName ?? "";
    const surname = p.lastName ?? "";
    out.push(`1 NAME ${escapeLine(given)} /${escapeLine(surname)}/`);
    if (p.gender === "m") out.push("1 SEX M");
    else if (p.gender === "f") out.push("1 SEX F");
    else if (p.gender === "x") out.push("1 SEX X");
    if (p.birthDateText || p.birthPlace) {
      out.push("1 BIRT");
      if (p.birthDateText) out.push(`2 DATE ${escapeLine(p.birthDateText)}`);
      if (p.birthPlace) out.push(`2 PLAC ${escapeLine(p.birthPlace)}`);
    }
    if (!p.living || p.deathDateText || p.deathPlace) {
      out.push("1 DEAT");
      if (!p.living && p.deathDateText) out.push(`2 DATE ${escapeLine(p.deathDateText)}`);
      if (!p.living && p.deathPlace) out.push(`2 PLAC ${escapeLine(p.deathPlace)}`);
    }
    if (p.notes) out.push(...noteLines(p.notes));
    for (const m of p.memories) {
      const meta = [
        m.occurredText ? `(${m.occurredText})` : null,
        m.authorName ? `— remembered by ${m.authorName}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      out.push(...noteLines(`${m.body}${meta ? " " + meta : ""}`, "MEMORY: "));
    }
  }

  for (const u of input.unions) {
    out.push(`0 ${famXref.get(u.id)} FAM`);
    if (u.partnerAId) out.push(`1 HUSB ${indiXref.get(u.partnerAId) ?? ""}`.trimEnd());
    if (u.partnerBId) out.push(`1 WIFE ${indiXref.get(u.partnerBId) ?? ""}`.trimEnd());
    for (const l of input.links.filter((l) => l.unionId === u.id)) {
      const xref = indiXref.get(l.childId);
      if (xref) out.push(`1 CHIL ${xref}`);
    }
    if (u.status === "married" || u.status === "divorced" || u.status === "widowed") {
      out.push(`1 ${u.status === "married" ? "MARR" : u.status === "divorced" ? "DIV" : "ANUL"}`);
      if (u.dateText) out.push(`2 DATE ${escapeLine(u.dateText)}`);
      if (u.placeText) out.push(`2 PLAC ${escapeLine(u.placeText)}`);
    }
  }

  out.push("0 TRLR");
  return out.join("\n") + "\n";
}
