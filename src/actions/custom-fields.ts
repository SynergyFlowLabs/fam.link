"use server";

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  customFieldDefs,
  memories,
  memoryCustomValues,
  personCustomValues,
  persons,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canComment, canEdit } from "@/lib/roles";
import {
  validateFieldDef,
  validateFieldValue,
  parseStoredOptions,
} from "@/lib/custom-fields";
import { labelKey } from "@/lib/labels";
import { fail, OK, type ActionResult } from "@/lib/action-result";
import { touchTree } from "@/lib/tree-mutations";

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
        : "You need the Commenter role to do that.";
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

export async function createCustomFieldDefAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const nameRaw = String(formData.get("name") ?? "");
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? formData.get("optionsJson") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  const parsed = validateFieldDef({ name: nameRaw, kind: kindRaw, optionsRaw });
  if (!parsed.ok) return fail(parsed.error);

  const existing = await db.select().from(customFieldDefs).where(eq(customFieldDefs.treeId, treeId));
  if (existing.some((f) => labelKey(f.name) === labelKey(parsed.name))) {
    return fail(`A field called "${parsed.name}" already exists.`);
  }

  await db.insert(customFieldDefs).values({
    id: randomUUID(),
    treeId,
    name: parsed.name,
    kind: parsed.kind,
    optionsJson: parsed.options ? JSON.stringify(parsed.options) : null,
  });
  await touchTree(treeId);
  revalidateTree(treeId);
  return OK;
}

export async function deleteCustomFieldDefAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  if (!fieldId) return fail("Missing field.");

  await db
    .delete(customFieldDefs)
    .where(and(eq(customFieldDefs.id, fieldId), eq(customFieldDefs.treeId, treeId)));

  await touchTree(treeId);
  revalidateTree(treeId);
  return OK;
}

export async function updateCustomFieldDefAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const nameRaw = String(formData.get("name") ?? "");
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  const parsed = validateFieldDef({ name: nameRaw, kind: kindRaw, optionsRaw });
  if (!parsed.ok) return fail(parsed.error);

  const existing = await db.select().from(customFieldDefs).where(eq(customFieldDefs.treeId, treeId));
  if (existing.some((f) => f.id !== fieldId && labelKey(f.name) === labelKey(parsed.name))) {
    return fail(`Another field is already called "${parsed.name}".`);
  }

  const updated = await db
    .update(customFieldDefs)
    .set({
      name: parsed.name,
      kind: parsed.kind,
      optionsJson: parsed.options ? JSON.stringify(parsed.options) : null,
    })
    .where(and(eq(customFieldDefs.id, fieldId), eq(customFieldDefs.treeId, treeId)))
    .returning({ id: customFieldDefs.id });

  if (updated.length === 0) return fail("That field is no longer in this tree.");
  await touchTree(treeId);
  revalidateTree(treeId);
  return OK;
}

// ----- person custom values -----

export async function setPersonCustomValueAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const rawValue = String(formData.get("value") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  if (!personId || !fieldId) return fail("Missing person or field.");

  const personRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!personRows[0]) return fail("That person is no longer in this tree.");

  const fieldRows = await db
    .select()
    .from(customFieldDefs)
    .where(and(eq(customFieldDefs.id, fieldId), eq(customFieldDefs.treeId, treeId)))
    .limit(1);
  const field = fieldRows[0];
  if (!field) return fail("That field no longer exists.");

  const valueTrim = rawValue.trim();
  if (valueTrim === "") {
    // Empty means remove the value
    await db
      .delete(personCustomValues)
      .where(and(eq(personCustomValues.personId, personId), eq(personCustomValues.fieldId, fieldId)));
    await touchTree(treeId);
    revalidateTree(treeId, personId);
    return OK;
  }

  const options = parseStoredOptions(field.optionsJson);
  const validated = validateFieldValue(field.kind as never, valueTrim, options);
  if (!validated.ok) return fail(validated.error);

  const existing = await db
    .select({ id: personCustomValues.id })
    .from(personCustomValues)
    .where(and(eq(personCustomValues.personId, personId), eq(personCustomValues.fieldId, fieldId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(personCustomValues)
      .set({ value: validated.normalized, updatedAt: new Date() })
      .where(eq(personCustomValues.id, existing[0].id));
  } else {
    await db.insert(personCustomValues).values({
      id: randomUUID(),
      personId,
      fieldId,
      value: validated.normalized,
    });
  }

  await touchTree(treeId);
  revalidateTree(treeId, personId);
  return OK;
}

export async function removePersonCustomValueAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");

  const { error } = await requireAccess(treeId, "edit");
  if (error) return error;

  if (!personId || !fieldId) return fail("Missing person or field.");

  await db
    .delete(personCustomValues)
    .where(and(eq(personCustomValues.personId, personId), eq(personCustomValues.fieldId, fieldId)));

  await touchTree(treeId);
  revalidateTree(treeId, personId);
  return OK;
}

// ----- memory custom values (optional story/memory fields) -----

export async function setMemoryCustomValueAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const memoryId = String(formData.get("memoryId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  const rawValue = String(formData.get("value") ?? "");

  const { error } = await requireAccess(treeId, "comment");
  if (error) return error;

  if (!memoryId || !fieldId) return fail("Missing memory or field.");

  const memRows = await db
    .select({ id: memories.id, personId: memories.personId })
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);
  if (!memRows[0]) return fail("That memory is no longer there.");
  const personRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, memRows[0].personId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!personRows[0]) return fail("That memory is no longer in this tree.");

  const fieldRows = await db
    .select()
    .from(customFieldDefs)
    .where(and(eq(customFieldDefs.id, fieldId), eq(customFieldDefs.treeId, treeId)))
    .limit(1);
  const field = fieldRows[0];
  if (!field) return fail("That field no longer exists.");

  const valueTrim = rawValue.trim();
  if (valueTrim === "") {
    await db
      .delete(memoryCustomValues)
      .where(and(eq(memoryCustomValues.memoryId, memoryId), eq(memoryCustomValues.fieldId, fieldId)));
    await touchTree(treeId);
    revalidateTree(treeId, memRows[0].personId);
    return OK;
  }

  const options = parseStoredOptions(field.optionsJson);
  const validated = validateFieldValue(field.kind as never, valueTrim, options);
  if (!validated.ok) return fail(validated.error);

  const existing = await db
    .select({ id: memoryCustomValues.id })
    .from(memoryCustomValues)
    .where(and(eq(memoryCustomValues.memoryId, memoryId), eq(memoryCustomValues.fieldId, fieldId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(memoryCustomValues)
      .set({ value: validated.normalized, updatedAt: new Date() })
      .where(eq(memoryCustomValues.id, existing[0].id));
  } else {
    await db.insert(memoryCustomValues).values({
      id: randomUUID(),
      memoryId,
      fieldId,
      value: validated.normalized,
    });
  }

  await touchTree(treeId);
  revalidateTree(treeId, memRows[0].personId);
  return OK;
}
