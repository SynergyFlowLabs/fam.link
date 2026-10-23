import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, persons, personEvents, trees, unions } from "@/db/schema";
import { getShareLinkByToken } from "@/lib/share";
import { TimelineClient } from "@/components/timeline/TimelineClient";
import { buildTimelineEntries, classifyBranches, filterByLiving, type EventInput, type MemoryInput, type TimelinePersonRef } from "@/lib/timeline";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) return { title: "Shared timeline" };
  const rows = await db.select({ name: trees.name }).from(trees).where(eq(trees.id, link.treeId)).limit(1);
  return { title: `${rows[0]?.name ?? "Shared tree"} — Timeline`, robots: { index: false, follow: false } };
}

/**
 * Public read-only timeline for a share link — same capability token as the
 * canvas. Living relatives' entries (memories + events) are stripped
 * server-side; deceased relatives show in full. Scoped links see their
 * branch only. Revoked or unknown tokens 404.
 */
export default async function SharedTimelinePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) notFound();
  const treeRows = await db.select().from(trees).where(eq(trees.id, link.treeId)).limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const allPersonRows = await db.select().from(persons).where(eq(persons.treeId, link.treeId));
  const allUnionRows = await db.select().from(unions).where(eq(unions.treeId, link.treeId));
  const allLinkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, link.treeId));

  const scopeId = (link as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let personRows = allPersonRows;
  let unionRows: { id: string; partnerAId: string; partnerBId: string | null }[] = allUnionRows;
  let linkRows: { unionId: string; childId: string }[] = allLinkRows;
  if (scopeId) {
    const { getBranchPersonIds, filterUnionsByBranch, filterLinksByBranch } = await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, allPersonRows, allUnionRows, allLinkRows);
    if (!branchIds || branchIds.size === 0) notFound();
    personRows = allPersonRows.filter((p) => branchIds.has(p.id));
    unionRows = filterUnionsByBranch(allUnionRows, branchIds);
    linkRows = filterLinksByBranch(allLinkRows, branchIds, unionRows);
  }

  const personIdSet = new Set(personRows.map((p) => p.id));
  const memoryRows = personRows.length
    ? (await db
        .select()
        .from(memories)
        .innerJoin(persons, eq(memories.personId, persons.id))
        .where(eq(persons.treeId, link.treeId)))
        .map((r) => r.memories)
        .filter((m) => personIdSet.has(m.personId))
    : [];
  const eventRows = personRows.length
    ? (await db
        .select()
        .from(personEvents)
        .innerJoin(persons, eq(personEvents.personId, persons.id))
        .where(eq(persons.treeId, link.treeId)))
        .map((r) => r.person_events)
        .filter((e) => personIdSet.has(e.personId))
    : [];

  const personsById = new Map<string, TimelinePersonRef>(
    personRows.map((p) => [
      p.id,
      {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        living: p.living,
        birthDateText: p.birthDateText,
        deathDateText: p.deathDateText,
      },
    ]),
  );

  const memoryInputs: MemoryInput[] = memoryRows.map((m) => ({
    id: m.id,
    personId: m.personId,
    body: m.body,
    occurredText: m.occurredText,
    authorName: m.authorName,
    kind: m.kind,
    createdAt: m.createdAt,
    mediaId: m.mediaId,
  }));
  const eventInputs: EventInput[] = eventRows.map((e) => ({
    id: e.id,
    personId: e.personId,
    kind: e.kind,
    dateText: e.dateText,
    placeText: e.placeText,
    note: e.note,
    source: e.source,
    createdAt: e.createdAt,
  }));

  // Living redaction: living persons' entries never leave the server.
  const entries = filterByLiving(
    buildTimelineEntries(memoryInputs, eventInputs, personsById),
    personsById,
    true,
  );

  const { paternal, maternal } = classifyBranches(
    personRows.map((p) => ({ id: p.id, gender: p.gender })),
    unionRows.map((u) => ({ id: u.id, partnerAId: u.partnerAId, partnerBId: u.partnerBId })),
    linkRows,
    tree.focusPersonId ?? personRows[0]?.id ?? "",
  );

  // The person filter list also omits living relatives — names never ship.
  const personsLite = personRows
    .filter((p) => !p.living)
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      living: p.living,
      birthDateText: p.birthDateText,
      deathDateText: p.deathDateText,
    }));

  const shareBranchNote = scopeId
    ? `Shared branch view — ${personRows.length} people · living relatives kept private.`
    : "Shared read-only view — living relatives are kept private.";

  return (
    <TimelineClient
      treeId={link.treeId}
      treeName={tree.name}
      persons={personsLite}
      entries={entries}
      paternal={[...paternal]}
      maternal={[...maternal]}
      readOnly
      shareNote={shareBranchNote}
      backHref={`/share/${token}`}
    />
  );
}
