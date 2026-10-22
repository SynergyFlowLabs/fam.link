"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { trees, type Tree } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** Every mutation goes through this: the session user must own the tree. */
export async function ownedTree(
  treeId: string,
  userId: string,
): Promise<Tree | null> {
  const rows = await db
    .select()
    .from(trees)
    .where(and(eq(trees.id, treeId), eq(trees.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTreeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/app?error=name");

  const treeId = randomUUID();
  await db.insert(trees).values({ id: treeId, ownerId: user.id, name });
  redirect(`/app/trees/${treeId}`);
}

export async function renameTreeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const treeId = String(formData.get("treeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const tree = await ownedTree(treeId, user.id);
  if (!tree || !name) return;

  await db
    .update(trees)
    .set({ name, updatedAt: new Date() })
    .where(eq(trees.id, treeId));
  revalidatePath("/app");
}

export async function deleteTreeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const treeId = String(formData.get("treeId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return;

  // FK cascade removes persons, unions, memories, media rows.
  // (Orphaned files under data/uploads are swept later — tracked in PROGRESS.)
  await db.delete(trees).where(eq(trees.id, treeId));
  revalidatePath("/app");
}
