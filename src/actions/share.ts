"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";

/**
 * Creates a public read-only link for one of the user's trees. The token is
 * 32 chars of CSPRNG base64url (~190 bits) — unguessable, safe in a URL.
 */
export async function createShareLinkAction(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const treeId = String(formData.get("treeId") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return;

  await db.insert(shareLinks).values({
    id: randomUUID(),
    treeId,
    token: randomBytes(24).toString("base64url"),
    label: label || null,
    createdBy: user.id,
  });
  revalidatePath(`/app/trees/${treeId}`);
}

/** Revoking keeps the row (audit trail) but the URL stops working instantly. */
export async function revokeShareLinkAction(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const treeId = String(formData.get("treeId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return;

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
}
