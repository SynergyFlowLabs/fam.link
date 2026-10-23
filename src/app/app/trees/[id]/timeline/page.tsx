import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, persons, personEvents, trees, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { TimelineClient } from "@/components/timeline/TimelineClient";
import { buildTimelineEntries, classifyBranches, type EventInput, type MemoryInput, type TimelinePersonRef } from "@/lib/timeline";

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();

  const treeRows = await db.select().from(trees).where(eq(trees.id, treeId)).limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const allPersonRows = await db.select().from(persons).where(eq(persons.treeId, treeId));
  const allUnionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  const allLinkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, treeId));

  // Branch-scoped membership: same filtering as the canvas page
  const scopeId = (access as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let personRows = allPersonRows;
  let unionRows: { id: string; partnerAId: string; partnerBId: string | null }[] = allUnionRows;
  let linkRows: { unionId: string; childId: string }[] = allLinkRows;
  if (scopeId) {
    const { getBranchPersonIds, filterUnionsByBranch, filterLinksByBranch } = await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, allPersonRows, allUnionRows, allLinkRows);
    if (!branchIds || branchIds.size === 0) {
      personRows = [];
      unionRows = [];
      linkRows = [];
    } else {
      personRows = allPersonRows.filter((p) => branchIds.has(p.id));
      unionRows = filterUnionsByBranch(allUnionRows, branchIds);
      linkRows = filterLinksByBranch(allLinkRows, branchIds, unionRows);
    }
  }

  const personIdSet = new Set(personRows.map((p) => p.id));
  const memoryRows = personRows.length
    ? (await db
        .select()
        .from(memories)
        .innerJoin(persons, eq(memories.personId, persons.id))
        .where(eq(persons.treeId, treeId)))
        .map((r) => r.memories)
        .filter((m) => personIdSet.has(m.personId))
    : [];
  const eventRows = personRows.length
    ? (await db
        .select()
        .from(personEvents)
        .innerJoin(persons, eq(personEvents.personId, persons.id))
        .where(eq(persons.treeId, treeId)))
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
  const entries = buildTimelineEntries(memoryInputs, eventInputs, personsById);

  const { paternal, maternal } = classifyBranches(
    personRows.map((p) => ({ id: p.id, gender: p.gender })),
    unionRows.map((u) => ({ id: u.id, partnerAId: u.partnerAId, partnerBId: u.partnerBId })),
    linkRows,
    tree.focusPersonId ?? personRows[0]?.id ?? "",
  );

  const personsLite = personRows.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    living: p.living,
    birthDateText: p.birthDateText,
    deathDateText: p.deathDateText,
  }));

  return (
    <TimelineClient
      treeId={treeId}
      treeName={tree.name}
      persons={personsLite}
      entries={entries}
      paternal={[...paternal]}
      maternal={[...maternal]}
    />
  );
}
