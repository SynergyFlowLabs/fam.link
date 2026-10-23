import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { parentChild, persons, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { recentActivity } from "@/lib/activity-log";
import {
  ACTIVITY_ACTIONS,
  actorInitials,
  describeActivity,
  groupActivitiesByDay,
  isActivityAction,
  parseDetail,
  relativeTime,
  undoAllowed,
  type ActivityAction,
} from "@/lib/activity";
import { UndoButton } from "@/components/activity-feed";
import { getBranchPersonIds } from "@/lib/branch-scope";

export const metadata = { title: "Activity" };

/**
 * Activity feed (issue #31, P3.1) — who changed what, when, with undo for
 * recent changes. Any member (viewer and up) can read; branch-scoped
 * members only see entries that touch their branch; `?actor=&kind=` filters
 * are shareable URLs.
 */
export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ actor?: string; kind?: string }>;
}) {
  const { id: treeId } = await params;
  const { actor, kind } = await searchParams;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();
  const { tree } = access;
  const scopeId = access.scopePersonId ?? null;

  // Branch scope: entries must involve someone inside the branch.
  let branchIds: Set<string> | null = null;
  if (scopeId) {
    const personRows = await db.select().from(persons).where(eq(persons.treeId, treeId));
    const unionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
    const linkRows = await db
      .select({ unionId: parentChild.unionId, childId: parentChild.childId })
      .from(parentChild)
      .innerJoin(unions, eq(parentChild.unionId, unions.id))
      .where(eq(unions.treeId, treeId));
    branchIds = getBranchPersonIds(scopeId, personRows, unionRows, linkRows);
  }

  const nowMs = requestNow();
  let rows = await recentActivity(treeId);
  if (branchIds) {
    rows = rows.filter((r) => {
      const detail = parseDetail(r.detailJson);
      const ids = detail.personIds;
      return Array.isArray(ids) && (ids as string[]).some((pid) => branchIds!.has(pid));
    });
  }
  const allRows = rows; // actor dropdown built before kind filter
  if (kind && isActivityAction(kind)) rows = rows.filter((r) => r.action === kind);
  if (actor === "me") rows = rows.filter((r) => r.actorUserId === user.id);
  else if (actor) rows = rows.filter((r) => r.actorUserId === actor);

  const groups = groupActivitiesByDay(rows, nowMs);

  const actors = new Map<string, string>();
  for (const r of allRows) {
    if (r.actorUserId && !actors.has(r.actorUserId)) actors.set(r.actorUserId, r.actorName);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/app/trees/${treeId}`}
        className="text-sm text-ink-soft transition-colors hover:text-evergreen"
      >
        ← Back to the tree
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Activity</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Who changed what in {tree.name} — recent changes can be undone for five minutes.
          </p>
        </div>
        <form method="get" action={`/app/trees/${treeId}/activity`} className="flex items-center gap-1.5">
          <select
            name="actor"
            defaultValue={actor ?? ""}
            className="h-8 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
            aria-label="Filter by person"
          >
            <option value="">Everyone</option>
            <option value="me">Me</option>
            {[...actors.entries()].map(([uid, name]) => (
              <option key={uid} value={uid}>{name}</option>
            ))}
          </select>
          <select
            name="kind"
            defaultValue={kind ?? ""}
            className="h-8 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
            aria-label="Filter by change type"
          >
            <option value="">All changes</option>
            {ACTIVITY_ACTIONS.filter((a) => a !== "undo").map((a) => (
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
          >
            Filter
          </button>
          {(actor || kind) && (
            <Link
              href={`/app/trees/${treeId}/activity`}
              className="text-xs text-ink-soft transition-colors hover:text-evergreen"
            >
              Clear
            </Link>
          )}
        </form>
      </header>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 p-8 text-center">
          <p className="text-sm text-ink-soft">
            No activity here yet — add a relative or a memory and it will show up with who did it.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="sticky top-14 z-10 -mx-1 bg-paper/95 px-1 py-2 font-display text-sm font-semibold tracking-wide text-evergreen-deep">
                {g.label}
              </h2>
              <ol role="list" className="space-y-2">
                {g.entries.map((r) => {
                  const detail = parseDetail(r.detailJson);
                  const action = isActivityAction(r.action) ? (r.action as ActivityAction) : null;
                  const sentence = action ? describeActivity(action, detail, r.targetLabel) : "made a change";
                  const primaryPerson = Array.isArray(detail.personIds) ? (detail.personIds as string[])[0] : null;
                  const withinWindow = undoAllowed(
                    { undoable: r.undoable, undoneAt: r.undoneAt, createdAt: r.createdAt },
                    0,
                    nowMs,
                  );
                  const canUndo = action !== null && action !== "undo" && withinWindow;
                  return (
                    <li
                      key={r.id}
                      className={`flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 ${r.undoneAt ? "opacity-55" : ""}`}
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-evergreen-mist font-display text-xs font-semibold text-evergreen-deep"
                      >
                        {actorInitials(r.actorName)}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm leading-snug text-ink">
                          <span className="font-medium">{r.actorName}</span> {sentence}
                          {r.undoneAt && <span className="ml-1 text-xs text-ink-soft">· undone</span>}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                          <span>{relativeTime(new Date(r.createdAt).getTime(), nowMs)}</span>
                          {primaryPerson && (
                            <Link
                              href={`/app/trees/${treeId}/person/${primaryPerson}`}
                              className="text-evergreen underline-offset-2 hover:underline"
                            >
                              View person
                            </Link>
                          )}
                        </p>
                      </div>
                      {canUndo && <UndoButton treeId={treeId} activityId={r.id} />}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<ActivityAction, string> = {
  add_person: "People added",
  add_relationship: "Relationships added",
  update_person: "Person updates",
  delete_person: "People removed",
  add_memory: "Memories added",
  delete_memory: "Memories removed",
  add_event: "Life events added",
  update_event: "Life events updated",
  delete_event: "Life events removed",
  invite: "Invites",
  share: "Share links",
  add_comment: "Comments",
  delete_comment: "Comment removals",
  resolve_comment: "Resolved threads",
  suggest: "Suggestions",
  review_suggestion: "Suggestion reviews",
  undo: "Undos",
};


/** Server-rendered "now" — one value per request render pass. */
function requestNow(): number {
  return Date.now();
}
