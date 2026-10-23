import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { memories, parentChild, persons, trees, unions } from "@/db/schema";
import { getShareLinkByToken } from "@/lib/share";
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
 * Public read-only walkthrough of a shared tree (issue #38). The token is
 * the capability; living relatives' slides are dropped entirely — only
 * the departed walk the shared line.
 */
export default async function SharedWalkthroughPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ dir?: string; from?: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) notFound();

  const treeRows = await db.select().from(trees).where(eq(trees.id, link.treeId)).limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const sp = await searchParams;
  const direction = sp.dir === "descendants" ? "descendants" : "ancestors";

  const allPersons = await db.select().from(persons).where(eq(persons.treeId, link.treeId));
  const allUnions: WalkUnion[] = (
    await db
      .select({ id: unions.id, partnerAId: unions.partnerAId, partnerBId: unions.partnerBId })
      .from(unions)
      .where(eq(unions.treeId, link.treeId))
  ).map((u) => ({ id: u.id, partnerAId: u.partnerAId ?? "", partnerBId: u.partnerBId ?? null }));
  const allLinks: WalkLink[] = (
    await db
      .select({ unionId: parentChild.unionId, childId: parentChild.childId })
      .from(parentChild)
      .innerJoin(unions, eq(parentChild.unionId, unions.id))
      .where(eq(unions.treeId, link.treeId))
  ).map((l) => ({ unionId: l.unionId, childId: l.childId }));

  const startId = sp.from && allPersons.some((p) => p.id === sp.from)
    ? sp.from
    : tree.focusPersonId && allPersons.some((p) => p.id === tree.focusPersonId)
      ? tree.focusPersonId
      : allPersons[0]?.id;
  if (!startId) notFound();

  // Living redaction: deceased relatives only on the shared line.
  const path = buildWalkPath(startId, allPersons, allUnions, allLinks, direction).filter(
    (p) => !p.living,
  );

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
  memoryRows.reverse();

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
      nextHref: null, // public viewers stay in the slideshow
    };
  });

  return (
    <WalkthroughClient
      treeId={link.treeId}
      treeName={tree.name}
      direction={direction}
      slides={slides}
      readOnly
      backHref={`/share/${token}`}
    />
  );
}
