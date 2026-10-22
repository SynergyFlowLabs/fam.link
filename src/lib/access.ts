import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  treeInvites,
  treeMembers,
  trees,
  users,
  type Tree,
  type TreeInvite,
  type TreeMember,
  type User,
} from "@/db/schema";
import { maxRole, type MemberRole, type Role } from "@/lib/roles";

export interface TreeAccess {
  tree: Tree;
  role: Role;
}

/**
 * THE access check for every tree-scoped read and mutation: the session user
 * is either the owner (role "owner") or a tree_members row (viewer /
 * commenter / editor) — or they have no business here (null).
 */
export async function getTreeAccess(
  treeId: string,
  userId: string,
): Promise<TreeAccess | null> {
  if (!treeId || !userId) return null;
  const treeRows = await db
    .select()
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  const tree = treeRows[0];
  if (!tree) return null;
  if (tree.ownerId === userId) return { tree, role: "owner" };
  const memberRows = await db
    .select({ role: treeMembers.role })
    .from(treeMembers)
    .where(
      and(eq(treeMembers.treeId, treeId), eq(treeMembers.userId, userId)),
    )
    .limit(1);
  if (!memberRows[0]) return null;
  return { tree, role: memberRows[0].role };
}

export interface MemberView {
  member: TreeMember;
  user: User;
}

/** Members of a tree with their account info, oldest membership first. */
export async function listTreeMembers(treeId: string): Promise<MemberView[]> {
  const rows = await db
    .select({ member: treeMembers, user: users })
    .from(treeMembers)
    .innerJoin(users, eq(treeMembers.userId, users.id))
    .where(eq(treeMembers.treeId, treeId))
    .orderBy(treeMembers.createdAt);
  return rows;
}

/** Valid (non-revoked) invite for a token, or null. */
export async function getInviteByToken(
  token: string,
): Promise<TreeInvite | null> {
  if (!token || token.length > 128) return null;
  const rows = await db
    .select()
    .from(treeInvites)
    .where(eq(treeInvites.token, token))
    .limit(1);
  const invite = rows[0];
  if (!invite || invite.revokedAt) return null;
  return invite;
}

/** All invites for a tree (active first, newest first) — owner view. */
export async function listTreeInvites(treeId: string): Promise<TreeInvite[]> {
  const rows = await db
    .select()
    .from(treeInvites)
    .where(eq(treeInvites.treeId, treeId))
    .orderBy(desc(treeInvites.createdAt));
  // Active links first so the ones the owner can still hand out lead.
  return [...rows].sort((a, b) => {
    const ra = a.revokedAt ? 1 : 0;
    const rb = b.revokedAt ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Adds (or upgrades) a membership. Opening an invite never demotes: someone
 * who is already an editor and clicks an old viewer link keeps editing.
 * (The owner is not a member row — callers redirect owners to their tree.)
 */
export async function upsertMembership(
  treeId: string,
  userId: string,
  role: MemberRole,
  invitedBy: string | null,
): Promise<MemberRole> {
  const existing = await db
    .select()
    .from(treeMembers)
    .where(and(eq(treeMembers.treeId, treeId), eq(treeMembers.userId, userId)))
    .limit(1);
  if (existing[0]) {
    const merged = maxRole(existing[0].role, role);
    if (merged !== existing[0].role) {
      await db
        .update(treeMembers)
        .set({ role: merged })
        .where(eq(treeMembers.id, existing[0].id));
    }
    return merged;
  }
  await db.insert(treeMembers).values({
    id: randomUUID(),
    treeId,
    userId,
    role,
    invitedBy,
  });
  return role;
}
