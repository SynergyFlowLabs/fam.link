"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { personEvents, persons, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { ActionResult } from "@/lib/action-result";
import {
  EVENT_KINDS,
  normalizeKind,
  validateDateText,
  validateNote,
  validatePlaceText,
  validateSource,
} from "@/lib/person-events";
import { logActivity } from "@/lib/activity-log";
import { personWithinScope } from "@/lib/branch-writes";

/** Branch-scoped editors may edit only inside their branch (issue #34). */
async function scopeGuard(
  treeId: string,
  scopePersonId: string | null | undefined,
  personId: string,
): Promise<string | null> {
  if (await personWithinScope(scopePersonId, treeId, personId)) return null;
  return "That person is outside your branch — ask the owner to widen your scope.";
}

async function actorNameOf(userId: string): Promise<string> {
  const rows = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.name ?? "Someone";
}

function err(msg: string): ActionResult {
  return { ok: false, message: msg } as unknown as ActionResult;
}

export async function createPersonEventAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "").trim();
  const personId = String(formData.get("personId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const dateTextRaw = formData.get("dateText");
  const placeTextRaw = formData.get("placeText");
  const noteRaw = formData.get("note");
  const sourceRaw = formData.get("source");

  if (!treeId || !personId) return err("Missing tree or person.");
  const kind = normalizeKind(kindRaw);
  if (!kind) return err(`Kind must be one of: ${EVENT_KINDS.join(", ")}.`);

  const dateText = dateTextRaw != null ? String(dateTextRaw).trim() : "";
  const placeText = placeTextRaw != null ? String(placeTextRaw).trim() : "";
  const note = noteRaw != null ? String(noteRaw).trim() : "";
  const source = sourceRaw != null ? String(sourceRaw).trim() : "";

  const dErr = validateDateText(dateText || null);
  if (dErr) return err(dErr);
  const pErr = validatePlaceText(placeText || null);
  if (pErr) return err(pErr);
  const nErr = validateNote(note || null);
  if (nErr) return err(nErr);
  const sErr = validateSource(source || null);
  if (sErr) return err(sErr);

  if (!dateText && !placeText && !note && !source)
    return err("Add at least a date, place, note, or source.");

  const user = await getCurrentUser();
  if (!user) return err("Please sign in.");
  const access = await getTreeAccess(treeId, user.id);
  if (!access || (access.role !== "editor" && access.role !== "owner"))
    return err("Only editors and owners can add life events.");
  const scopeErr = await scopeGuard(treeId, access.scopePersonId, personId);
  if (scopeErr) return err(scopeErr);

  const personRows = await db
    .select({ id: persons.id, treeId: persons.treeId })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  const person = personRows[0];
  if (!person || person.treeId !== treeId) return err("Person not found in this tree.");

  const id = randomUUID();
  const evSnap = {
    id,
    personId,
    kind,
    dateText: dateText || null,
    placeText: placeText || null,
    note: note || null,
    source: source || null,
  };
  await db.insert(personEvents).values(evSnap);

  await logActivity({
    treeId,
    actorUserId: user.id,
    actorName: await actorNameOf(user.id),
    action: "add_event",
    targetType: "event",
    targetId: id,
    targetLabel: null,
    detail: { personIds: [personId], kind, event: evSnap },
    undoable: true,
  });

  revalidatePath(`/app/trees/${treeId}/person/${personId}`);
  revalidatePath(`/app/trees/${treeId}`);
  return { ok: true, message: "Event added." } as unknown as ActionResult;
}

export async function updatePersonEventAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "").trim();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const personId = String(formData.get("personId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const dateTextRaw = formData.get("dateText");
  const placeTextRaw = formData.get("placeText");
  const noteRaw = formData.get("note");
  const sourceRaw = formData.get("source");

  if (!treeId || !eventId || !personId) return err("Missing fields.");
  const kind = normalizeKind(kindRaw);
  if (!kind) return err(`Kind must be one of: ${EVENT_KINDS.join(", ")}.`);

  const dateText = dateTextRaw != null ? String(dateTextRaw).trim() : "";
  const placeText = placeTextRaw != null ? String(placeTextRaw).trim() : "";
  const note = noteRaw != null ? String(noteRaw).trim() : "";
  const source = sourceRaw != null ? String(sourceRaw).trim() : "";

  const dErr = validateDateText(dateText || null);
  if (dErr) return err(dErr);
  const pErr = validatePlaceText(placeText || null);
  if (pErr) return err(pErr);
  const nErr = validateNote(note || null);
  if (nErr) return err(nErr);
  const sErr = validateSource(source || null);
  if (sErr) return err(sErr);

  const user = await getCurrentUser();
  if (!user) return err("Please sign in.");
  const access = await getTreeAccess(treeId, user.id);
  if (!access || (access.role !== "editor" && access.role !== "owner"))
    return err("Only editors and owners can update events.");
  const scopeErrU = await scopeGuard(treeId, access.scopePersonId, personId);
  if (scopeErrU) return err(scopeErrU);

  const evRows = await db
    .select()
    .from(personEvents)
    .where(eq(personEvents.id, eventId))
    .limit(1);
  const prevEvent = evRows[0];
  if (!prevEvent) return err("Event not found.");
  if (prevEvent.personId !== personId) return err("Event does not belong to this person.");

  await db
    .update(personEvents)
    .set({
      kind,
      dateText: dateText || null,
      placeText: placeText || null,
      note: note || null,
      source: source || null,
      updatedAt: new Date(),
    })
    .where(eq(personEvents.id, eventId));

  await logActivity({
    treeId,
    actorUserId: user.id,
    actorName: await actorNameOf(user.id),
    action: "update_event",
    targetType: "event",
    targetId: eventId,
    targetLabel: null,
    detail: { personIds: [personId], kind, prev: prevEvent },
    undoable: true,
  });

  revalidatePath(`/app/trees/${treeId}/person/${personId}`);
  return { ok: true, message: "Event updated." } as unknown as ActionResult;
}

export async function deletePersonEventAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "").trim();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const personId = String(formData.get("personId") ?? "").trim();
  if (!treeId || !eventId || !personId) return err("Missing fields.");

  const user = await getCurrentUser();
  if (!user) return err("Please sign in.");
  const access = await getTreeAccess(treeId, user.id);
  if (!access || (access.role !== "editor" && access.role !== "owner"))
    return err("Only editors and owners can delete events.");
  const scopeErrD = await scopeGuard(treeId, access.scopePersonId, personId);
  if (scopeErrD) return err(scopeErrD);

  const evRows = await db
    .select()
    .from(personEvents)
    .where(eq(personEvents.id, eventId))
    .limit(1);
  const ev = evRows[0];
  if (!ev) return err("Event not found.");
  if (ev.personId !== personId) return err("Event does not belong to this person.");

  await db.delete(personEvents).where(eq(personEvents.id, eventId));
  await logActivity({
    treeId,
    actorUserId: user.id,
    actorName: await actorNameOf(user.id),
    action: "delete_event",
    targetType: "event",
    targetId: eventId,
    targetLabel: null,
    detail: { personIds: [personId], kind: ev.kind, event: ev },
    undoable: true,
  });
  revalidatePath(`/app/trees/${treeId}/person/${personId}`);
  return { ok: true, message: "Event removed." } as unknown as ActionResult;
}
