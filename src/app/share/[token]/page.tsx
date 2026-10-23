import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getPersonCustomValuesByTree, getPersonLabelsByTree, listCustomFieldDefs, listLabelDefs } from "@/lib/tree-labels";
import { db } from "@/db";
import { memories, parentChild, persons, trees, unions } from "@/db/schema";
import { getShareLinkByToken } from "@/lib/share";
import { redactPerson } from "@/lib/canvas-types";
import { TreeCanvas } from "@/components/tree-canvas";
import type { CanvasLink, CanvasPerson, CanvasUnion } from "@/lib/canvas-types";

/**
 * Public read-only view of a shared tree. No sign-in required — the token in
 * the URL is the capability. Living relatives are redacted (name, dates,
 * places, memories); the tree structure stays intact. Revoked or unknown
 * tokens 404.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) return { title: "Shared tree" };
  const rows = await db
    .select({ name: trees.name })
    .from(trees)
    .where(eq(trees.id, link.treeId))
    .limit(1);
  // the root layout template appends "· fam.link" — don't double it
  return {
    title: rows[0]?.name ?? "Shared tree",
    robots: { index: false, follow: false },
  };
}

export default async function SharedTreePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) notFound();

  const treeRows = await db
    .select()
    .from(trees)
    .where(eq(trees.id, link.treeId))
    .limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const peopleRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, link.treeId));
  const unionRows = await db
    .select()
    .from(unions)
    .where(eq(unions.treeId, link.treeId));
  const linkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, link.treeId));
  const memoryRows = await db
    .select({ personId: memories.personId, c: count() })
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(persons.treeId, link.treeId))
    .groupBy(memories.personId);
  const memoryCounts = new Map(memoryRows.map((r) => [r.personId, Number(r.c)]));
  const labelDefs = await listLabelDefs(link.treeId);
  const fieldDefs = await listCustomFieldDefs(link.treeId);
  const labelsByPerson = await getPersonLabelsByTree(link.treeId);
  const customByPerson = await getPersonCustomValuesByTree(link.treeId);

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
      treeId={link.treeId}
      treeName={tree.name}
      persons={canvasPersons}
      unions={canvasUnions}
      links={canvasLinks}
      focusPersonId={tree.focusPersonId ?? canvasPersons[0].id}
      readOnly
      labelDefs={labelDefs.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      fieldDefs={fieldDefs.map((f) => ({ id: f.id, name: f.name, kind: f.kind as never, optionsJson: f.optionsJson }))}
      shareNote="Shared read-only view — living relatives are kept private. Built with fam.link."
    />
  );
}
