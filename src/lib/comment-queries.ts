import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { comments, memories, persons, treeMembers, trees, users } from "@/db/schema";
import type { CommentTargetType } from "@/lib/comments";

/** All comments for a set of targets (person page: the person + its memories). */
export async function listCommentsForTargets(
  treeId: string,
  targets: { type: CommentTargetType; id: string }[],
): Promise<(typeof comments.$inferSelect)[]> {
  if (targets.length === 0) return [];
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.treeId, treeId))
    .orderBy(comments.createdAt);
  const wanted = new Set(targets.map((t) => `${t.type}:${t.id}`));
  return rows.filter((r) => wanted.has(`${r.targetType}:${r.targetId}`));
}

/**
 * Everyone mentionable in a tree — members AND the owner (the owner has no
 * tree_members row). The @mention autocomplete source; personId links a
 * member to their person page when one is assigned.
 */
export async function listMentionableMembers(
  treeId: string,
): Promise<{ userId: string; name: string; personId: string | null }[]> {
  const [rows, ownerRows] = await Promise.all([
    db
      .select({
        userId: treeMembers.userId,
        name: users.name,
        personId: treeMembers.scopePersonId,
      })
      .from(treeMembers)
      .innerJoin(users, eq(treeMembers.userId, users.id))
      .where(eq(treeMembers.treeId, treeId)),
    db
      .select({ userId: trees.ownerId, name: users.name })
      .from(trees)
      .innerJoin(users, eq(trees.ownerId, users.id))
      .where(eq(trees.id, treeId)),
  ]);
  const seen = new Map<string, { userId: string; name: string; personId: string | null }>();
  for (const r of ownerRows) seen.set(r.userId, { ...r, personId: null });
  for (const r of rows) if (!seen.has(r.userId)) seen.set(r.userId, r);
  return [...seen.values()];
}

/**
 * Comment target label — the person's display name, or the caption/owner of
 * a memory ("a memory of Farida"). Returns null when the target isn't in
 * this tree (invalid target → the action refuses).
 */
export async function commentTargetInfo(
  treeId: string,
  targetType: CommentTargetType,
  targetId: string,
): Promise<{ personId: string; personName: string } | null> {
  if (targetType === "person") {
    const rows = await db
      .select({ id: persons.id, first: persons.firstName, last: persons.lastName })
      .from(persons)
      .where(and(eq(persons.id, targetId), eq(persons.treeId, treeId)))
      .limit(1);
    const p = rows[0];
    if (!p) return null;
    return {
      personId: p.id,
      personName: [p.first, p.last].filter(Boolean).join(" ") || "this relative",
    };
  }
  const rows = await db
    .select({
      personId: persons.id,
      first: persons.firstName,
      last: persons.lastName,
    })
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(and(eq(memories.id, targetId), eq(persons.treeId, treeId)))
    .limit(1);
  const m = rows[0];
  if (!m) return null;
  return {
    personId: m.personId,
    personName: [m.first, m.last].filter(Boolean).join(" ") || "a relative",
  };
}

/**
 * Unresolved comments across ALL of a user's trees (owned + member) — the
 * raw material for the header mention badge.
 */
export async function recentUnresolvedComments(
  userId: string,
): Promise<{ id: string; treeId: string; authorUserId: string | null; body: string; resolved: boolean }[]> {
  const owned = await db
    .select({ id: trees.id })
    .from(trees)
    .where(eq(trees.ownerId, userId));
  const memberTrees = await db
    .select({ treeId: treeMembers.treeId })
    .from(treeMembers)
    .where(eq(treeMembers.userId, userId));
  const treeIds = [...new Set([...owned.map((t) => t.id), ...memberTrees.map((m) => m.treeId)])];
  if (treeIds.length === 0) return [];
  const rows = await db
    .select({
      id: comments.id,
      treeId: comments.treeId,
      authorUserId: comments.authorUserId,
      body: comments.body,
      resolved: comments.resolved,
    })
    .from(comments)
    .where(and(inArray(comments.treeId, treeIds), eq(comments.resolved, false)));
  return rows;
}
