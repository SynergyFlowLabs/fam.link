import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { memories, parentChild, persons, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { getPublicTree } from "@/lib/public-trees";
import { displayName, lifeLine, REDACTED_NAME } from "@/lib/canvas-types";
import { getMemoryLabelsByTree, getPersonCustomValues, getPersonLabels } from "@/lib/tree-labels";
import { labelColorFor } from "@/lib/labels";
import {
  SuggestEditForm,
  SuggestRelativeForm,
} from "@/components/suggest-forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}): Promise<Metadata> {
  const { id: treeId, personId } = await params;
  const tree = await getPublicTree(treeId);
  if (!tree) return { title: "Public tree" };
  const rows = await db
    .select({ firstName: persons.firstName, lastName: persons.lastName })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  const p = rows[0];
  if (!p || p.firstName === null) return { title: tree.name };
  return {
    title: `${displayName(p)} · ${tree.name}`,
  };
}

/**
 * Public person page on a published tree. Deceased people are shown in
 * full; living people 404 — their existence in a public tree stays private.
 * Signed-in visitors who aren't already editors get the suggestion forms.
 */
export default async function ExplorePersonPage({
  params,
}: {
  params: Promise<{ id: string; personId: string }>;
}) {
  const { id: treeId, personId } = await params;
  const tree = await getPublicTree(treeId);
  if (!tree) notFound();

  const personRows = await db
    .select()
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const person = personRows.find((p) => p.id === personId);
  if (!person) notFound();
  // Living relatives have no public page — not even a redacted one.
  if (person.living) notFound();
  const personMap = new Map(personRows.map((p) => [p.id, p]));

  const unionRows = await db
    .select()
    .from(unions)
    .where(eq(unions.treeId, treeId));
  const linkRows =
    unionRows.length > 0
      ? await db
          .select()
          .from(parentChild)
          .where(
            inArray(
              parentChild.unionId,
              unionRows.map((u) => u.id),
            ),
          )
      : [];

  // Relations: deceased link to their public pages; living show redacted.
  const relate = (id: string) => {
    const p = personMap.get(id);
    if (!p) return null;
    return p.living
      ? { id, name: REDACTED_NAME, href: null }
      : { id, name: displayName(p), href: `/explore/${treeId}/person/${id}` };
  };

  const parentIds: string[] = [];
  const siblingIds = new Set<string>();
  for (const l of linkRows.filter((l) => l.childId === personId)) {
    const u = unionRows.find((x) => x.id === l.unionId);
    if (!u) continue;
    for (const pid of [u.partnerAId, u.partnerBId]) {
      if (pid && pid !== personId && personMap.has(pid)) parentIds.push(pid);
    }
    for (const other of linkRows.filter(
      (x) => x.unionId === u.id && x.childId !== personId,
    )) {
      if (personMap.has(other.childId)) siblingIds.add(other.childId);
    }
  }
  const spouseIds: string[] = [];
  const childIds = new Set<string>();
  for (const u of unionRows) {
    if (u.partnerAId !== personId && u.partnerBId !== personId) continue;
    const other = u.partnerAId === personId ? u.partnerBId : u.partnerAId;
    if (other && personMap.has(other)) spouseIds.push(other);
    for (const l of linkRows.filter((x) => x.unionId === u.id)) {
      if (personMap.has(l.childId)) childIds.add(l.childId);
    }
  }

  const memoryRows = await db
    .select()
    .from(memories)
    .where(eq(memories.personId, personId));

  const personLabels = await getPersonLabels(personId);
  const personFieldValues = await getPersonCustomValues(personId);
  const memoryLabelsMap = await getMemoryLabelsByTree(treeId);

  const user = await getCurrentUser();
  const access = user ? await getTreeAccess(treeId, user.id) : null;
  const canSuggest = Boolean(user) && !(access && canEdit(access.role));

  const name = displayName(person);
  const initials = [person.firstName, person.lastName]
    .map((w) => (w ? w[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const facts: [string, string | null][] = [
    ["Known as", person.alsoKnownAs],
    [
      "Born",
      [person.birthDateText, person.birthPlace].filter(Boolean).join(" · ") ||
        null,
    ],
    [
      "Died",
      [person.deathDateText, person.deathPlace].filter(Boolean).join(" · ") ||
        null,
    ],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/explore/${treeId}`}
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← Back to {tree.name}
      </Link>

      <header className="mt-5 flex flex-wrap items-center gap-5">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-rosewood-mist font-display text-2xl font-semibold text-rosewood"
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold text-ink">
            {name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2.5 text-ink-soft">
            <span className="chip bg-rosewood-mist text-rosewood">At rest</span>
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

          {personLabels.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-xs font-medium text-ink-soft">Labels</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {personLabels.map((l) => (
                  <span
                    key={l.id}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${labelColorFor(l.name, l.color)}18`, borderColor: labelColorFor(l.name, l.color), color: labelColorFor(l.name, l.color) }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {personFieldValues.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-xs font-medium text-ink-soft">Custom fields</h3>
              <dl className="mt-2 space-y-1 text-sm">
                {personFieldValues.map((v) => (
                  <div key={v.fieldId} className="flex justify-between gap-4">
                    <dt className="text-ink-soft">{v.fieldName}</dt>
                    <dd className="text-ink">{v.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <h3 className="mt-7 mb-3 border-t border-line pt-4 text-sm font-semibold text-ink">
            Relationships
          </h3>
          <RelList title="Parents" items={parentIds.map(relate)} />
          <RelList title="Spouses" items={spouseIds.map(relate)} />
          <RelList title="Children" items={[...childIds].map(relate)} />
          <RelList title="Siblings" items={[...siblingIds].map(relate)} last />
        </section>

        <section>
          {memoryRows.length > 0 && (
            <div className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-display text-lg font-semibold text-ink">
                Memories
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {memoryRows.map((m) => {
                  const mLabels = memoryLabelsMap.get(m.id) ?? [];
                  return (
                    <li
                      key={m.id}
                      className="rounded-xl border border-line/70 bg-paper px-4 py-3"
                    >
                      <p className="text-sm leading-relaxed text-ink">{m.body}</p>
                      {mLabels.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mLabels.map((l) => (
                            <span
                              key={l.id}
                              className="rounded-full border px-2 py-0.5 text-[11px]"
                              style={{ backgroundColor: `${labelColorFor(l.name, l.color)}14`, borderColor: labelColorFor(l.name, l.color), color: labelColorFor(l.name, l.color) }}
                            >
                              {l.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1.5 text-xs text-ink-soft">
                        {m.kind === "photo"
                          ? "📷 "
                          : m.kind === "voice"
                            ? "🎙 "
                          : ""}
                        {m.authorName ?? "Someone"}
                        {m.occurredText ? ` · ${m.occurredText}` : ""} ·{" "}
                        {new Date(m.createdAt).toLocaleDateString("en", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {canSuggest ? (
            <div className="mt-6 rounded-2xl border border-gold/50 bg-gold/5 p-5">
              <h2 className="font-display text-lg font-semibold text-ink">
                Spot something? Help improve this tree
              </h2>
              <p className="mt-1 text-xs text-ink-soft">
                Your suggestions go to {tree.name}&apos;s editors for review.
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-evergreen">
                  Suggest a missing relative
                </summary>
                <div className="mt-4">
                  <SuggestRelativeForm
                    treeId={treeId}
                    personId={person.id}
                    personName={name}
                  />
                </div>
              </details>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-evergreen">
                  Suggest an edit to {name}&apos;s details
                </summary>
                <div className="mt-4">
                  <SuggestEditForm treeId={treeId} person={person} />
                </div>
              </details>
            </div>
          ) : user ? (
            <div className="mt-6 rounded-2xl border border-evergreen/40 bg-evergreen-mist/50 px-5 py-4 text-sm text-ink-soft">
              You can edit this tree directly —{" "}
              <Link
                href={`/app/trees/${treeId}/person/${person.id}`}
                className="font-medium text-evergreen underline-offset-2 hover:underline"
              >
                open it in your workspace
              </Link>
              .
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-line bg-card/60 px-5 py-4 text-sm text-ink-soft">
              Know this history?{" "}
              <Link
                href={`/signin?next=/explore/${treeId}/person/${person.id}`}
                className="font-medium text-evergreen underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to suggest edits and missing relatives.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RelList({
  title,
  items,
  last = false,
}: {
  title: string;
  items: ({ id: string; name: string; href: string | null } | null)[];
  last?: boolean;
}) {
  const shown = items.filter((x): x is { id: string; name: string; href: string | null } => x !== null);
  return (
    <div className={last ? "" : "mb-2.5"}>
      <p className="text-xs text-ink-soft">
        {title}{" "}
        <span className="opacity-70">
          {shown.length > 0 ? `(${shown.length})` : ""}
        </span>
      </p>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-soft/60">None added yet</p>
      ) : (
        <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
          {shown.map((r) => (
            <li key={r.id}>
              {r.href ? (
                <Link
                  href={r.href}
                  className="text-evergreen underline-offset-2 hover:underline"
                >
                  {r.name}
                </Link>
              ) : (
                <span className="text-ink-soft/70">{r.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
