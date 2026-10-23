import { notFound } from "next/navigation";
import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, persons, unions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { ROLE_LABEL, canEdit } from "@/lib/roles";
import { TreeCanvas } from "@/components/tree-canvas";
import { FirstPersonForm } from "@/components/quick-add-modal";
import { ShareMenu, type ShareLinkView } from "@/components/share-menu";
import { PublicToggle } from "@/components/public-toggle";
import { countPendingSuggestions } from "@/lib/public-trees";
import { listShareLinks } from "@/lib/share";
import { getPersonCustomValuesByTree, getPersonLabelsByTree, listCustomFieldDefs, listLabelDefs } from "@/lib/tree-labels";
import { filterDefsForViewer } from "@/lib/custom-fields";
import type { CanvasLink, CanvasPerson, CanvasUnion } from "@/lib/canvas-types";

export default async function TreeCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();
  const { tree, role } = access;
  const editable = canEdit(role);

  let peopleRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  let unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  let linkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId, relation: parentChild.relation })
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

  // Branch-scoped membership: filter to branch if invited via scoped link
  const scopeId = (access as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let filteredPeopleRows = peopleRows;
  let filteredUnionRows = unionRows;
  let filteredLinkRows = linkRows;
  if (scopeId) {
    const { getBranchPersonIds, filterUnionsByBranch, filterLinksByBranch } = await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, peopleRows as never, unionRows as never, linkRows as never);
    if (!branchIds || branchIds.size === 0) filteredPeopleRows = [];
    else {
      filteredPeopleRows = peopleRows.filter((pe) => branchIds.has(pe.id));
      filteredUnionRows = filterUnionsByBranch(unionRows as never, branchIds) as never;
      filteredLinkRows = filterLinksByBranch(linkRows as never, branchIds, unionRows as never) as never;
    }
    // ensure scope root is visible and focus is within branch
    peopleRows = filteredPeopleRows;
    unionRows = filteredUnionRows;
    linkRows = filteredLinkRows;
  }
  // rebind for canvas construction
  const peopleRowsForCanvas = scopeId ? filteredPeopleRows : peopleRows;
  const unionRowsForCanvas = scopeId ? filteredUnionRows : unionRows;
  const linkRowsForCanvas = scopeId ? filteredLinkRows : linkRows;

  const labelDefs = await listLabelDefs(treeId);
  const fieldDefsAll = await listCustomFieldDefs(treeId);
  // Private fields are the owner's eyes only (issue #33) — non-owners get
  // no trace: no chip, no filter option, no value.
  const isOwner = role === "owner";
  const fieldDefs = filterDefsForViewer(fieldDefsAll, isOwner);
  const privateDefIds = new Set(
    fieldDefsAll.filter((f) => !fieldDefs.includes(f)).map((f) => f.id),
  );
  const labelsByPerson = await getPersonLabelsByTree(treeId);
  const customByPerson = await getPersonCustomValuesByTree(treeId);

  const canvasPersons: CanvasPerson[] = peopleRowsForCanvas.map((p) => {
    const lbs = labelsByPerson.get(p.id) ?? [];
    const cvs = (customByPerson.get(p.id) ?? []).filter(
      (c) => !privateDefIds.has(c.fieldId),
    );
    return {
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
      customFields: cvs.map((c) => ({
        fieldId: c.fieldId,
        fieldName: c.fieldName,
        kind: c.kind as never,
        value: c.value,
      })),
    };
  });
  const canvasUnions: CanvasUnion[] = unionRowsForCanvas.map((u) => ({
    id: u.id,
    partnerAId: u.partnerAId,
    partnerBId: u.partnerBId,
    status: u.status,
  }));
  const canvasLinks: CanvasLink[] = linkRowsForCanvas;

  if (canvasPersons.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-display text-3xl font-semibold text-ink">
          {tree.name}
        </h1>
        <p className="mt-2 text-ink-soft">
          An empty tree — every family starts with one person. Usually you.
        </p>
        {editable ? (
          <div className="mt-8 max-w-xl rounded-2xl border border-line bg-card p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              Add the first person
            </h2>
            <FirstPersonForm treeId={treeId} />
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-card/60 px-5 py-6 text-sm text-ink-soft">
            The owner hasn&apos;t added anyone yet — check back soon.
          </p>
        )}
      </div>
    );
  }

  let shareLinkViews: ShareLinkView[] = [];
  let memberNote: string | null = null;
  let headerExtra: React.ReactNode = null;
  if (role === "owner") {
    const shareLinkRows = await listShareLinks(treeId);
    const pendingSuggestions = countPendingSuggestions(treeId);
    shareLinkViews = shareLinkRows.map((l) => ({
      id: l.id,
      token: l.token,
      label: l.label,
      createdAt: l.createdAt.toISOString(),
      revoked: l.revokedAt !== null,
      scopePersonId: (l as unknown as { scopePersonId?: string | null }).scopePersonId ?? null,
    }));
    headerExtra = (
      <>
        <PublicToggle
          treeId={treeId}
          isPublic={tree.visibility === "public"}
          pendingCount={await pendingSuggestions}
        />
        <Link
          href={`/app/trees/${treeId}/labels`}
          className="flex h-8 items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
        >
          Labels & fields
        </Link>
        <Link
          href={`/app/trees/${treeId}/members`}
          className="flex h-8 items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
        >
          Members
        </Link>
        <ShareMenu treeId={treeId} links={shareLinkViews} persons={peopleRowsForCanvas.map((pr) => ({ id: pr.id, firstName: pr.firstName, lastName: pr.lastName }))} unions={unionRowsForCanvas.map((u) => ({ id: u.id, partnerAId: u.partnerAId, partnerBId: u.partnerBId }))} linksData={linkRowsForCanvas} />
      </>
    );
  } else {
    const ownerRows = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, tree.ownerId))
      .limit(1);
    const ownerName = ownerRows[0]?.name;
    memberNote = `You're a ${ROLE_LABEL[role]} on this tree${
      ownerName ? ` — shared by ${ownerName}` : ""
    }.${scopeId ? ` Limited to a branch of ${peopleRowsForCanvas.length} people.` : ""}`;
    // Editors can manage labels/fields even on private trees
    if (editable) {
      const labelsLink = (
        <Link
          href={`/app/trees/${treeId}/labels`}
          className="flex h-8 items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
        >
          Labels & fields
        </Link>
      );
      const suggestionsPart = tree.visibility === "public" ? await (async () => {
        const pendingCount = await countPendingSuggestions(treeId);
        return (
          <a
            href={`/app/trees/${treeId}/suggestions`}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-evergreen/60 bg-evergreen-mist px-2.5 text-xs font-medium text-evergreen-deep transition-colors hover:bg-evergreen hover:text-paper"
          >
            Suggestions
            {pendingCount > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-evergreen px-1 text-[10px] font-semibold text-paper">
                {pendingCount}
              </span>
            )}
          </a>
        );
      })() : null;
      headerExtra = (
        <>
          {labelsLink}
          {suggestionsPart}
        </>
      );
    }
  }

  return (
    <TreeCanvas
      treeId={treeId}
      treeName={tree.name}
      persons={canvasPersons}
      unions={canvasUnions}
      links={canvasLinks}
      focusPersonId={(tree.focusPersonId && peopleRowsForCanvas.some((p) => p.id === tree.focusPersonId) ? tree.focusPersonId : canvasPersons[0]?.id ?? peopleRowsForCanvas[0]?.id) }
      canEdit={editable}
      showExport={true}
      memberNote={memberNote}
      headerExtra={headerExtra}
      importHref={editable ? `/app/trees/${treeId}/import` : null}
      timelineHref={`/app/trees/${treeId}/timeline`}
      mapHref={`/app/trees/${treeId}/map`}
      activityHref={`/app/trees/${treeId}/activity`}
      galleryHref={`/app/trees/${treeId}/gallery`}
      walkthroughHref={`/app/trees/${treeId}/walkthrough`}
      bookHref={`/app/trees/${treeId}/book`}
      insightsHref={`/app/trees/${treeId}/insights`}
      labelDefs={labelDefs.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      fieldDefs={fieldDefs.map((f) => ({ id: f.id, name: f.name, kind: f.kind as never, optionsJson: f.optionsJson }))}
    />
  );
}
