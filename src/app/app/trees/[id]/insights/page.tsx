import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { memories, media, parentChild, persons, trees, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { classifyBranches } from "@/lib/timeline";
import { computeInsights, rootPersons, childlessUnions, personName } from "@/lib/analytics";
import { InsightsPanel } from "@/components/insights/insights-panel";

/**
 * Insights (issue #40) — local-only analytics over the family's own data.
 * Computed on request, shown once, dismissible; no outbound calls, no
 * tracking, no model training. Branch scope (P1.5) applies.
 */
export default async function InsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/app/trees/${treeId}/insights`);
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();

  const treeRow = (
    await db
      .select({ name: trees.name, focusPersonId: trees.focusPersonId })
      .from(trees)
      .where(eq(trees.id, treeId))
      .limit(1)
  )[0];

  const allPersons = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      living: persons.living,
      gender: persons.gender,
      birthDateText: persons.birthDateText,
    })
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const unionRows = await db
    .select({ id: unions.id, partnerAId: unions.partnerAId, partnerBId: unions.partnerBId })
    .from(unions)
    .where(eq(unions.treeId, treeId));
  const linkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, treeId));

  // Branch scope (P1.5): insights cover the viewer's own branch.
  const scopeId =
    (access as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let personRows = allPersons;
  let visibleUnions = unionRows;
  let visibleLinks = linkRows;
  if (scopeId) {
    const { getBranchPersonIds, filterUnionsByBranch, filterLinksByBranch } =
      await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, allPersons, unionRows, linkRows) ?? new Set<string>();
    if (branchIds.size === 0) {
      personRows = [];
      visibleUnions = [];
      visibleLinks = [];
    } else {
      personRows = allPersons.filter((p) => branchIds.has(p.id));
      visibleUnions = filterUnionsByBranch(unionRows, branchIds);
      visibleLinks = filterLinksByBranch(linkRows, branchIds, visibleUnions);
    }
  }

  const { paternal, maternal } = classifyBranches(
    personRows.map((p) => ({ id: p.id, gender: p.gender })),
    visibleUnions.map((u) => ({ id: u.id, partnerAId: u.partnerAId, partnerBId: u.partnerBId })),
    visibleLinks,
    treeRow?.focusPersonId && personRows.some((p) => p.id === treeRow.focusPersonId)
      ? treeRow.focusPersonId
      : personRows[0]?.id ?? "",
  );

  const memoryRows = personRows.length
    ? await db
        .select({ personId: memories.personId, kind: memories.kind })
        .from(memories)
        .innerJoin(persons, eq(memories.personId, persons.id))
        .where(eq(persons.treeId, treeId))
    : [];
  const scopedMemoryRows = memoryRows.filter((m) =>
    personRows.some((p) => p.id === m.personId),
  );

  const analytics = computeInsights({
    persons: personRows,
    unions: visibleUnions.map((u) => ({
      id: u.id,
      partnerAId: u.partnerAId,
      partnerBId: u.partnerBId ?? null,
    })),
    links: visibleLinks,
    memories: scopedMemoryRows.map((m) => ({ personId: m.personId })),
    paternal: [...paternal],
    maternal: [...maternal],
  });

  const roots = rootPersons(personRows, visibleLinks);
  const photoCount = scopedMemoryRows.filter((m) => m.kind === "photo").length;
  const voiceCount = scopedMemoryRows.filter((m) => m.kind === "voice").length;
  void media; // media table used via joins elsewhere; kept for future breakdowns

  return (
    <InsightsPanel
      treeId={treeId}
      data={{
        treeName: treeRow?.name ?? "Family",
        stats: {
          persons: personRows.length,
          memories: scopedMemoryRows.length,
          photos: photoCount,
          voices: voiceCount,
        },
        coverages: analytics.coverages,
        insights: analytics.insights,
        unremembered: analytics.unremembered,
        roots: {
          count: roots.length,
          names: roots.slice(0, 3).map(personName),
        },
        childlessUnions: childlessUnions(
          visibleUnions.map((u) => ({
            id: u.id,
            partnerAId: u.partnerAId,
            partnerBId: u.partnerBId ?? null,
          })),
          visibleLinks,
        ).length,
      }}
    />
  );
}
