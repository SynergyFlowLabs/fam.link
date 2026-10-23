import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getPersonCustomValuesByTree, getPersonLabelsByTree, listCustomFieldDefs, listLabelDefs } from "@/lib/tree-labels";
import { db } from "@/db";
import { memories, parentChild, persons, unions } from "@/db/schema";
import { getPublicTree } from "@/lib/public-trees";
import { redactPerson } from "@/lib/canvas-types";
import { TreeCanvas } from "@/components/tree-canvas";
import type { CanvasLink, CanvasPerson, CanvasUnion } from "@/lib/canvas-types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tree = await getPublicTree(id);
  if (!tree) return { title: "Public tree" };
  return {
    title: tree.name,
    description:
      tree.description ?? `A public family tree on fam.link — ${tree.name}.`,
  };
}

/**
 * Anonymous public view of a published tree. Same shape as the member
 * canvas, but read-only for content (cards link to public person pages)
 * and fully redacted for living relatives.
 */
export default async function ExploreTreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const tree = await getPublicTree(treeId);
  if (!tree) notFound();

  const peopleRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const unionRows = await db
    .select()
    .from(unions)
    .where(eq(unions.treeId, treeId));
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
  const labelDefs = await listLabelDefs(treeId);
  const fieldDefs = await listCustomFieldDefs(treeId);
  const labelsByPerson = await getPersonLabelsByTree(treeId);
  const customByPerson = await getPersonCustomValuesByTree(treeId);

  const canvasPersons: CanvasPerson[] = peopleRows.map((p) => {
    const lbs = labelsByPerson.get(p.id) ?? [];
    const cvs = customByPerson.get(p.id) ?? [];
    return redactPerson({
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
      labels: lbs.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      customFields: cvs.map((c) => ({ fieldId: c.fieldId, fieldName: c.fieldName, kind: c.kind as never, value: c.value })),
    });
  });
  const canvasUnions: CanvasUnion[] = unionRows.map((u) => ({
    id: u.id,
    partnerAId: u.partnerAId,
    partnerBId: u.partnerBId,
    status: u.status,
  }));
  const canvasLinks: CanvasLink[] = linkRows;

  if (canvasPersons.length === 0) notFound();

  return (
    <TreeCanvas
      treeId={treeId}
      treeName={tree.name}
      persons={canvasPersons}
      unions={canvasUnions}
      links={canvasLinks}
      focusPersonId={tree.focusPersonId ?? canvasPersons[0].id}
      canEdit={false}
      showExport={true}
      labelDefs={labelDefs.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      fieldDefs={fieldDefs.map((f) => ({ id: f.id, name: f.name, kind: f.kind as never, optionsJson: f.optionsJson }))}
      shareNote="Public tree — living relatives stay private. Built with fam.link."
      personHrefBase={`/explore/${treeId}`}
    />
  );
}
