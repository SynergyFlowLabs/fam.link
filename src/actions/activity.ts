"use server";

/**
 * Undo (issue #31, P3.1) — reverses a recent mutation from the activity
 * feed. Policy re-checked server-side at undo time (`undoAllowed`): marked
 * undoable, not already undone, within the 5-minute window, among the 10
 * most recent entries. Undo writes its own feed row and stamps the original.
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { activityFeed, memories, parentChild, persons, personEvents, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import {
  activitySummary,
  isActivityAction,
  undoAllowed,
  type ActivityAction,
} from "@/lib/activity";
import { activityById, logActivity, markUndone } from "@/lib/activity-log";
import type { PersonFields } from "@/lib/person-fields";
import { sweepTreeMedia } from "@/lib/uploads";
import { fail, OK, type ActionResult } from "@/lib/action-result";

function revalidateFeed(treeId: string, personId?: string | null): void {
  revalidatePath(`/app/trees/${treeId}`);
  revalidatePath(`/app/trees/${treeId}/activity`);
  revalidatePath(`/explore/${treeId}`);
  if (personId) revalidatePath(`/app/trees/${treeId}/person/${personId}`);
}

export async function undoActivityAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const activityId = String(formData.get("activityId") ?? "");
  if (!treeId || !activityId) return fail("Nothing to undo.");

  const user = await getCurrentUser();
  if (!user) return fail("Your session expired — sign in again.");
  const access = await getTreeAccess(treeId, user.id);
  if (!access) return fail("You don't have access to that tree.");

  const entry = await activityById(treeId, activityId);
  if (!entry || !isActivityAction(entry.action)) return fail("That entry is gone from the feed.");

  // Same actor or editor-and-up may undo; viewers/commenters can only
  // undo their own recent actions.
  const sameActor = entry.actorUserId === user.id;
  if (!sameActor && !canEdit(access.role)) {
    return fail("Only the person who made this change (or an editor) can undo it.");
  }

  // Window + recency policy against the tree's latest entries.
  const latest: { id: string; undoable: boolean; undoneAt: Date | null; createdAt: Date }[] = await db
    .select({ id: activityFeed.id, undoable: activityFeed.undoable, undoneAt: activityFeed.undoneAt, createdAt: activityFeed.createdAt })
    .from(activityFeed)
    .where(eq(activityFeed.treeId, treeId))
    .orderBy(activityFeed.createdAt);
  // `latest` is oldest-first; position from newest:
  const posFromNewest = latest.length - 1 - latest.findIndex((l) => l.id === activityId);
  const row = latest.find((l) => l.id === activityId);
  if (!row || !undoAllowed(row, posFromNewest, Date.now())) {
    return fail("That change is too old to undo — fix it manually instead.");
  }

  const detail = parseEntryDetail(entry.detailJson);
  const personIds: string[] = Array.isArray(detail.personIds) ? (detail.personIds as string[]) : [];
  const primaryPerson: string | null = personIds.length > 0 ? personIds[0] : null;

  const outcome = await applyUndo(entry.action as ActivityAction, treeId, detail, entry.targetId ?? null);
  if (!outcome.ok) return outcome;

  await markUndone(entry.id);
  const summary = activitySummary(entry.action as ActivityAction, detail, entry.targetLabel);
  await logActivity({
    treeId,
    actorUserId: user.id,
    actorName: user.name,
    action: "undo",
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetLabel: entry.targetLabel,
    detail: { undoneSummary: summary, personIds },
    undoable: false,
  });

  revalidateFeed(treeId, primaryPerson);
  const result: ActionResult = { ok: true, message: `Undone — ${summary}` };
  return result;
}

function parseEntryDetail(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

interface UndoSnapshotPerson {
  id: string;
  fields: PersonFields;
  treeId: string;
}

interface UndoSnapshotUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
  status: typeof unions.$inferSelect.status;
}

interface UndoSnapshotLink {
  unionId: string;
  childId: string;
}

/** Dispatch the reversal by action type. Snapshots come from detail_json. */
async function applyUndo(
  action: ActivityAction,
  treeId: string,
  detail: Record<string, unknown>,
  targetId: string | null,
): Promise<ActionResult> {
  switch (action) {
    case "add_person":
    case "add_relationship": {
      if (!targetId) return fail("That entry has no target to undo.");
      const del = await db
        .delete(persons)
        .where(and(eq(persons.id, targetId), eq(persons.treeId, treeId)))
        .returning({ id: persons.id });
      if (del.length === 0) return fail("That person is already gone.");
      return OK;
    }
    case "update_person": {
      const prev = detail.prev as UndoSnapshotPerson | undefined;
      if (!prev?.id) return fail("No earlier version was captured for this change.");
      const updated = await db
        .update(persons)
        .set({ ...prev.fields, updatedAt: new Date() })
        .where(and(eq(persons.id, prev.id), eq(persons.treeId, treeId)))
        .returning({ id: persons.id });
      if (updated.length === 0) return fail("That person is no longer in this tree.");
      return OK;
    }
    case "delete_person": {
      const person = detail.person as UndoSnapshotPerson | undefined;
      if (!person?.id) return fail("No snapshot was captured for this deletion.");
      const exists = await db
        .select({ id: persons.id })
        .from(persons)
        .where(eq(persons.id, person.id))
        .limit(1);
      if (exists[0]) return fail("That person already exists again.");
      await db.insert(persons).values({ id: person.id, treeId, ...person.fields });
      const restoredUnions = (detail.unions ?? []) as UndoSnapshotUnion[];
      for (const u of restoredUnions) {
        await db
          .insert(unions)
          .values({ id: u.id, treeId, partnerAId: u.partnerAId, partnerBId: u.partnerBId, status: u.status })
          .onConflictDoNothing({ target: unions.id });
      }
      const restoredLinks = (detail.links ?? []) as UndoSnapshotLink[];
      for (const l of restoredLinks) {
        await db
          .insert(parentChild)
          .values({ id: randomUUID(), unionId: l.unionId, childId: l.childId })
          .onConflictDoNothing();
      }
      // If the removed person was the focus and nothing else is, restore them.
      const { trees } = await import("@/db/schema");
      const tRows = await db.select({ focusPersonId: trees.focusPersonId }).from(trees).where(eq(trees.id, treeId)).limit(1);
      if (tRows[0] && !tRows[0].focusPersonId) {
        await db.update(trees).set({ focusPersonId: person.id }).where(eq(trees.id, treeId));
      }
      return OK;
    }
    case "add_memory": {
      if (!targetId) return fail("That entry has no target to undo.");
      const del = await db.delete(memories).where(eq(memories.id, targetId)).returning({ id: memories.id });
      if (del.length === 0) return fail("That memory is already gone.");
      await sweepTreeMedia(treeId);
      return OK;
    }
    case "delete_memory": {
      const snap = detail.memory as (typeof memories.$inferSelect) | undefined;
      if (!snap?.id) return fail("No snapshot was captured for this deletion.");
      await db
        .insert(memories)
        .values({
          id: snap.id,
          personId: snap.personId,
          kind: snap.kind,
          body: snap.body,
          occurredText: snap.occurredText,
          authorName: snap.authorName,
          authorUserId: snap.authorUserId,
          mediaId: null, // media files were swept with the deletion
          createdAt: snap.createdAt,
        })
        .onConflictDoNothing({ target: memories.id });
      return OK;
    }
    case "add_event": {
      if (!targetId) return fail("That entry has no target to undo.");
      const del = await db.delete(personEvents).where(eq(personEvents.id, targetId)).returning({ id: personEvents.id });
      if (del.length === 0) return fail("That event is already gone.");
      return OK;
    }
    case "update_event": {
      const prev = detail.prev as (typeof personEvents.$inferSelect) | undefined;
      if (!prev?.id) return fail("No earlier version was captured for this change.");
      const updated = await db
        .update(personEvents)
        .set({
          kind: prev.kind,
          dateText: prev.dateText,
          placeText: prev.placeText,
          note: prev.note,
          source: prev.source,
          updatedAt: new Date(),
        })
        .where(eq(personEvents.id, prev.id))
        .returning({ id: personEvents.id });
      if (updated.length === 0) return fail("That event is no longer in this tree.");
      return OK;
    }
    case "delete_event": {
      const snap = detail.event as (typeof personEvents.$inferSelect) | undefined;
      if (!snap?.id) return fail("No snapshot was captured for this deletion.");
      await db
        .insert(personEvents)
        .values({
          id: snap.id,
          personId: snap.personId,
          kind: snap.kind,
          dateText: snap.dateText,
          placeText: snap.placeText,
          note: snap.note,
          source: snap.source,
          createdAt: snap.createdAt,
        })
        .onConflictDoNothing({ target: personEvents.id });
      return OK;
    }
    default:
      return fail("That kind of change can't be undone automatically.");
  }
}
