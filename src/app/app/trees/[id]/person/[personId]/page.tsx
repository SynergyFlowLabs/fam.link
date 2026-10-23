import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, personEvents, persons, unions } from "@/db/schema";
import { CommentSection, type CommentDTO } from "@/components/comments/comment-thread";
import { listCommentsForTargets, listMentionableMembers } from "@/lib/comment-queries";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canComment, canEdit } from "@/lib/roles";
import { displayName, lifeLine } from "@/lib/canvas-types";
import { relationLabel } from "@/lib/layout/edges";
import { AddRelativeCard, EditPersonForm, MemorySection, DeletePersonButton } from "@/components/person-forms";
import { PersonLabelsSection, PersonCustomFieldsSection } from "@/components/labels-fields";
import { PersonTimelineSection } from "@/components/person-events";
import { getMemoryLabelsByTree, getPersonCustomValues, getPersonLabels, listCustomFieldDefs, listLabelDefs } from "@/lib/tree-labels";
import { sortEvents } from "@/lib/person-events";
import { filterDefsForViewer } from "@/lib/custom-fields";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id: treeId, personId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();
  const role = access.role;

  let personRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  let unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  let linkRows = unionRows.length > 0 ? await db.select().from(parentChild).where(inArray(parentChild.unionId, unionRows.map((u) => u.id))) : [];
  const scopeId = (access as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  if (scopeId) {
    const { getBranchPersonIds } = await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, personRows as never, unionRows as never, linkRows as never);
    if (!branchIds || !branchIds.has(personId)) notFound();
    personRows = personRows.filter((pr) => branchIds.has(pr.id));
  }
  const person = personRows.find((p) => p.id === personId);
  if (!person) notFound();
  const personMap = new Map(personRows.map((p) => [p.id, p]));

  if (scopeId) {
    const { filterUnionsByBranch, filterLinksByBranch } = await import("@/lib/branch-scope");
    unionRows = filterUnionsByBranch(unionRows as never, (await import("@/lib/branch-scope")).getBranchPersonIds(scopeId, personRows as never, unionRows as never, linkRows as never)!) as never;
    // Re-filter linkRows to keep only unions in branch and children in branch
    const branchIds = (await import("@/lib/branch-scope")).getBranchPersonIds(scopeId, personRows as never, unionRows as never, linkRows as never);
    if (branchIds) linkRows = filterLinksByBranch(linkRows as never, branchIds, unionRows as never) as never;
  } else {
    unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
    linkRows = unionRows.length > 0 ? await db.select().from(parentChild).where(inArray(parentChild.unionId, unionRows.map((u) => u.id))) : [];
  }

  const parents: { id: string; label: string }[] = [];
  const siblings = new Set<string>();
  for (const l of linkRows.filter((l) => l.childId === personId)) {
    const u = unionRows.find((x) => x.id === l.unionId);
    if (!u) continue;
    for (const pid of [u.partnerAId, u.partnerBId]) {
      if (pid && pid !== personId && personMap.has(pid)) {
        const rel = (l as unknown as { relation?: string | null }).relation;
        parents.push({ id: pid, label: rel && rel !== "biological" ? relationLabel(rel) : "parent" });
      }
    }
    for (const other of linkRows.filter(
      (x) => x.unionId === u.id && x.childId !== personId,
    )) {
      if (personMap.has(other.childId)) siblings.add(other.childId);
    }
  }

  const spouses: { id: string; status: string | null }[] = [];
  const children: { id: string; relation: string | null }[] = [];
  const childSeen = new Set<string>();
  for (const u of unionRows) {
    if (u.partnerAId !== personId && u.partnerBId !== personId) continue;
    const other = u.partnerAId === personId ? u.partnerBId : u.partnerAId;
    if (other && personMap.has(other)) spouses.push({ id: other, status: u.status });
    for (const l of linkRows.filter((l) => l.unionId === u.id)) {
      if (personMap.has(l.childId) && !childSeen.has(l.childId)) {
        childSeen.add(l.childId);
        children.push({ id: l.childId, relation: (l as unknown as { relation?: string }).relation ?? null });
      }
    }
  }

  const memoryRows = await db
    .select()
    .from(memories)
    .where(eq(memories.personId, personId));

  const eventRows = await db
    .select()
    .from(personEvents)
    .where(eq(personEvents.personId, personId));
  const sortedEvents = sortEvents(
    eventRows.map((ev) => ({
      id: ev.id,
      personId: ev.personId,
      kind: ev.kind as import("@/lib/person-events").EventKind,
      dateText: ev.dateText,
      placeText: ev.placeText,
      note: ev.note,
      source: ev.source,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
    })),
  );

  const personLabels = await getPersonLabels(personId);
  const allLabelDefs = await listLabelDefs(treeId);
  const fieldDefsAll = await listCustomFieldDefs(treeId);
  const personFieldValuesAll = await getPersonCustomValues(personId);
  // Private fields: owner only (issue #33) — hidden values, not just
  // hidden inputs.
  const isOwner = role === "owner";
  const fieldDefs = filterDefsForViewer(fieldDefsAll, isOwner);
  const visibleDefIds = new Set(fieldDefs.map((f) => f.id));
  const personFieldValues = personFieldValuesAll.filter((v) =>
    visibleDefIds.has(v.fieldId),
  );
  const memoryLabelsMap = await getMemoryLabelsByTree(treeId);

  // Discussion threads: on the person + on each of their memories (issue #32).
  const commentRows = await listCommentsForTargets(treeId, [
    { type: "person", id: personId },
    ...memoryRows.map((m) => ({ type: "memory" as const, id: m.id })),
  ]);
  const toDTO = (c: (typeof commentRows)[number]): CommentDTO => ({
    id: c.id,
    parentId: c.parentId,
    authorUserId: c.authorUserId,
    authorName: c.authorName,
    body: c.body,
    resolved: c.resolved,
    resolvedByName: c.resolvedByName,
    createdAtMs: new Date(c.createdAt).getTime(),
  });
  const personComments = commentRows
    .filter((c) => c.targetType === "person")
    .map(toDTO);
  const memoryComments = new Map<string, CommentDTO[]>();
  for (const c of commentRows) {
    if (c.targetType !== "memory") continue;
    const list = memoryComments.get(c.targetId) ?? [];
    list.push(toDTO(c));
    memoryComments.set(c.targetId, list);
  }
  const mentionMembers = await listMentionableMembers(treeId);
  const memberLinks = Object.fromEntries(
    mentionMembers
      .filter((m) => m.personId)
      .map((m) => [m.userId, `/app/trees/${treeId}/person/${m.personId}`]),
  );
  const commentSectionProps = {
    treeId,
    viewer: { id: user.id, name: user.name },
    canComment: canComment(role),
    canResolve: canEdit(role),
    canManage: role === "owner",
    members: mentionMembers,
    memberLinks,
  };

  const name = displayName(person);
  const initials = [person.firstName, person.lastName]
    .map((w) => (w ? w[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const facts: [string, string | null][] = [
    ["Known as", person.alsoKnownAs],
    ["Born", [person.birthDateText, person.birthPlace].filter(Boolean).join(" · ") || null],
    [
      person.living ? "Status" : "Died",
      person.living
        ? "Living"
        : [person.deathDateText, person.deathPlace].filter(Boolean).join(" · ") || null,
    ],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/app/trees/${treeId}`}
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← Back to the tree
      </Link>

      <header className="mt-5 flex flex-wrap items-center gap-5">
        <span
          aria-hidden
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-2xl font-semibold ${
            person.living
              ? "bg-evergreen-mist text-evergreen-deep"
              : "bg-rosewood-mist text-rosewood"
          }`}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold text-ink">{name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2.5 text-ink-soft">
            <span
              className={`chip ${
                person.living
                  ? "bg-evergreen-mist text-evergreen-deep"
                  : "bg-rosewood-mist text-rosewood"
              }`}
            >
              {person.living ? "Living" : "At rest"}
            </span>
            <span>{lifeLine(person)}</span>
          </p>
        </div>
      </header>

      {person.notes && (
        <blockquote className="mt-5 border-l-[3px] border-evergreen/40 pl-4 font-display text-[15px] leading-relaxed text-ink-soft italic">
          {person.notes}
        </blockquote>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Facts</h2>
          <dl className="mt-3 text-sm">
            {facts.map(([label, value], i) => (
              <div
                key={label}
                className={`flex justify-between gap-4 py-2 ${i > 0 ? "border-t border-line/70" : ""}`}
              >
                <dt className="text-ink-soft">{label}</dt>
                <dd className="text-right text-ink">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-7 mb-3 border-t border-line pt-4 text-sm font-semibold text-ink">
            Relationships
          </h3>
          <RelList title="Parents" items={parents.map((p) => p.id)} personMap={personMap} treeId={treeId} badges={Object.fromEntries(parents.map((p) => [p.id, p.label !== "parent" ? p.label : null]))} />
          <RelList title="Spouses" items={spouses.map((s) => s.id)} personMap={personMap} treeId={treeId} />
          <RelList
            title="Children"
            items={children.map((c) => c.id)}
            personMap={personMap}
            treeId={treeId}
            badges={Object.fromEntries(children.map((c) => [c.id, c.relation && c.relation !== "biological" ? c.relation : null]))}
          />
          <RelList
            title="Siblings"
            items={[...siblings]}
            personMap={personMap}
            treeId={treeId}
            last
          />
        </section>

        <MemorySection
          treeId={treeId}
          personId={personId}
          personName={name}
          commentNodes={Object.fromEntries(
            memoryRows
              .filter((m) => memoryComments.has(m.id) || canComment(role))
              .map((m) => [
                m.id,
                <CommentSection
                  key={m.id}
                  targetType="memory"
                  targetId={m.id}
                  comments={memoryComments.get(m.id) ?? []}
                  compact
                  {...commentSectionProps}
                />,
              ]),
          )}
          canAdd={canComment(role)}
          canDeleteAny={canEdit(role)}
          canLabel={canComment(role) || canEdit(role)}
          allLabelDefs={allLabelDefs.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
          memoryLabelsMap={Object.fromEntries(
            memoryRows.map((m) => {
              const lbs = memoryLabelsMap.get(m.id) ?? [];
              return [m.id, lbs.map((l) => ({ id: l.id, name: l.name, color: l.color }))];
            }),
          )}
          initialMemories={memoryRows.map((m) => ({
            id: m.id,
            kind: m.kind,
            body: m.body,
            occurredText: m.occurredText,
            authorName: m.authorName,
            mediaId: m.mediaId,
            mine: m.authorUserId === user.id,
            createdAt: new Date(m.createdAt).toLocaleDateString("en", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          }))}
        />
      </div>

      <div className="mt-6">
        <PersonTimelineSection
          treeId={treeId}
          personId={personId}
          personName={name}
          events={sortedEvents}
          canEdit={canEdit(role)}
        />
      </div>

      <div className="mt-6">
        <CommentSection
          targetType="person"
          targetId={personId}
          comments={personComments}
          defaultOpen
          {...commentSectionProps}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <PersonLabelsSection
          treeId={treeId}
          personId={personId}
          labels={personLabels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
          allLabelDefs={allLabelDefs.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
          canEdit={canEdit(role)}
        />
        <PersonCustomFieldsSection
          treeId={treeId}
          personId={personId}
          fieldDefs={fieldDefs.map((f) => ({ id: f.id, name: f.name, kind: f.kind as string, optionsJson: f.optionsJson }))}
          values={personFieldValues}
          canEdit={canEdit(role)}
        />
      </div>

      {canEdit(role) && (
      <div className="mt-6">
        <AddRelativeCard treeId={treeId} personId={person.id} personName={name} />
      </div>
      )}

      {canEdit(role) && (
      <details className="mt-6 rounded-2xl border border-line bg-card p-5">
        <summary className="cursor-pointer font-display text-lg font-semibold text-ink">
          Edit details
        </summary>
        <div className="mt-4">
          <EditPersonForm treeId={treeId} person={person} />
          <div className="mt-6 border-t border-line pt-4">
            <DeletePersonButton
              treeId={treeId}
              personId={person.id}
              personName={name}
            />
          </div>
        </div>
      </details>
      )}
    </div>
  );
}

function RelList({
  title,
  items,
  personMap,
  treeId,
  last = false,
  badges,
}: {
  title: string;
  items: string[];
  personMap: Map<string, typeof persons.$inferSelect>;
  treeId: string;
  last?: boolean;
  badges?: Record<string, string | null>;
}) {
  return (
    <div className={last ? "" : "mb-2.5"}>
      <p className="text-xs text-ink-soft">
        {title}{" "}
        <span className="opacity-70">
          {items.length > 0 ? `(${items.length})` : ""}
        </span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft/60">None added yet</p>
      ) : (
        <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          {items.map((id) => {
            const p = personMap.get(id);
            if (!p) return null;
            const badge = badges?.[id];
            return (
              <li key={id} className="inline-flex items-center gap-1">
                <Link
                  href={`/app/trees/${treeId}/person/${id}`}
                  className="text-evergreen underline-offset-2 hover:underline"
                >
                  {displayName(p)}
                </Link>
                {badge && <span className="rounded-full bg-evergreen-mist px-1.5 py-0.5 text-[10px] font-medium text-evergreen-deep">{badge}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
