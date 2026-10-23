"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { db, DATA_DIR } from "@/db";
import {
  media,
  memories,
  persons,
  trees,
  unions,
  type Person,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";
import { getTreeAccess } from "@/lib/access";
import { sweepTreeMedia } from "@/lib/uploads";
import { canComment, canEdit, type Role } from "@/lib/roles";
import {
  addRelativeToTree,
  insertPerson,
  revalidateTree,
  touchTree,
  unionsOfPartner,
  updatePersonInTree,
  type Relation,
} from "@/lib/tree-mutations";
import { displayNameOf, parsePersonFields } from "@/lib/person-fields";
import { OK, fail, type ActionResult } from "@/lib/action-result";

/**
 * Role guards. Owner+editor may restructure the tree; commenter and up may
 * add memories; viewing is checked at the page/route layer. Actions that
 * answer with a toast (ActionResult) fail politely instead of redirecting.
 */
async function requireUser(): Promise<{ id: string } | null> {
  const user = await getCurrentUser();
  return user ? { id: user.id } : null;
}

async function accessFor(
  treeId: string,
): Promise<{ userId: string; role: Role } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const access = await getTreeAccess(treeId, user.id);
  return access ? { userId: user.id, role: access.role } : null;
}

/** Editor-and-up guard for redirecting (void) actions. Null → redirect /app. */
async function assertEditable(treeId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const access = await getTreeAccess(treeId, user.id);
  return access && canEdit(access.role) ? access.tree : null;
}

/** Editor-and-up guard for ActionResult actions (polite toast on denial). */
async function assertEditorResult(
  treeId: string,
): Promise<ActionResult | null> {
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) {
    return fail(
      "Growing this tree needs the Editor role — ask its owner for access.",
    );
  }
  return null;
}

export async function addFirstPersonAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const user = await requireUser();
  if (!user) redirect("/signin");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("You don't have access to that tree.");
  const fields = parsePersonFields(formData);
  const name = displayNameOf(fields);
  const id = await insertPerson(treeId, fields);
  if (!tree.focusPersonId) {
    await db
      .update(trees)
      .set({ focusPersonId: id })
      .where(eq(trees.id, treeId));
  }
  await touchTree(treeId);
  revalidateTree(treeId);
  return { ok: true, message: name };
}

export async function addRelativeAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const denied = await assertEditorResult(treeId);
  if (denied) return denied;
  const anchorId = String(formData.get("anchorId") ?? "");
  const relation = String(formData.get("relation") ?? "") as Relation;
  const fields = parsePersonFields(formData);
  const result = await addRelativeToTree(treeId, anchorId, relation, fields);
  if (!result.ok) return result;
  revalidateTree(treeId, anchorId);
  return result;
}

export async function updatePersonAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const denied = await assertEditorResult(treeId);
  if (denied) return denied;
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return fail("That person is no longer in this tree.");

  const fields = parsePersonFields(formData);
  const result = await updatePersonInTree(treeId, personId, fields);
  if (!result.ok) return result;
  revalidateTree(treeId, personId);
  return result;
}

export async function deletePersonAction(formData: FormData): Promise<void> {
  const treeId = String(formData.get("treeId") ?? "");
  const tree = await assertEditable(treeId);
  if (!tree) redirect("/app");
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return;

  const myUnions = await unionsOfPartner(treeId, personId);
  for (const u of myUnions) {
    const survivor =
      u.partnerAId === personId ? u.partnerBId : u.partnerAId ?? null;
    if (survivor) {
      // Keep the union alive for the children: move the survivor to slot A.
      await db
        .update(unions)
        .set({ partnerAId: survivor, partnerBId: null })
        .where(eq(unions.id, u.id));
    }
    // Unions without a surviving partner cascade away with their child links;
    // the confirm dialog tells the user children lose this parent link.
  }

  await db
    .delete(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)));

  if (tree.focusPersonId === personId) {
    const remaining = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.treeId, treeId))
      .limit(1);
    await db
      .update(trees)
      .set({ focusPersonId: remaining[0]?.id ?? null })
      .where(eq(trees.id, treeId));
  }

  // Person deletion cascades their memories — any photo files those
  // memories owned are now orphans. Sweep them (rows + files).
  await sweepTreeMedia(treeId);
  await touchTree(treeId);
  revalidateTree(treeId);
  redirect(`/app/trees/${treeId}`);
}

export async function setFocusPersonAction(formData: FormData): Promise<void> {
  const treeId = String(formData.get("treeId") ?? "");
  const tree = await assertEditable(treeId);
  if (!tree) redirect("/app");
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return;
  await db
    .update(trees)
    .set({ focusPersonId: personId, updatedAt: new Date() })
    .where(eq(trees.id, treeId));
  revalidateTree(treeId);
}

export async function addMemoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canComment(access.role)) {
    return fail(
      "Sharing memories here needs the Commenter role — ask its owner for access.",
    );
  }
  const personId = String(formData.get("personId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  // Photo memories: an optional image turns the memory into kind=photo.
  const photo = formData.get("photo");
  let mediaId: string | null = null;
  let kind: "text" | "photo" = "text";
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/"))
      return fail("That file isn't an image — try a JPG, PNG or WebP.");
    if (photo.size > 8 * 1024 * 1024)
      return fail("Photos need to be under 8 MB.");
    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    };
    const ext = extByMime[photo.type] ?? "img";
    mediaId = randomUUID();
    const dir = path.join(DATA_DIR, "uploads");
    mkdirSync(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${mediaId}.${ext}`),
      Buffer.from(await photo.arrayBuffer()),
    );
    await db.insert(media).values({
      id: mediaId,
      treeId,
      path: `uploads/${mediaId}.${ext}`,
      mimeType: photo.type,
      sizeBytes: photo.size,
      uploadedBy: access.userId,
    });
    kind = "photo";
  }

  if (!personId || (!body && kind !== "photo"))
    return fail("Write something, or attach a photo first.");

  const occurred = String(formData.get("occurredText") ?? "").trim();
  const author = String(formData.get("authorName") ?? "").trim();
  await db.insert(memories).values({
    id: randomUUID(),
    personId,
    kind,
    body,
    occurredText: occurred || null,
    authorName: author || null,
    authorUserId: access.userId,
    mediaId,
  });
  await touchTree(treeId);
  revalidateTree(treeId, personId);
  return OK;
}

export async function deleteMemoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  const memoryId = String(formData.get("memoryId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (!memoryId) return fail("That memory is already gone.");
  // Ensure the memory belongs to a person in this tree
  const rows = await db
    .select({
      personId: memories.personId,
      treeId: persons.treeId,
      authorUserId: memories.authorUserId,
    })
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(memories.id, memoryId))
    .limit(1);
  if (!rows[0] || rows[0].treeId !== treeId)
    return fail("That memory is no longer in this tree.");
  const mine = rows[0].authorUserId === access.userId;
  if (!canEdit(access.role) && !(canComment(access.role) && mine)) {
    return fail("Only the owner, an editor, or the author can remove a memory.");
  }

  await db.delete(memories).where(eq(memories.id, memoryId));
  // The memory's photo (if any) is now unreferenced — remove row + file.
  await sweepTreeMedia(treeId);
  await touchTree(treeId);
  revalidateTree(treeId, personId || undefined);
  return OK;
}

export async function getPersonInTree(
  treeId: string,
  personId: string,
): Promise<Person | null> {
  const rows = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .limit(1);
  return rows[0] ?? null;
}
