"use server";

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, DATA_DIR } from "@/db";
import {
  eventSources,
  media,
  memories,
  memorySources,
  personEvents,
  personSources,
  persons,
  sources,
} from "@/db/schema";
import { getTreeAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { actorNameOf } from "@/lib/actors";
import { touchTree, revalidateTree } from "@/lib/tree-mutations";
import { canEdit, type Role } from "@/lib/roles";
import { sweepTreeMedia } from "@/lib/uploads";
import {
  documentExtForMime,
  DOCUMENT_MAX_BYTES,
  isAllowedDocumentMime,
  normalizeSourceUrl,
  SOURCE_CITATION_MAX,
  SOURCE_TITLE_MAX,
} from "@/lib/sources";
import type { ActionResult } from "@/lib/action-result";

/**
 * Sources & provenance (issue #37) — the "how do you know?" layer.
 * Owner/editor manage citations and attach them to persons, memories, and
 * events; every attach/detach lands in the activity feed.
 */

function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function accessFor(
  treeId: string,
): Promise<{ userId: string; role: Role } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const access = await getTreeAccess(treeId, user.id);
  return access ? { userId: user.id, role: access.role } : null;
}

/** Editor-and-up or a polite denial — sources are trust machinery. */
function editorDenial(): ActionResult {
  return fail(
    "Managing sources needs the Editor role — ask the tree's owner for access.",
  );
}

/** The person a target belongs to (for scope + activity personIds). */
async function targetPersonId(
  treeId: string,
  targetType: "person" | "memory" | "event",
  targetId: string,
): Promise<string | null> {
  if (targetType === "person") return targetId;
  if (targetType === "memory") {
    const rows = await db
      .select({ personId: memories.personId })
      .from(memories)
      .innerJoin(persons, eq(memories.personId, persons.id))
      .where(and(eq(memories.id, targetId), eq(persons.treeId, treeId)))
      .limit(1);
    return rows[0]?.personId ?? null;
  }
  const rows = await db
    .select({ personId: personEvents.personId })
    .from(personEvents)
    .innerJoin(persons, eq(personEvents.personId, persons.id))
    .where(and(eq(personEvents.id, targetId), eq(persons.treeId, treeId)))
    .limit(1);
  return rows[0]?.personId ?? null;
}

async function logSource(
  treeId: string,
  userId: string,
  personId: string | null,
  personName: string | null,
  sourceTitle: string,
): Promise<void> {
  await logActivity({
    treeId,
    actorUserId: userId,
    actorName: await actorNameOf(userId),
    action: "source",
    targetType: "source",
    targetId: sourceTitle, // sources have no page of their own
    targetLabel: personName ?? "the tree",
    detail: {
      ...(personId ? { personIds: [personId] } : {}),
      ...(personName ? { personName } : {}),
      sourceTitle,
    },
    undoable: false,
  });
}

export async function createSourceAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) return editorDenial();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("A source needs a title — even \"Nani's stories\".");
  if (title.length > SOURCE_TITLE_MAX)
    return fail(`Keep the title under ${SOURCE_TITLE_MAX} characters.`);
  const citation = String(formData.get("citation") ?? "").trim();
  if (citation.length > SOURCE_CITATION_MAX)
    return fail(`Keep the citation under ${SOURCE_CITATION_MAX} characters.`);
  const url = normalizeSourceUrl(String(formData.get("url") ?? ""));
  if (url === null && String(formData.get("url") ?? "").trim())
    return fail("That link doesn't look right — use a full http(s) URL.");

  const id = randomUUID();
  await db.insert(sources).values({
    id,
    treeId,
    title,
    citation: citation || null,
    url,
    createdBy: access.userId,
  });
  await touchTree(treeId);

  const targetType = String(formData.get("targetType") ?? "") as
    | "person"
    | "memory"
    | "event"
    | "";
  const targetId = String(formData.get("targetId") ?? "");
  if (targetType && targetId) {
    const personId = await targetPersonId(treeId, targetType, targetId);
    if (personId) {
      if (targetType === "person") {
        await db.insert(personSources).values({ personId, sourceId: id });
      } else if (targetType === "memory") {
        await db.insert(memorySources).values({ memoryId: targetId, sourceId: id });
      } else {
        await db.insert(eventSources).values({ eventId: targetId, sourceId: id });
      }
      const name = personId
        ? (
            await db
              .select({ first: persons.firstName, last: persons.lastName })
              .from(persons)
              .where(eq(persons.id, personId))
              .limit(1)
          )[0]
        : null;
      await logSource(
        treeId,
        access.userId,
        personId,
        name ? [name.first, name.last].filter(Boolean).join(" ") : null,
        title,
      );
    }
  } else {
    await logSource(treeId, access.userId, null, null, title);
  }

  revalidateTree(treeId);
  return { ok: true, message: "Source added", sourceId: id };
}

export async function attachSourceAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) return editorDenial();

  const sourceId = String(formData.get("sourceId") ?? "");
  const targetType = String(formData.get("targetType") ?? "") as
    | "person"
    | "memory"
    | "event";
  const targetId = String(formData.get("targetId") ?? "");
  if (!sourceId || !targetId || !targetType)
    return fail("Pick a source and a place to attach it.");

  const sourceRow = (
    await db
      .select({ title: sources.title })
      .from(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.treeId, treeId)))
      .limit(1)
  )[0];
  if (!sourceRow) return fail("That source isn't in this tree.");

  const personId = await targetPersonId(treeId, targetType, targetId);
  if (!personId) return fail("That item isn't in this tree.");

  if (targetType === "person") {
    await db
      .insert(personSources)
      .values({ personId, sourceId })
      .onConflictDoNothing();
  } else if (targetType === "memory") {
    await db
      .insert(memorySources)
      .values({ memoryId: targetId, sourceId })
      .onConflictDoNothing();
  } else {
    await db
      .insert(eventSources)
      .values({ eventId: targetId, sourceId })
      .onConflictDoNothing();
  }

  const name = (
    await db
      .select({ first: persons.firstName, last: persons.lastName })
      .from(persons)
      .where(eq(persons.id, personId))
      .limit(1)
  )[0];
  await logSource(
    treeId,
    access.userId,
    personId,
    name ? [name.first, name.last].filter(Boolean).join(" ") : null,
    sourceRow.title,
  );
  revalidateTree(treeId, personId);
  return { ok: true, message: "Source attached" };
}

export async function detachSourceAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) return editorDenial();

  const sourceId = String(formData.get("sourceId") ?? "");
  const targetType = String(formData.get("targetType") ?? "") as
    | "person"
    | "memory"
    | "event";
  const targetId = String(formData.get("targetId") ?? "");
  if (!sourceId || !targetId || !targetType)
    return fail("Nothing to detach.");

  if (targetType === "person") {
    await db
      .delete(personSources)
      .where(and(eq(personSources.personId, targetId), eq(personSources.sourceId, sourceId)));
  } else if (targetType === "memory") {
    await db
      .delete(memorySources)
      .where(and(eq(memorySources.memoryId, targetId), eq(memorySources.sourceId, sourceId)));
  } else {
    await db
      .delete(eventSources)
      .where(and(eq(eventSources.eventId, targetId), eq(eventSources.sourceId, sourceId)));
  }
  await touchTree(treeId);
  revalidateTree(treeId);
  return { ok: true, message: "Source removed" };
}

export async function deleteSourceAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) return editorDenial();

  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return fail("Nothing to delete.");
  const row = (
    await db
      .select({ title: sources.title })
      .from(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.treeId, treeId)))
      .limit(1)
  )[0];
  if (!row) return fail("That source isn't in this tree.");
  await db.delete(sources).where(and(eq(sources.id, sourceId), eq(sources.treeId, treeId)));
  await touchTree(treeId);
  revalidateTree(treeId);
  return { ok: true, message: `Deleted “${row.title}”` };
}

/**
 * Upload a document or scan straight into the gallery (issue #37).
 * Standalone media — no memory required; optionally tagged to a person
 * with a provenance note ("found in the Patwari register, 1948").
 */
export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) return editorDenial();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return fail("Choose a PDF or image to upload.");
  if (!isAllowedDocumentMime(file.type))
    return fail("Documents need to be a PDF, JPEG, PNG, WebP, or HEIC.");
  if (file.size > DOCUMENT_MAX_BYTES)
    return fail("Documents are capped at 10 MB for now.");

  const personId = String(formData.get("personId") ?? "");
  if (personId) {
    const inTree = (
      await db
        .select({ id: persons.id })
        .from(persons)
        .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
        .limit(1)
    )[0];
    if (!inTree) return fail("That person isn't in this tree.");
  }
  const provenance = String(formData.get("provenance") ?? "").trim();
  const sourceType = String(formData.get("docKind") ?? "document") === "scan" ? "scan" : "document";

  const id = randomUUID();
  const ext = documentExtForMime(file.type);
  const dir = path.join(DATA_DIR, "uploads");
  mkdirSync(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${id}.${ext}`),
    Buffer.from(await file.arrayBuffer()),
  );
  await db.insert(media).values({
    id,
    treeId,
    path: `uploads/${id}.${ext}`,
    mimeType: file.type,
    sizeBytes: file.size,
    sourceType,
    provenance: provenance || null,
    personId: personId || null,
    uploadedBy: access.userId,
  });
  await touchTree(treeId);
  revalidatePath(`/app/trees/${treeId}/gallery`);
  return { ok: true, message: sourceType === "scan" ? "Scan added to the gallery" : "Document added to the gallery" };
}

export async function deleteDocumentAction(formData: FormData): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "");
  const access = await accessFor(treeId);
  if (!access) return fail("You don't have access to that tree.");
  if (!canEdit(access.role)) return editorDenial();

  const mediaId = String(formData.get("mediaId") ?? "");
  const row = (
    await db
      .select({ id: media.id, sourceType: media.sourceType })
      .from(media)
      .where(and(eq(media.id, mediaId), eq(media.treeId, treeId)))
      .limit(1)
  )[0];
  if (!row) return fail("That file isn't in this tree.");
  if (row.sourceType === "memory")
    return fail("Photo and voice memories are removed from the person's page, not here.");
  await db.delete(media).where(eq(media.id, mediaId));
  await sweepTreeMedia(treeId); // removes the file (now unreferenced)
  await touchTree(treeId);
  revalidatePath(`/app/trees/${treeId}/gallery`);
  return { ok: true, message: "Removed from the gallery" };
}
