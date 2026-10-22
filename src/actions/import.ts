"use server";

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { memories, parentChild, pendingImports, persons, trees, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ownedTree } from "@/actions/trees";
import { parseGedcom } from "@/lib/gedcom/parse";
import { planImport, type ImportPlan } from "@/lib/gedcom/import";
import type { ActionResult } from "@/lib/action-result";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB ≈ 30k people of plain text
const MAX_PERSONS = 20_000;

/**
 * Stage a GEDCOM file for review: parse + plan, store the plan, and let the
 * review screen render it. Nothing is inserted into the tree yet.
 */
export async function stageGedcomImportAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose a .ged file to upload first.");
  }
  if (file.size > MAX_BYTES) {
    return fail("That file is over 2 MB — please split very large trees or contact us.");
  }
  const looksGedcom =
    file.name.toLowerCase().endsWith(".ged") ||
    file.name.toLowerCase().endsWith(".gedcom") ||
    file.type === "text/plain" ||
    file.type === "";
  if (!looksGedcom) {
    return fail("That doesn't look like a GEDCOM file — export a .ged file from your genealogy app.");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.from(await file.arrayBuffer()),
    );
  } catch {
    return fail("This file isn't UTF-8 text. Re-export it from your genealogy app and choose UTF-8 if names matter.");
  }

  let plan: ImportPlan;
  try {
    const parsed = parseGedcom(text);
    if (parsed.individuals.length === 0) {
      return fail("No people found in this file — is it a GEDCOM (.ged) export?");
    }
    plan = planImport(parsed);
    if (
      parsed.charSet &&
      parsed.charSet !== "UTF-8" &&
      parsed.charSet !== "UNICODE" &&
      parsed.charSet !== "ASCII"
    ) {
      // Parsed best-effort; special characters may look off. The review
      // screen repeats the caveat so the owner decides with eyes open.
      plan.warnings.unshift(
        `This file says it uses ${parsed.charSet} encoding — accents and special characters may not have converted perfectly. Check the names below before confirming.`,
      );
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read this file as GEDCOM.");
  }
  if (plan.persons.length > MAX_PERSONS) {
    return fail(`This file has ${plan.persons.length} people — the import cap is ${MAX_PERSONS.toLocaleString()}.`);
  }

  // One pending import per tree; a re-upload replaces it.
  await db.delete(pendingImports).where(eq(pendingImports.treeId, treeId));
  await db.insert(pendingImports).values({
    id: randomUUID(),
    treeId,
    uploadedBy: user.id,
    fileName: file.name.slice(0, 200),
    planJson: JSON.stringify(plan),
  });
  revalidatePath(`/app/trees/${treeId}/import`);
  return { ok: true };
}

export interface ConfirmResult {
  ok: boolean;
  added?: number;
  error?: string;
}

/**
 * The confirmed half of the review workflow: insert every planned row inside
 * one transaction, delete the pending import, revalidate.
 */
export async function confirmGedcomImportAction(
  formData: FormData,
): Promise<ConfirmResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const importId = String(formData.get("importId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  const rows = await db
    .select()
    .from(pendingImports)
    .where(and(eq(pendingImports.id, importId), eq(pendingImports.treeId, treeId)))
    .limit(1);
  const pending = rows[0];
  if (!pending) return fail("This import was already handled — upload the file again.");

  const plan: ImportPlan = JSON.parse(pending.planJson);

  // Map GEDCOM xrefs → fresh UUIDs.
  const idFor = new Map<string, string>();
  for (const p of plan.persons) idFor.set(p.localId, randomUUID());

  const now = new Date();
  const insertedPersons = plan.persons.map((p) => ({
    id: idFor.get(p.localId) as string,
    treeId,
    firstName: p.firstName,
    lastName: p.lastName,
    gender: p.gender,
    living: p.living,
    birthDateText: p.birthDateText,
    birthPlace: p.birthPlace,
    deathDateText: p.deathDateText,
    deathPlace: p.deathPlace,
    notes: p.notes,
    createdAt: now,
    updatedAt: now,
  }));

  const unionIdFor = new Map<string, string>();
  for (const u of plan.unions) unionIdFor.set(u.localId, randomUUID());

  const insertedUnions = plan.unions.map((u) => ({
    id: unionIdFor.get(u.localId) as string,
    treeId,
    partnerAId: idFor.get(u.partnerAId) as string,
    partnerBId: u.partnerBId ? (idFor.get(u.partnerBId) as string) : null,
    status: u.status,
    dateText: u.dateText,
    placeText: u.placeText,
    createdAt: now,
  }));

  const insertedLinks = plan.links.map((l) => ({
    id: randomUUID(),
    unionId: unionIdFor.get(l.unionLocalId) as string,
    childId: idFor.get(l.childLocalId) as string,
  }));

  const insertedMemories = plan.persons.flatMap((p) =>
    p.memories.map((m) => ({
      id: randomUUID(),
      personId: idFor.get(p.localId) as string,
      kind: "text" as const,
      body: m.body,
      occurredText: null,
      authorName: null,
      mediaId: null,
      createdAt: now,
    })),
  );

  try {
    await db.transaction(async (tx) => {
      if (insertedPersons.length > 0) await tx.insert(persons).values(insertedPersons);
      if (insertedUnions.length > 0) await tx.insert(unions).values(insertedUnions);
      if (insertedLinks.length > 0) await tx.insert(parentChild).values(insertedLinks);
      if (insertedMemories.length > 0) await tx.insert(memories).values(insertedMemories);
      // First import into an empty tree: root the canvas on the first person.
      if (!tree.focusPersonId && insertedPersons.length > 0) {
        await tx
          .update(trees)
          .set({ focusPersonId: insertedPersons[0].id, updatedAt: now })
          .where(eq(trees.id, treeId));
      } else {
        await tx
          .update(trees)
          .set({ updatedAt: now })
          .where(eq(trees.id, treeId));
      }
      await tx.delete(pendingImports).where(eq(pendingImports.id, importId));
    });
  } catch {
    return fail("The import failed partway — your tree is unchanged. Please try again.");
  }

  revalidatePath(`/app/trees/${treeId}`);
  revalidatePath(`/app/trees/${treeId}/import`);
  revalidatePath("/app");
  return { ok: true, added: plan.persons.length };
}

/** Throw away a staged import without touching the tree. */
export async function discardGedcomImportAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const importId = String(formData.get("importId") ?? "");
  const tree = await ownedTree(treeId, user.id);
  if (!tree) return fail("That tree no longer exists.");

  await db
    .delete(pendingImports)
    .where(and(eq(pendingImports.id, importId), eq(pendingImports.treeId, treeId)));
  revalidatePath(`/app/trees/${treeId}/import`);
  return { ok: true };
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}
