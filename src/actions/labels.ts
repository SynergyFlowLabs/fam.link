"use server";

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { labelDefs, memories, personLabels, persons, memoryLabels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canComment, canEdit } from "@/lib/roles";
import { personWithinScope } from "@/lib/branch-writes";
import { normalizeLabelName, labelKey } from "@/lib/labels";
import { fail, OK, type ActionResult } from "@/lib/action-result";
import { touchTree } from "@/lib/tree-mutations";

async function requireScope(
  scopePersonId: string | null | undefined,
  treeId: string,
  personId: string,
): Promise<ActionResult | null> {
  if (await personWithinScope(scopePersonId, treeId, personId)) return null;
  return fail("That person is outside your branch — ask the owner to widen your scope.");
}

async function requireAccess(treeId: string, need: "edit" | "comment") {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please sign in."), user: null as never };
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return { error: fail("You don't have access to that tree."), user: null as never };
  const ok = need === "edit" ? canEdit(access.role) : canComment(access.role);
  if (!ok) {
    const msg =
      need === "edit"
        ? "Growing this tree needs the Editor role — ask its owner for access."
        : "You need the Commenter role to do that — ask its owner.";
    return { error: fail(msg), user: null as never };
  }
  return { error: null as ActionResult | null, user, access };
}

function revalidateTree(treeId: string, personId?: string) {
  revalidatePath(`/app/trees/${treeId}`);
  revalidatePath(`/explore/${treeId}`);
  if (personId) {
    revalidatePath(`/app/trees/${treeId}/person/${personId}`);
    revalidatePath(`/explore/${treeId}/person/${personId}`);
  }
  revalidatePath(`/app/trees/${treeId}/labels`);
}

/** Get or create a label def for a tree by name (case-insensitive). */
async function getOrCreateLabelDef(
  treeId: string,
  rawName: string,
): Promise<{ id: string; name: string } | null> {
  const name = normalizeLabelName(rawName);
  if (!name) return null;
  // Check existing case-insensitively in JS (SQLite unique is case-sensitive by default)
  const existing = await db
    .select()
    .from(labelDefs)
    .where(eq(labelDefs.treeId, treeId));
  const found = existing.find((l) => labelKey(l.name) === labelKey(name));
  if (found) return { id: found.id, name: found.name };
  const id = randomUUID();
  const color = null; // UI will pick via labelColorFor fallback
  try {
    await db.insert(labelDefs).values({ id, treeId, name, color });
  } catch {
    // race — another request created it; fetch again
    const again = await db
      .select()
      .from(labelDefs)
      .where(eq(labelDefs.treeId, treeId));
    const dup = again.find((l) => labelKey(l.name) === labelKey(name));
    if (dup) return { id: dup.id, name: dup.name };
    return null;
  }
  return { id, name };
}

// ----- person labels -----

export async function addLabelToPersonAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const labelName = String(formData.get("labelName") ?? formData.get("name") ?? "");
  const labelIdRaw = String(formData.get("labelId") ?? "").trim();

  const { error, access } = await requireAccess(treeId, "edit");
  if (error || !access) return error ?? fail("You don't have access to that tree.");
  const scopeFailP = await requireScope(access.scopePersonId, treeId, personId);
  if (scopeFailP) return scopeFailP;

  if (!personId) return fail("That person is no longer in this tree.");
  const personRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!personRows[0]) return fail("That person is no longer in this tree.");

  let labelId = labelIdRaw || "";
  let labelNameResolved = labelName;

  if (labelId) {
    const defRows = await db
      .select()
      .from(labelDefs)
      .where(and(eq(labelDefs.id, labelId), eq(labelDefs.treeId, treeId)))
      .limit(1);
    if (!defRows[0]) return fail("That label no longer exists — refresh and try again.");
    labelNameResolved = defRows[0].name;
  } else {
    const name = normalizeLabelName(labelName);
    if (!name) return fail("Give the label a name.");
    if (name.length > 40) return fail("Label names are at most 40 characters.");
    const def = await getOrCreateLabelDef(treeId, name);
    if (!def) return fail("Couldn't create that label — try again.");
    labelId = def.id;
    labelNameResolved = def.name;
  }

  try {
    await db.insert(personLabels).values({ id: randomUUID(), personId, labelId });
  } catch {
    return fail(`"${labelNameResolved}" is already on this person.`);
  }
  await touchTree(treeId);
  revalidateTree(treeId, personId);
  return OK;
}

export async function removeLabelFromPersonAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const labelId = String(formData.get("labelId") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  if (!personId || !labelId) return fail("Missing label or person.");

  await db
    .delete(personLabels)
    .where(and(eq(personLabels.personId, personId), eq(personLabels.labelId, labelId)));

  await touchTree(treeId);
  revalidateTree(treeId, personId);
  return OK;
}

// ----- memory labels -----

export async function addLabelToMemoryAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const memoryId = String(formData.get("memoryId") ?? "");
  const labelName = String(formData.get("labelName") ?? formData.get("name") ?? "");
  const labelIdRaw = String(formData.get("labelId") ?? "").trim();

  const { error } = await requireAccess(treeId, "comment");
  if (error) return error;

  if (!memoryId) return fail("That memory is no longer there.");
  // Ensure memory belongs to a person in this tree
  const memRows = await db
    .select({ id: memories.id, personId: memories.personId })
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);
  if (!memRows[0]) return fail("That memory is no longer there.");
  const { access } = await requireAccess(treeId, "comment");
  const scopeFailM = await requireScope(access?.scopePersonId, treeId, memRows[0].personId);
  if (scopeFailM) return scopeFailM;
  const personRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, memRows[0].personId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!personRows[0]) return fail("That memory is no longer in this tree.");

  let labelId = labelIdRaw;
  let labelNameResolved = labelName;
  if (labelId) {
    const defRows = await db
      .select()
      .from(labelDefs)
      .where(and(eq(labelDefs.id, labelId), eq(labelDefs.treeId, treeId)))
      .limit(1);
    if (!defRows[0]) return fail("That label no longer exists.");
    labelNameResolved = defRows[0].name;
  } else {
    const name = normalizeLabelName(labelName);
    if (!name) return fail("Give the label a name.");
    const def = await getOrCreateLabelDef(treeId, name);
    if (!def) return fail("Couldn't create that label.");
    labelId = def.id;
    labelNameResolved = def.name;
  }

  try {
    await db.insert(memoryLabels).values({ id: randomUUID(), memoryId, labelId });
  } catch {
    return fail(`"${labelNameResolved}" is already on this memory.`);
  }
  await touchTree(treeId);
  revalidateTree(treeId, personRows[0].id);
  return OK;
}

export async function removeLabelFromMemoryAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const memoryId = String(formData.get("memoryId") ?? "");
  const labelId = String(formData.get("labelId") ?? "");

  const { error } = await requireAccess(treeId, "comment");
  if (error) return error;

  if (!memoryId || !labelId) return fail("Missing label or memory.");

  await db
    .delete(memoryLabels)
    .where(and(eq(memoryLabels.memoryId, memoryId), eq(memoryLabels.labelId, labelId)));

  // find person for revalidation
  const memRows = await db
    .select({ personId: memories.personId })
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);
  await touchTree(treeId);
  revalidateTree(treeId, memRows[0]?.personId);
  return OK;
}

// ----- label def management (tree-level) -----

export async function createLabelDefAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const rawName = String(formData.get("name") ?? "");
  const color = String(formData.get("color") ?? "").trim() || null;

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  const name = normalizeLabelName(rawName);
  if (!name) return fail("Give the label a name.");
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return fail("Pick a valid color.");

  const existing = await db.select().from(labelDefs).where(eq(labelDefs.treeId, treeId));
  if (existing.some((l) => labelKey(l.name) === labelKey(name))) {
    return fail(`"${name}" already exists in this tree.`);
  }

  await db.insert(labelDefs).values({ id: randomUUID(), treeId, name, color });
  await touchTree(treeId);
  revalidateTree(treeId);
  return OK;
}

export async function deleteLabelDefAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const labelId = String(formData.get("labelId") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  if (!labelId) return fail("Missing label.");

  await db.delete(labelDefs).where(and(eq(labelDefs.id, labelId), eq(labelDefs.treeId, treeId)));
  await touchTree(treeId);
  revalidateTree(treeId);
  return OK;
}

export async function updateLabelDefAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const labelId = String(formData.get("labelId") ?? "");
  const rawName = String(formData.get("name") ?? "");
  const color = String(formData.get("color") ?? "").trim() || null;

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  const name = normalizeLabelName(rawName);
  if (!name) return fail("Give the label a name.");
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return fail("Pick a valid color.");

  const existing = await db.select().from(labelDefs).where(eq(labelDefs.treeId, treeId));
  if (existing.some((l) => l.id !== labelId && labelKey(l.name) === labelKey(name))) {
    return fail(`Another label is already called "${name}".`);
  }

  const updated = await db
    .update(labelDefs)
    .set({ name, color })
    .where(and(eq(labelDefs.id, labelId), eq(labelDefs.treeId, treeId)))
    .returning({ id: labelDefs.id });
  if (updated.length === 0) return fail("That label is no longer in this tree.");
  await touchTree(treeId);
  revalidateTree(treeId);
  return OK;
}
