/**
 * Comment actions (issue #32) — add, resolve, delete.
 *
 * Roles: commenter+ may comment, editor+ may resolve/reopen a thread, and
 * only the comment's author or the tree owner may delete. Threads are one
 * level deep (parentId always points at a root) and resolution lives on
 * the root. Every mutation emits an activity-feed entry (best-effort).
 */
"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canComment } from "@/lib/roles";
import {
  canDeleteComment,
  canResolveComment,
  parseMentionUserIds,
  type CommentTargetType,
} from "@/lib/comments";
import { commentTargetInfo, listMentionableMembers } from "@/lib/comment-queries";
import { logActivity } from "@/lib/activity-log";
import { personWithinScope } from "@/lib/branch-writes";
import { actorNameOf } from "@/lib/actors";
import { fail, type ActionResult } from "@/lib/action-result";

const MAX_BODY = 2000;

function isCommentTargetType(v: unknown): v is CommentTargetType {
  return v === "person" || v === "memory";
}

/** The person page is the single home of every thread — always revalidate it. */
function revalidateThread(treeId: string, personId: string) {
  revalidatePath(`/app/trees/${treeId}/person/${personId}`);
}

export async function addCommentAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canComment(access.role))
    return fail("You're viewing this tree — ask the owner to make you a commenter to join the discussion.");

  const targetType = formData.get("targetType");
  const targetId = String(formData.get("targetId") ?? "");
  if (!isCommentTargetType(targetType)) return fail("That comment target isn't supported.");
  if (!targetId) return fail("That discussion is no longer available.");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return fail("Write something first — even “مجھے یاد ہے” counts.");
  if (body.length > MAX_BODY)
    return fail(`Comments stay under ${MAX_BODY} characters.`);

  const target = await commentTargetInfo(treeId, targetType, targetId);
  if (!target) return fail("That person or memory is no longer in this tree.");
  if (!(await personWithinScope(access.scopePersonId, treeId, target.personId)))
    return fail("That person is outside your branch — ask the owner to widen your scope.");

  // One level deep: a reply to a reply attaches to the reply's root.
  const parentIdRaw = String(formData.get("parentId") ?? "");
  let parentId: string | null = null;
  if (parentIdRaw) {
    const parentRows = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, parentIdRaw), eq(comments.treeId, treeId)))
      .limit(1);
    const parent = parentRows[0];
    if (!parent || parent.targetId !== targetId || parent.targetType !== targetType)
      return fail("That thread is gone — start a new comment instead.");
    parentId = parent.parentId ?? parent.id;
  }

  const id = randomUUID();
  await db.insert(comments).values({
    id,
    treeId,
    targetType,
    targetId,
    authorUserId: user.id,
    authorName: user.name,
    body,
    parentId,
  });

  // Best-effort feed entry (never fails the comment itself).
  const members = await listMentionableMembers(treeId);
  try {
    await logActivity({
      treeId,
      actorUserId: user.id,
      actorName: await actorNameOf(user.id),
      action: "add_comment",
      targetType,
      targetId,
      targetLabel: target.personName,
      detail: {
        personIds: [target.personId],
        personName: target.personName,
        memory: targetType === "memory",
        commentId: id,
        mentionedUserIds: parseMentionUserIds(body, members),
      },
      undoable: false,
    });
  } catch {
    // feed is best-effort
  }

  revalidateThread(treeId, target.personId);
  return { ok: true };
}

export async function resolveCommentAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const commentId = String(formData.get("commentId") ?? "");
  const resolved = String(formData.get("resolved") ?? "1") === "1";
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  const comment = rows[0];
  if (!comment) return fail("That comment is already gone.");
  const access = await getTreeAccess(comment.treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canResolveComment(access.role))
    return fail("Only editors and the owner can resolve threads.");
  if (comment.parentId) return fail("Only whole threads can be resolved.");

  const name = await actorNameOf(user.id);
  await db
    .update(comments)
    .set({
      resolved,
      resolvedByUserId: resolved ? user.id : null,
      resolvedByName: resolved ? name : null,
      updatedAt: new Date(),
    })
    .where(eq(comments.id, commentId));

  const target = await commentTargetInfo(
    comment.treeId,
    comment.targetType,
    comment.targetId,
  );
  try {
    await logActivity({
      treeId: comment.treeId,
      actorUserId: user.id,
      actorName: name,
      action: "resolve_comment",
      targetType: comment.targetType,
      targetId: comment.targetId,
      targetLabel: target?.personName ?? null,
      detail: {
        personIds: target ? [target.personId] : [],
        personName: target?.personName,
        memory: comment.targetType === "memory",
        commentId,
        threadResolved: resolved,
      },
      undoable: false,
    });
  } catch {
    // feed is best-effort
  }

  if (target) revalidateThread(comment.treeId, target.personId);
  return { ok: true };
}

export async function deleteCommentAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const commentId = String(formData.get("commentId") ?? "");
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  const comment = rows[0];
  if (!comment) return fail("That comment is already gone.");
  const access = await getTreeAccess(comment.treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canDeleteComment(access.role, user.id, comment.authorUserId))
    return fail("Only the comment's author or the tree owner can remove it.");

  // Deleting a root takes its replies with it.
  await db
    .delete(comments)
    .where(
      comment.parentId
        ? eq(comments.id, commentId)
        : and(eq(comments.treeId, comment.treeId), eq(comments.parentId, commentId)),
    );
  await db.delete(comments).where(eq(comments.id, commentId));

  const target = await commentTargetInfo(
    comment.treeId,
    comment.targetType,
    comment.targetId,
  );
  try {
    await logActivity({
      treeId: comment.treeId,
      actorUserId: user.id,
      actorName: await actorNameOf(user.id),
      action: "delete_comment",
      targetType: comment.targetType,
      targetId: comment.targetId,
      targetLabel: target?.personName ?? null,
      detail: {
        personIds: target ? [target.personId] : [],
        personName: target?.personName,
        memory: comment.targetType === "memory",
        commentId,
      },
      undoable: false,
    });
  } catch {
    // feed is best-effort
  }

  if (target) revalidateThread(comment.treeId, target.personId);
  return { ok: true };
}
