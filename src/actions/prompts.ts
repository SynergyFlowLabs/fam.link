"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { storyPrompts } from "@/db/schema";
import { getTreeAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/roles";
import { touchTree } from "@/lib/tree-mutations";
import {
  PROMPT_CATEGORIES,
  PROMPT_MAX_LENGTH,
  type PromptCategory,
} from "@/lib/story-prompts";
import { fail, type ActionResult } from "@/lib/action-result";

/**
 * Custom story prompts (issue #38) — a family's own interview questions,
 * scoped to one tree. Global curated prompts are read-only here.
 */

function parseCategory(raw: string): PromptCategory | null {
  return (PROMPT_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as PromptCategory)
    : null;
}

export async function addPromptAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role))
    return fail("Adding prompts needs the Editor role — ask the tree's owner.");

  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return fail("Write the question first.");
  if (prompt.length > PROMPT_MAX_LENGTH)
    return fail(`Keep prompts under ${PROMPT_MAX_LENGTH} characters.`);
  const category = parseCategory(String(formData.get("category") ?? "")) ?? "custom";

  await db.insert(storyPrompts).values({
    id: randomUUID(),
    treeId,
    prompt,
    category,
    createdBy: user.id,
  });
  await touchTree(treeId);
  return { ok: true, message: "Prompt added" };
}

export async function deletePromptAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role))
    return fail("Removing prompts needs the Editor role — ask the tree's owner.");

  const id = String(formData.get("id") ?? "");
  // Only tree-scoped customs are deletable; the curated set belongs to everyone.
  const deleted = await db
    .delete(storyPrompts)
    .where(
      and(
        eq(storyPrompts.id, id),
        eq(storyPrompts.treeId, treeId),
      ),
    )
    .returning({ id: storyPrompts.id });
  if (deleted.length === 0)
    return fail("Only this tree's own prompts can be removed.");
  await touchTree(treeId);
  return { ok: true, message: "Prompt removed" };
}

/** Prompt rows visible to a tree: its customs + the global curated set. */
export async function listPromptsForTree(
  treeId: string,
): Promise<{ id: string; prompt: string; category: PromptCategory; treeId: string | null }[]> {
  const rows = await db
    .select()
    .from(storyPrompts)
    .where(or(eq(storyPrompts.treeId, treeId), isNull(storyPrompts.treeId)));
  return rows.map((r) => ({
    id: r.id,
    prompt: r.prompt,
    category: r.category as PromptCategory,
    treeId: r.treeId,
  }));
}

