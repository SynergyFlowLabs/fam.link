"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";
import { fail, type ActionResult } from "@/lib/action-result";

/**
 * Creates a public read-only link for one of the user's trees. The token is
 * 32 chars of CSPRNG base64url (~190 bits) — unguessable, safe in a URL.
 */
export async function createShareLinkAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  const scopePersonIdRaw = String(formData.get("scopePersonId") ?? "").trim();
  let scopePersonId: string | null = null;
  if (scopePersonIdRaw) {
    const { persons } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const rows = await db.select({ id: persons.id }).from(persons).where(and(eq(persons.id, scopePersonIdRaw), eq(persons.treeId, treeId))).limit(1);
    if (rows.length === 0) return fail("That person is not in this tree.");
    scopePersonId = scopePersonIdRaw;
  }
  const token = randomBytes(24).toString("base64url");
  await db.insert(shareLinks).values({
    id: randomUUID(),
    treeId,
    token,
    label: label || null,
    createdBy: user.id,
    scopePersonId,
  });
  revalidatePath(`/app/trees/${treeId}`);
  return { ok: true, token };
}

/** Revoking keeps the row (audit trail) but the URL stops working instantly. */
export async function revokeShareLinkAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(shareLinks.id, linkId),
        eq(shareLinks.treeId, treeId),
        isNull(shareLinks.revokedAt),
      ),
    );
  revalidatePath(`/app/trees/${treeId}`);
  return { ok: true };
}
