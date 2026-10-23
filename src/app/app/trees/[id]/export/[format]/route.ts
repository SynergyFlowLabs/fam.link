import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { db } from "@/db";
import {
  customFieldDefs,
  labelDefs,
  memories,
  memoryCustomValues,
  memoryLabels,
  parentChild,
  personCustomValues,
  personLabels,
  persons,
  unions,
  media,
} from "@/db/schema";
import { writeGedcom } from "@/lib/gedcom/writer";
import { getPublicTree } from "@/lib/public-trees";
import { REDACTED_NAME } from "@/lib/canvas-types";
import type { Person } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
): Promise<Response> {
  const { id: treeId, format } = await params;
  // Exports are part of the no-lock-in promise: every member of a tree
  // (owner, editor, commenter, viewer) can take their data out.
  const user = await getCurrentUser();
  const access = user ? await getTreeAccess(treeId, user.id) : null;
  // Public trees export anonymously too — the no-lock-in idea cuts both
  // ways — but living relatives are redacted exactly like the public views.
  const publicExport = !access && (await getPublicTree(treeId)) !== null;
  const tree = access?.tree ?? (publicExport ? await getPublicTree(treeId) : null);
  if (!tree) return new Response("Not found", { status: 404 });

  let personRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const unionRows = await db
    .select()
    .from(unions)
    .where(eq(unions.treeId, treeId));
  const linkRows =
    unionRows.length > 0
      ? await db
          .select()
          .from(parentChild)
          .where(
            inArray(
              parentChild.unionId,
              unionRows.map((u) => u.id),
            ),
          )
      : [];
  let memoryRows = await db
    .select()
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(persons.treeId, treeId));
  const mediaRows = await db
    .select()
    .from(media)
    .where(eq(media.treeId, treeId));

  // Labels & custom fields for this tree (for JSON export and GEDCOM notes)
  const labelDefsRows = await db.select().from(labelDefs).where(eq(labelDefs.treeId, treeId));
  const customFieldDefsRows = await db.select().from(customFieldDefs).where(eq(customFieldDefs.treeId, treeId));
  const personLabelsRows = personRows.length > 0
    ? await db.select().from(personLabels).where(inArray(personLabels.personId, personRows.map((p) => p.id)))
    : [];
  const memoryLabelsRows = memoryRows.length > 0
    ? await db.select().from(memoryLabels).where(inArray(memoryLabels.memoryId, memoryRows.map((m) => m.memories.id)))
    : [];
  const personCustomValuesRows = personRows.length > 0
    ? await db.select().from(personCustomValues).where(inArray(personCustomValues.personId, personRows.map((p) => p.id)))
    : [];
  const memoryCustomValuesRows = memoryRows.length > 0
    ? await db.select().from(memoryCustomValues).where(inArray(memoryCustomValues.memoryId, memoryRows.map((m) => m.memories.id)))
    : [];

  const redact = (p: Person): Person =>
    p.living
      ? {
          ...p,
          firstName: REDACTED_NAME,
          lastName: null,
          alsoKnownAs: null,
          gender: null,
          birthDateText: null,
          birthPlace: null,
          deathDateText: null,
          deathPlace: null,
          notes: null,
        }
      : p;
  // privacy: redact living relatives for public exports — same as share views
  if (publicExport) {
    const livingIds = new Set(
      personRows.filter((p) => p.living).map((p) => p.id),
    );
    personRows = personRows.map(redact);
    memoryRows = memoryRows.filter((m) => !livingIds.has(m.persons.id));
    // Labels/custom fields of living relatives stay private too
    personLabelsRows.splice(0, personLabelsRows.length, ...personLabelsRows.filter((r) => !livingIds.has(r.personId)));
    personCustomValuesRows.splice(0, personCustomValuesRows.length, ...personCustomValuesRows.filter((r) => !livingIds.has(r.personId)));
    {
      const remainingMemoryIds = new Set(memoryRows.map((m) => m.memories.id));
      memoryLabelsRows.splice(0, memoryLabelsRows.length, ...memoryLabelsRows.filter((r) => remainingMemoryIds.has(r.memoryId)));
      memoryCustomValuesRows.splice(0, memoryCustomValuesRows.length, ...memoryCustomValuesRows.filter((r) => remainingMemoryIds.has(r.memoryId)));
    }
  }

  const safeName =
    tree.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") ||
    "family-tree";

  if (format === "gedcom") {
    const memoriesByPerson = new Map<
      string,
      { body: string; occurredText: string | null; authorName: string | null }[]
    >();
    for (const m of memoryRows) {
      const list = memoriesByPerson.get(m.persons.id) ?? [];
      list.push({
        body: m.memories.body,
        occurredText: m.memories.occurredText,
        authorName: m.memories.authorName,
      });
      memoriesByPerson.set(m.persons.id, list);
    }
    // Build per-person label/custom strings for GEDCOM NOTES (GEDCOM-compatible)
    const labelDefMap = new Map(labelDefsRows.map((l) => [l.id, l.name]));
    const labelsByPersonForGed = new Map<string, string[]>();
    for (const pl of personLabelsRows) {
      const name = labelDefMap.get(pl.labelId);
      if (!name) continue;
      const arr = labelsByPersonForGed.get(pl.personId) ?? [];
      arr.push(name);
      labelsByPersonForGed.set(pl.personId, arr);
    }
    const customByPersonForGed = new Map<string, { name: string; value: string }[]>();
    const fieldDefMap = new Map(customFieldDefsRows.map((f) => [f.id, f.name]));
    for (const cv of personCustomValuesRows) {
      const fname = fieldDefMap.get(cv.fieldId);
      if (!fname) continue;
      const arr = customByPersonForGed.get(cv.personId) ?? [];
      arr.push({ name: fname, value: cv.value });
      customByPersonForGed.set(cv.personId, arr);
    }
    const text = writeGedcom({
      treeName: tree.name,
      persons: personRows.map((p) => {
        const extraNotes: string[] = [];
        const lbs = labelsByPersonForGed.get(p.id);
        if (lbs && lbs.length > 0) extraNotes.push(`Labels: ${lbs.join(", ")}`);
        const customs = customByPersonForGed.get(p.id);
        if (customs) {
          for (const c of customs) extraNotes.push(`${c.name}: ${c.value}`);
        }
        const baseNotes = p.notes ? [p.notes] : [];
        const allNotes = [...baseNotes, ...extraNotes].join("\n\n") || null;
        return {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          living: p.living,
          birthDateText: p.birthDateText,
          birthPlace: p.birthPlace,
          deathDateText: p.deathDateText,
          deathPlace: p.deathPlace,
          notes: allNotes,
          memories: memoriesByPerson.get(p.id) ?? [],
        };
      }),
      unions: unionRows.map((u) => ({
        id: u.id,
        partnerAId: u.partnerAId,
        partnerBId: u.partnerBId,
        status: u.status,
        dateText: u.dateText,
        placeText: u.placeText,
      })),
      links: linkRows.map((l) => ({ unionId: l.unionId, childId: l.childId })),
    });
    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.ged"`,
      },
    });
  }

  if (format === "json") {
    const payload = {
      app: "fam.link",
      format: 1,
      exportedAt: new Date().toISOString(),
      tree: { name: tree.name, description: tree.description },
      persons: personRows,
      unions: unionRows,
      links: linkRows,
      memories: memoryRows.map((r) => r.memories),
      media: mediaRows.map((m) => ({
        id: m.id,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
      })),
      labelDefs: labelDefsRows,
      customFieldDefs: customFieldDefsRows,
      personLabels: personLabelsRows,
      memoryLabels: memoryLabelsRows,
      personCustomValues: personCustomValuesRows,
      memoryCustomValues: memoryCustomValuesRows,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${safeName}.json"`,
      },
    });
  }

  return new Response("Not found", { status: 404 });
}
