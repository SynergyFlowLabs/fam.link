import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trees } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { diffPersonFields, fieldsOf, type PersonFields } from "@/lib/person-fields";
import { persons as personsTable } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { listTreeSuggestions } from "@/lib/public-trees";
import { parseSuggestionPayload } from "@/lib/person-fields";
import { SuggestionReviewButtons } from "@/components/suggest-forms";

export const metadata: Metadata = {
  title: "Suggestions",
  robots: { index: false, follow: false },
};

const FIELD_LABELS: [keyof NonNullable<ReturnType<typeof parseSuggestionPayload>>, string][] = [
  ["firstName", "First name"],
  ["lastName", "Family name"],
  ["alsoKnownAs", "Known as"],
  ["gender", "Gender"],
  ["birthDateText", "Born"],
  ["birthPlace", "Birthplace"],
  ["deathDateText", "Died"],
  ["deathPlace", "Resting place"],
  ["notes", "Notes"],
];

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The community review queue for a public tree — owner and editors curate
 * suggestions here. Accepting applies the change through the same mutation
 * core the direct-edit actions use; rejecting just discards it.
 */
export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();
  // Every member can follow the queue (issue #34); reviewing stays editor+.
  const canReview = canEdit(access.role);

  const treeRows = await db
    .select({ name: trees.name, visibility: trees.visibility })
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const suggestions = await listTreeSuggestions(treeId);
  const pending = suggestions.filter((s) => s.suggestion.status === "pending");
  const reviewed = suggestions.filter((s) => s.suggestion.status !== "pending");

  // Old values for the diff view (issue #34): only edit_person targets.
  const editTargets = [...new Set(pending.filter((p) => p.suggestion.type === "edit_person").map((p) => p.suggestion.personId))];
  const oldFieldsById = new Map<string, PersonFields>();
  if (editTargets.length > 0) {
    const rows = await db
      .select()
      .from(personsTable)
      .where(inArray(personsTable.id, editTargets));
    for (const row of rows) {
      oldFieldsById.set(row.id, fieldsOf(row));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/app/trees/${treeId}`}
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← Back to the tree
      </Link>

      <header className="mt-5">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Suggestions
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Community-proposed changes to{" "}
          <span className="font-medium text-ink">{tree.name}</span>
          {tree.visibility === "public"
            ? " — a public tree."
            : " — this tree is private right now; suggestions sent while it was public still appear here."}
        </p>
      </header>

      {pending.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 px-5 py-8 text-center text-sm text-ink-soft">
          Nothing waiting — when other people suggest edits or missing
          relatives, they land here for review.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {pending.map(({ suggestion, authorName, personName }) => {
            const fields = parseSuggestionPayload(suggestion.payloadJson);
            return (
              <li
                key={suggestion.id}
                className="rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {suggestion.type === "add_relative"
                      ? `Add ${suggestion.relation ?? "relative"} of ${personName ?? "someone"}`
                      : `Edit ${personName ?? "someone"}`}
                  </h2>
                  <span className="text-xs text-ink-soft">
                    {authorName ?? "Someone"} · {fmtDate(suggestion.createdAt)}
                  </span>
                </div>

                {fields && (() => {
                  const oldFields = suggestion.type === "edit_person" ? oldFieldsById.get(suggestion.personId) : undefined;
                  const diff = oldFields ? diffPersonFields(oldFields, fields) : null;
                  return diff && diff.length > 0 ? (
                    <dl className="mt-3 text-sm">
                      {diff.map((d) => (
                        <div
                          key={d.key}
                          className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line/70 py-1.5 first:border-t-0"
                        >
                          <dt className="text-ink-soft">{d.label}</dt>
                          <dd className="text-right text-ink">
                            <span className="text-ink-soft/70 line-through">{d.oldText}</span>
                            {" → "}
                            <span className="font-medium">{d.newText}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <dl className="mt-3 text-sm">
                      {FIELD_LABELS.map(([key, label]) => {
                        const value = fields[key];
                        if (value === null || value === false) return null;
                        return (
                          <div
                            key={key}
                            className="flex justify-between gap-4 border-t border-line/70 py-1.5 first:border-t-0"
                          >
                            <dt className="text-ink-soft">{label}</dt>
                            <dd className="text-right text-ink">{String(value)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  );
                })()}

                {suggestion.note && (
                  <blockquote className="mt-3 border-l-[3px] border-gold/60 pl-3 text-sm italic text-ink-soft">
                    “{suggestion.note}”
                  </blockquote>
                )}

                {canReview && (
                  <div className="mt-4">
                    <SuggestionReviewButtons
                      treeId={treeId}
                      suggestionId={suggestion.id}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {reviewed.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-ink">
            Recently reviewed
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {reviewed.slice(0, 10).map(({ suggestion, authorName, reviewerName, personName }) => (
              <li
                key={suggestion.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-line/70 bg-card/60 px-4 py-2.5 text-ink-soft"
              >
                <span>
                  {suggestion.type === "add_relative"
                    ? `Add ${suggestion.relation ?? "relative"} of ${personName ?? "someone"}`
                    : `Edit ${personName ?? "someone"}`}{" "}
                  — {authorName ?? "Someone"}
                </span>
                <span
                  className={
                    suggestion.status === "accepted"
                      ? "font-medium text-evergreen"
                      : "font-medium text-ink-soft/70"
                  }
                >
                  {suggestion.status === "accepted" ? "Accepted" : "Rejected"}
                  {suggestion.reviewedAt ? ` · ${fmtDate(suggestion.reviewedAt)}` : ""}
                  {reviewerName ? ` · by ${reviewerName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
