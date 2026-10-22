import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";
import { db } from "@/db";
import {
  memories,
  parentChild,
  persons,
  unions,
  media,
} from "@/db/schema";
import { writeGedcom } from "@/lib/gedcom/writer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
): Promise<Response> {
  const { id: treeId, format } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return new Response("Not found", { status: 404 });

  const personRows = await db
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
  const memoryRows = await db
    .select()
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(persons.treeId, treeId));
  const mediaRows = await db
    .select()
    .from(media)
    .where(eq(media.treeId, treeId));

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
