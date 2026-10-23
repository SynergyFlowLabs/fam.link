"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/db";
import { treeInvites, treeMembers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getInviteByToken, upsertMembership } from "@/lib/access";
import { ownedTree } from "@/actions/trees";
import { fail, type ActionResult } from "@/lib/action-result";
import { isMemberRole, safeNextPath } from "@/lib/roles";

/**
 * Owner-side invite management. All of it is owner-only (canManage):
 * inviting family in, revoking a link, changing someone's role, removing
 * someone — "the builder curates".
 */

function revalidateMembers(treeId: string) {
  revalidatePath(`/app/trees/${treeId}/members`);
  revalidatePath(`/app/trees/${treeId}`);
  revalidatePath("/app");
}

/** Creates a multi-use invite link: anyone holding it can join as `role`. */
export async function createInviteAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const role = String(formData.get("role") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");
  if (!isMemberRole(role)) return fail("Pick a role: viewer, commenter or editor.");

  const scopePersonIdRaw = String(formData.get("scopePersonId") ?? "").trim();
  let scopePersonId: string | null = null;
  if (scopePersonIdRaw) {
    const { persons } = await import("@/db/schema");
    const rows = await db.select({ id: persons.id }).from(persons).where(and(eq(persons.id, scopePersonIdRaw), eq(persons.treeId, treeId))).limit(1);
    if (rows.length === 0) return fail("That person is not in this tree.");
    scopePersonId = scopePersonIdRaw;
  }
  const token = randomBytes(24).toString("base64url");
  const inviteId = randomUUID();
  await db.insert(treeInvites).values({
    id: inviteId,
    treeId,
    token,
    role,
    label: label || null,
    createdBy: user.id,
    scopePersonId,
  });
  const { logActivity } = await import("@/lib/activity-log");
  await logActivity({
    treeId,
    actorUserId: user.id,
    actorName: user.name,
    action: "invite",
    targetType: "invite",
    targetId: inviteId,
    targetLabel: label || null,
    detail: { relation: role, personName: scopePersonId ? await (async () => {
      const { persons } = await import("@/db/schema");
      const rows = await db.select({ firstName: persons.firstName, lastName: persons.lastName }).from(persons).where(eq(persons.id, scopePersonId!)).limit(1);
      return rows[0] ? [rows[0].firstName, rows[0].lastName].filter(Boolean).join(" ") || "Unknown" : null;
    })() : null, personIds: scopePersonId ? [scopePersonId] : [] },
    undoable: false,
  });
  revalidateMembers(treeId);
  return { ok: true, token };
}

/** Revoking keeps the row (audit trail) but the link stops working instantly. */
export async function revokeInviteAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  const rows = await db
    .select()
    .from(treeInvites)
    .where(and(eq(treeInvites.id, inviteId), eq(treeInvites.treeId, treeId)))
    .limit(1);
  if (!rows[0]) return fail("That invite is already gone.");
  await db
    .update(treeInvites)
    .set({ revokedAt: new Date() })
    .where(eq(treeInvites.id, inviteId));
  revalidateMembers(treeId);
  return { ok: true, message: "Invite link revoked" };
}

/** The owner changes what a member may do. */
export async function updateMemberRoleAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");
  if (!isMemberRole(role)) return fail("Pick a role: viewer, commenter or editor.");

  const updated = await db
    .update(treeMembers)
    .set({ role })
    .where(and(eq(treeMembers.id, memberId), eq(treeMembers.treeId, treeId)))
    .returning({ id: treeMembers.id });
  if (updated.length === 0) return fail("That member is no longer in this tree.");
  revalidateMembers(treeId);
  return { ok: true };
}

/** The owner removes a member's access to the tree. */
export async function removeMemberAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  const removed = await db
    .delete(treeMembers)
    .where(and(eq(treeMembers.id, memberId), eq(treeMembers.treeId, treeId)))
    .returning({ id: treeMembers.id });
  if (removed.length === 0)
    return fail("That member is no longer in this tree.");
  revalidateMembers(treeId);
  return { ok: true };
}

/**
 * Invitee side: accepting a link. Runs from the /invite/[token] page only.
 * Redirects to the tree on success (never demotes an existing member —
 * upsertMembership merges roles).
 */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/signin?next=${encodeURIComponent(safeNextPath(`/invite/${token}`))}`,
    );
  }
  const invite = await getInviteByToken(token);
  if (!invite) redirect(`/invite/${encodeURIComponent(token)}`);
  const tree = await ownedTree(invite.treeId, user.id);
  if (tree) {
    // Already the owner — the invite is redundant, just open the tree.
    redirect(`/app/trees/${invite.treeId}`);
  }
  await upsertMembership(
    invite.treeId,
    user.id,
    invite.role,
    invite.createdBy,
    (invite as unknown as { scopePersonId?: string | null }).scopePersonId ?? null,
  );
  revalidateMembers(invite.treeId);
  redirect(`/app/trees/${invite.treeId}`);
}
