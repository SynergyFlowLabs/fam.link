"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { persons, treeSuggestions, trees } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import {
  parsePersonFields,
  parseSuggestionPayload,
} from "@/lib/person-fields";
import {
  addRelativeToTree,
  revalidateTree,
  updatePersonInTree,
  type Relation,
} from "@/lib/tree-mutations";
import { fail, type ActionResult } from "@/lib/action-result";

/**
 * Public trees & community contributions.
 *
 * Publishing is owner-only. Suggestions ("edit/updates requests") are the
 * contribution path for everyone else: any signed-in user who is not
 * already an owner/editor of the tree can propose a fact correction
 * (edit_person) or a missing relative (add_relative). The owner and
 * invited editors curate the queue — accepting applies the change through
 * the same mutation core the direct-edit actions use.
 */

/** Owner publishes / unpublishes a tree. */
export async function publishTreeAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const makePublic = formData.get("public") === "true";
  const rows = await db
    .select()
    .from(trees)
    .where(and(eq(trees.id, treeId), eq(trees.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) return fail("That tree no longer exists.");

  await db
    .update(trees)
    .set({ visibility: makePublic ? "public" : "private", updatedAt: new Date() })
    .where(eq(trees.id, treeId));
  revalidatePath("/explore");
  revalidatePath(`/explore/${treeId}`);
  revalidatePath(`/app/trees/${treeId}`);
  return {
    ok: true,
    message: makePublic
      ? "Published — the tree is now on /explore"
      : "Back to private",
  };
}

function revalidateSuggestions(treeId: string) {
  revalidatePath(`/app/trees/${treeId}/suggestions`);
  revalidatePath(`/explore/${treeId}`);
}

/** A signed-in non-editor proposes a change to a public tree. */
export async function createSuggestionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const treeId = String(formData.get("treeId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const type = String(formData.get("type") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);

  const treeRows = await db
    .select()
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  const tree = treeRows[0];
  if (!tree) return fail("That tree doesn't exist anymore.");

  const personRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!personRows[0]) return fail("That person is no longer in this tree.");

  // Members suggest when they can't edit directly (viewer/commenter —
  // issue #34); editors have no need. Anonymous suggesters need a public tree.
  const access = await getTreeAccess(treeId, user.id);
  if (access && canEdit(access.role)) {
    return fail("You can edit this tree directly — no suggestion needed.");
  }
  if (!access && tree.visibility !== "public") {
    return fail("That tree isn't public anymore.");
  }

  const fields = parsePersonFields(formData);
  let relation: Relation | null = null;
  if (type === "add_relative") {
    const r = String(formData.get("relation") ?? "");
    if (!["father", "mother", "spouse", "child"].includes(r)) {
      return fail("Pick how they're related.");
    }
    relation = r as Relation;
  } else if (type !== "edit_person") {
    return fail("Unknown suggestion type.");
  }

  // One pending suggestion per (person, author, type, relation): a new one
  // replaces the old, keeping the queue readable.
  await db
    .delete(treeSuggestions)
    .where(
      and(
        eq(treeSuggestions.treeId, treeId),
        eq(treeSuggestions.personId, personId),
        eq(treeSuggestions.createdBy, user.id),
        eq(treeSuggestions.type, type as "edit_person" | "add_relative"),
        eq(treeSuggestions.status, "pending"),
      ),
    );

  await db.insert(treeSuggestions).values({
    id: randomUUID(),
    treeId,
    personId,
    type: type as "edit_person" | "add_relative",
    relation,
    payloadJson: JSON.stringify(fields),
    note: note || null,
    createdBy: user.id,
  });

  // Audit trail (issue #34): suggestions are contributions too.
  try {
    const { logActivity } = await import("@/lib/activity-log");
    const nm = await db
      .select({ first: persons.firstName, last: persons.lastName })
      .from(persons)
      .where(eq(persons.id, personId))
      .limit(1);
    const personName: string | null = nm[0]
      ? [nm[0].first, nm[0].last].filter(Boolean).join(" ") || null
      : null;
    await logActivity({
      treeId,
      actorUserId: user.id,
      actorName: user.name,
      action: "suggest",
      targetType: "person",
      targetId: personId,
      targetLabel: personName,
      detail: {
        personIds: [personId],
        personName: personName ?? undefined,
        suggestionKind: type,
        relation: relation ?? undefined,
      },
      undoable: false,
    });
  } catch {
    // feed is best-effort
  }

  revalidateSuggestions(treeId);
  return {
    ok: true,
    message: "Suggestion sent — the tree's editors will review it",
  };
}

/** Editor-and-up: accept (apply) or reject a pending suggestion. */
export async function reviewSuggestionAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role))
    return fail("Reviewing suggestions needs the Editor role.");

  const rows = await db
    .select()
    .from(treeSuggestions)
    .where(
      and(
        eq(treeSuggestions.id, suggestionId),
        eq(treeSuggestions.treeId, treeId),
      ),
    )
    .limit(1);
  const suggestion = rows[0];
  if (!suggestion) return fail("That suggestion is already gone.");
  if (suggestion.status !== "pending")
    return fail("That suggestion was already reviewed.");

  // Branch-scoped editors review only their branch (issue #34).
  const { personWithinScope } = await import("@/lib/branch-writes");
  if (!(await personWithinScope(access.scopePersonId, treeId, suggestion.personId))) {
    return fail("That person is outside your branch — ask the owner to review it.");
  }

  if (decision === "reject") {
    await db
      .update(treeSuggestions)
      .set({ status: "rejected", reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(treeSuggestions.id, suggestionId));
    await logReview(treeId, user, suggestion, false);
    revalidateSuggestions(treeId);
    return { ok: true, message: "Suggestion rejected" };
  }
  if (decision !== "accept") return fail("Unknown decision.");

  const fields = parseSuggestionPayload(suggestion.payloadJson);
  if (!fields) {
    await db
      .update(treeSuggestions)
      .set({ status: "rejected", reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(treeSuggestions.id, suggestionId));
    return fail("That suggestion was malformed — rejected.");
  }

  let result: ActionResult;
  if (suggestion.type === "edit_person") {
    result = await updatePersonInTree(treeId, suggestion.personId, fields);
  } else {
    result = await addRelativeToTree(
      treeId,
      suggestion.personId,
      (suggestion.relation ?? "child") as Relation,
      fields,
    );
  }
  if (!result.ok) return result;

  await db
    .update(treeSuggestions)
    .set({ status: "accepted", reviewedBy: user.id, reviewedAt: new Date() })
    .where(eq(treeSuggestions.id, suggestionId));
  await logReview(treeId, user, suggestion, true);
  revalidateTree(treeId, suggestion.personId);
  revalidateSuggestions(treeId);
  return {
    ok: true,
    message:
      suggestion.type === "add_relative"
        ? `Accepted — ${result.message} added to the tree`
        : `Accepted — ${result.message} updated`,
  };
}

/** Best-effort activity entry for a review decision (issue #34). */
async function logReview(
  treeId: string,
  user: { id: string; name: string },
  suggestion: { personId: string; type: "edit_person" | "add_relative"; relation: string | null },
  approved: boolean,
): Promise<void> {
  try {
    const { logActivity } = await import("@/lib/activity-log");
    const nm = await db
      .select({ first: persons.firstName, last: persons.lastName })
      .from(persons)
      .where(eq(persons.id, suggestion.personId))
      .limit(1);
    const personName = nm[0]
      ? [nm[0].first, nm[0].last].filter(Boolean).join(" ") || undefined
      : undefined;
    await logActivity({
      treeId,
      actorUserId: user.id,
      actorName: user.name,
      action: "review_suggestion",
      targetType: "person",
      targetId: suggestion.personId,
      targetLabel: personName ?? null,
      detail: {
        personIds: [suggestion.personId],
        personName,
        suggestionKind: suggestion.type,
        relation: suggestion.relation ?? undefined,
        suggestionApproved: approved,
      },
      undoable: false,
    });
  } catch {
    // feed is best-effort
  }
}
