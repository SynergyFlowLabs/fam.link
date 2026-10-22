import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, persons, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";
import { TreeCanvas } from "@/components/tree-canvas";
import { FirstPersonForm } from "@/components/quick-add-modal";
import { ShareMenu, type ShareLinkView } from "@/components/share-menu";
import { listShareLinks } from "@/lib/share";
import type { CanvasLink, CanvasPerson, CanvasUnion } from "@/lib/canvas-types";

export default async function TreeCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const tree = await ownedTree(treeId, user.id);
  if (!tree) notFound();

  const peopleRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  const linkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, treeId));
  const memoryRows = await db
    .select({ personId: memories.personId, c: count() })
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(persons.treeId, treeId))
    .groupBy(memories.personId);
  const memoryCounts = new Map(memoryRows.map((r) => [r.personId, Number(r.c)]));
  const shareLinkRows = await listShareLinks(treeId);
  const shareLinkViews: ShareLinkView[] = shareLinkRows.map((l) => ({
    id: l.id,
    token: l.token,
    label: l.label,
    createdAt: l.createdAt.toISOString(),
    revoked: l.revokedAt !== null,
  }));

  const canvasPersons: CanvasPerson[] = peopleRows.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    alsoKnownAs: p.alsoKnownAs,
    gender: p.gender,
    living: p.living,
    birthDateText: p.birthDateText,
    birthPlace: p.birthPlace,
    deathDateText: p.deathDateText,
    deathPlace: p.deathPlace,
    memoryCount: memoryCounts.get(p.id) ?? 0,
  }));
  const canvasUnions: CanvasUnion[] = unionRows.map((u) => ({
    id: u.id,
    partnerAId: u.partnerAId,
    partnerBId: u.partnerBId,
    status: u.status,
  }));
  const canvasLinks: CanvasLink[] = linkRows;

  if (canvasPersons.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-display text-3xl font-semibold text-ink">
          {tree.name}
        </h1>
        <p className="mt-2 text-ink-soft">
          An empty tree — every family starts with one person. Usually you.
        </p>
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-ink">
            Add the first person
          </h2>
          <FirstPersonForm treeId={treeId} />
        </div>
      </div>
    );
  }

  return (
    <TreeCanvas
      treeId={treeId}
      treeName={tree.name}
      persons={canvasPersons}
      unions={canvasUnions}
      links={canvasLinks}
      focusPersonId={tree.focusPersonId ?? canvasPersons[0].id}
      headerExtra={<ShareMenu treeId={treeId} links={shareLinkViews} />}
    />
  );
}
