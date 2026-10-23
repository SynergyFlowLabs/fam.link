import { eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { memories, parentChild, persons, trees, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import {
  buildWalkPath,
  displayNameOfPerson,
  lifeLineOf,
  relationForStep,
  type WalkLink,
  type WalkSlide,
  type WalkUnion,
} from "@/lib/walkthrough";
import { WalkthroughClient } from "@/components/walkthrough/walkthrough-client";

/**
 * Narrative walkthrough (issue #38) — a slideshow down one family line
 * from the focus person (ancestors by default, ?dir=descendants to flip).
 * Respects branch scope (P1.5): scoped members walk their own line only.
 */
export default async function WalkthroughPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dir?: string; from?: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/app/trees/${treeId}/walkthrough`);
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();

  const sp = await searchParams;
  const direction = sp.dir === "descendants" ? "descendants" : "ancestors";

  const treeRows = await db.select().from(trees).where(eq(trees.id, treeId)).limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const allPersons = await db.select().from(persons).where(eq(persons.treeId, treeId));
  const allUnions: WalkUnion[] = (
    await db
      .select({ id: unions.id, partnerAId: unions.partnerAId, partnerBId: unions.partnerBId })
      .from(unions)
      .where(eq(unions.treeId, treeId))
  ).map((u) => ({ id: u.id, partnerAId: u.partnerAId ?? "", partnerBId: u.partnerBId ?? null }));
  const allLinks: WalkLink[] = (
    await db
      .select({ unionId: parentChild.unionId, childId: parentChild.childId })
      .from(parentChild)
      .innerJoin(unions, eq(parentChild.unionId, unions.id))
      .where(eq(unions.treeId, treeId))
  ).map((l) => ({ unionId: l.unionId, childId: l.childId }));

  // Branch scope (P1.5): a scoped member walks their own line only.
  const scopeId =
    (access as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let allowedIds: Set<string> | null = null;
  if (scopeId) {
    const { getBranchPersonIds } = await import("@/lib/branch-scope");
    allowedIds = getBranchPersonIds(
      scopeId,
      allPersons,
      allUnions.map((u) => ({ id: u.id, partnerAId: u.partnerAId ?? "", partnerBId: u.partnerBId })),
      allLinks,
    );
  }

  const startId = sp.from && allPersons.some((p) => p.id === sp.from)
    ? sp.from
    : tree.focusPersonId && allPersons.some((p) => p.id === tree.focusPersonId)
      ? tree.focusPersonId
      : allPersons[0]?.id;
  if (!startId) notFound();

  const path = buildWalkPath(startId, allPersons, allUnions, allLinks, direction).filter(
    (p) => !allowedIds || allowedIds.has(p.id),
  );

  // Top 3 memories per slide (newest first).
  const ids = path.map((p) => p.id);
  const memoryRows = ids.length
    ? await db
        .select({
          id: memories.id,
          personId: memories.personId,
          body: memories.body,
          kind: memories.kind,
          mediaId: memories.mediaId,
          authorName: memories.authorName,
        })
        .from(memories)
        .where(inArray(memories.personId, ids))
    : [];
  memoryRows.reverse(); // newest first per person as we slice below

  const byPerson = new Map<string, typeof memoryRows>();
  for (const m of memoryRows) {
    const list = byPerson.get(m.personId) ?? [];
    if (list.length < 3) list.push(m);
    byPerson.set(m.personId, list);
  }

  const slides: WalkSlide[] = path.map((p, idx) => {
    const next = path[idx + 1];
    return {
      person: {
        id: p.id,
        name: displayNameOfPerson(p),
        living: p.living,
        lifeLine: lifeLineOf(p),
        photoMediaId: p.photoMediaId,
      },
      memories: (byPerson.get(p.id) ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        kind: m.kind,
        mediaId: m.mediaId,
        authorName: m.authorName,
        durationSeconds: null,
      })),
      nextName: next ? displayNameOfPerson(next) : null,
      nextRelation: next ? relationForStep(path, idx + 1, direction) : null,
      nextHref: next ? `/app/trees/${treeId}/person/${next.id}` : null,
    };
  });

  return (
    <WalkthroughClient
      treeId={treeId}
      treeName={tree.name}
      direction={direction}
      slides={slides}
    />
  );
}
