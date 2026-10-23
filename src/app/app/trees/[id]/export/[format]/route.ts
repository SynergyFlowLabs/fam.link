import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { db } from "@/db";
import {
  memories,
  parentChild,
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
  if (publicExport) {
    personRows = personRows.map(redact);
    // Memories of living relatives (and their media) leave with the person.
    const livingIds = new Set(
      personRows.filter((p) => p.living).map((p) => p.id),
    );
    memoryRows = memoryRows.filter((m) => !livingIds.has(m.persons.id));
    // Media hangs off memories, so the memory filter above already pulled
    // the living's photos/voice notes out of the story.

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
    const text = writeGedcom({
      treeName: tree.name,
      persons: personRows.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        living: p.living,
        birthDateText: p.birthDateText,
        birthPlace: p.birthPlace,
        deathDateText: p.deathDateText,
        deathPlace: p.deathPlace,
        notes: p.notes,
        memories: memoriesByPerson.get(p.id) ?? [],
      })),
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
        // media files themselves live under data/uploads/ — the JSON export
        // carries the metadata; a future zip export will bundle the files.
      })),
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
