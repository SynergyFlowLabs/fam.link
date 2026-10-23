/**
 * Ask-a-relative links (issue #35) — one question, one URL, one answer.
 * The Knowledge Holder never signs in: the public form at /ask/[token]
 * creates a plain memory attributed to the name they type.
 */
"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { askLinks, memories, persons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { personWithinScope } from "@/lib/branch-writes";
import {
  allowSubmission,
  generateAskToken,
  linkIsOpen,
  pruneSubmissions,
  ASK_DEFAULT_TTL_MS,
  ASK_MAX_ANSWER,
  ASK_MAX_NAME,
  validateAskQuestion,
} from "@/lib/ask-guard";
import { logActivity } from "@/lib/activity-log";
import { actorNameOf } from "@/lib/actors";
import { fail, type ActionResult } from "@/lib/action-result";
import { touchTree } from "@/lib/tree-mutations";

/**
 * Sliding-window rate limit, keyed per token+IP. In-memory by design —
 * enough to blunt abuse without adding friction (or infrastructure) for
 * family; instances may reset, which only loosens the limit briefly.
 */
const recentSubmissions = new Map<string, number[]>();

function clientKey(token: string): Promise<string> {
  return headers().then((h) => {
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim();
    return `${token}:${ip || "unknown"}`;
  });
}

function revalidateAsk(treeId: string, personId: string) {
  revalidatePath(`/app/trees/${treeId}/person/${personId}`);
}

export async function createAskLinkAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role))
    return fail("Asking a relative needs the Editor role.");

  const personId = String(formData.get("personId") ?? "");
  const question = String(formData.get("question") ?? "");
  const qErr = validateAskQuestion(question);
  if (qErr) return fail(qErr);

  const personRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!personRows[0]) return fail("That person is no longer in this tree.");
  if (!(await personWithinScope(access.scopePersonId, treeId, personId)))
    return fail("That person is outside your branch — ask the owner to widen your scope.");

  // Retry on the (astronomically unlikely) token collision.
  let token = generateAskToken();
  for (let i = 0; i < 3; i++) {
    const clash = await db
      .select({ id: askLinks.id })
      .from(askLinks)
      .where(eq(askLinks.token, token))
      .limit(1);
    if (!clash[0]) break;
    token = generateAskToken();
  }

  await db.insert(askLinks).values({
    id: randomUUID(),
    treeId,
    personId,
    question: question.trim(),
    token,
    createdBy: user.id,
    expiresAt: new Date(Date.now() + ASK_DEFAULT_TTL_MS),
  });

  try {
    await logActivity({
      treeId,
      actorUserId: user.id,
      actorName: await actorNameOf(user.id),
      action: "ask",
      targetType: "person",
      targetId: personId,
      targetLabel: null,
      detail: { personIds: [personId], question: question.trim() },
      undoable: false,
    });
  } catch {
    // feed is best-effort
  }

  touchTree(treeId).catch(() => {});
  revalidateAsk(treeId, personId);
  return { ok: true, token, message: "Ask link ready — copy and share it" };
}

export async function revokeAskLinkAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  const treeId = String(formData.get("treeId") ?? "");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role))
    return fail("Revoking ask links needs the Editor role.");

  const linkId = String(formData.get("linkId") ?? "");
  const rows = await db
    .select()
    .from(askLinks)
    .where(and(eq(askLinks.id, linkId), eq(askLinks.treeId, treeId)))
    .limit(1);
  const link = rows[0];
  if (!link) return fail("That ask link is already gone.");

  await db
    .update(askLinks)
    .set({ revokedAt: new Date() })
    .where(eq(askLinks.id, linkId));

  revalidateAsk(treeId, link.personId);
  return { ok: true, message: "Ask link closed" };
}

/**
 * The public submission — no session, no cookies, no tracking. Renders a
 * thank-you via redirect (?thanks=1).
 */
export async function submitAskAnswerAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const nameRaw = String(formData.get("name") ?? "").trim().slice(0, ASK_MAX_NAME);
  const answer = String(formData.get("answer") ?? "").trim().slice(0, ASK_MAX_ANSWER);
  const website = String(formData.get("website") ?? ""); // honeypot — must stay empty

  const rows = await db
    .select()
    .from(askLinks)
    .where(eq(askLinks.token, token))
    .limit(1);
  const link = rows[0];
  if (!link || !linkIsOpen(link, Date.now()) || !answer) {
    redirect(`/ask/${token}?error=1`);
  }
  if (website) {
    // Silently accept and discard — bots get no signal.
    redirect(`/ask/${token}?thanks=1`);
  }

  const key = await clientKey(token);
  const now = Date.now();
  const recent = pruneSubmissions(recentSubmissions.get(key) ?? [], now);
  if (!allowSubmission(recent, now)) {
    redirect(`/ask/${token}?slow=1`);
  }
  recentSubmissions.set(key, [...recent, now]);

  await db.insert(memories).values({
    id: randomUUID(),
    personId: link.personId,
    kind: "text",
    body: answer,
    authorName: nameRaw || "A relative",
    authorUserId: null,
  });

  touchTree(link.treeId).catch(() => {});
  revalidatePath(`/app/trees/${link.treeId}/person/${link.personId}`);
  redirect(`/ask/${token}?thanks=1`);
}
