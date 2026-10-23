/**
 * Activity logging — server-only (no "use server"; not importable from
 * client code). Emission is BEST-EFFORT: `logActivity` swallows its own
 * failures so a feed problem can never fail the mutation it describes.
 */
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { activityFeed } from "@/db/schema";
import type { ActivityAction } from "@/lib/activity";

export interface LogActivityInput {
  treeId: string;
  actorUserId: string | null;
  actorName: string;
  action: ActivityAction;
  targetType:
    | "person"
    | "memory"
    | "event"
    | "invite"
    | "share_link"
    | "source"
    | "tree";
  targetId?: string | null;
  targetLabel?: string | null;
  detail?: Record<string, unknown>;
  undoable?: boolean;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.insert(activityFeed).values({
      id: randomUUID(),
      treeId: input.treeId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      detailJson: JSON.stringify(input.detail ?? {}),
      undoable: input.undoable ?? false,
    });
  } catch (e) {
    console.warn("activity log failed (ignored)", e);
  }
}

/** The tree's feed, newest first, capped. */
export async function recentActivity(treeId: string, limit = 200) {
  return db
    .select()
    .from(activityFeed)
    .where(eq(activityFeed.treeId, treeId))
    .orderBy(desc(activityFeed.createdAt))
    .limit(limit);
}

/** One entry, tree-checked. */
export async function activityById(treeId: string, activityId: string) {
  const rows = await db
    .select()
    .from(activityFeed)
    .where(eq(activityFeed.id, activityId))
    .limit(1);
  const row = rows[0];
  return row && row.treeId === treeId ? row : null;
}

/** Stamp an entry as undone. */
export async function markUndone(activityId: string): Promise<void> {
  await db
    .update(activityFeed)
    .set({ undoneAt: new Date() })
    .where(eq(activityFeed.id, activityId));
}
