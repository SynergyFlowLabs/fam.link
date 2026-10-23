/**
 * Shared tree-mutation core — used by the direct server actions (owner +
 * invited editors) AND by suggestion review (applying a community proposal
 * to a public tree). This module is deliberately NOT "use server": it does
 * no auth of its own, so it must stay un-importable from client code.
 * Callers are responsible for role checks.
 */
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { parentChild, persons, trees, unions } from "@/db/schema";
import { fail, type ActionResult } from "@/lib/action-result";
import {
  displayNameOf,
  type PersonFields,
} from "@/lib/person-fields";

export type Relation = "father" | "mother" | "spouse" | "child";

export async function touchTree(treeId: string): Promise<void> {
  await db
    .update(trees)
    .set({ updatedAt: new Date() })
    .where(eq(trees.id, treeId));
}

export function revalidateTree(treeId: string, personId?: string): void {
  revalidatePath(`/app/trees/${treeId}`);
  revalidatePath(`/explore/${treeId}`);
  if (personId) {
    revalidatePath(`/app/trees/${treeId}/person/${personId}`);
    revalidatePath(`/explore/${treeId}/person/${personId}`);
  }
}

export async function insertPerson(
  treeId: string,
  fields: PersonFields,
): Promise<string> {
  const id = randomUUID();
  await db.insert(persons).values({ id, treeId, ...fields });
  return id;
}

/** The anchor person's parent-unions, in link order. */
export async function parentUnionsOf(childId: string) {
  const links = await db
    .select({ unionId: parentChild.unionId })
    .from(parentChild)
    .where(eq(parentChild.childId, childId));
  if (links.length === 0) return [];
  return db
    .select()
    .from(unions)
    .where(
      inArray(
        unions.id,
        links.map((l) => l.unionId),
      ),
    );
}

/**
 * The anchor person's unions (where they are a partner), in creation order.
 * Scoped to the tree — a full scan of every union in the database would slow
 * down as the number of trees grows.
 */
export async function unionsOfPartner(treeId: string, personId: string) {
  const rows = await db
    .select()
    .from(unions)
    .where(eq(unions.treeId, treeId));
  return rows.filter(
    (u) => u.partnerAId === personId || u.partnerBId === personId,
  );
}

/**
 * Adds a relative (father/mother/spouse/child) of the anchor person.
 * Returns the new person's display name on success.
 */
export async function addRelativeToTree(
  treeId: string,
  anchorId: string,
  relation: Relation,
  fields: PersonFields,
): Promise<ActionResult> {
  if (!anchorId || !["father", "mother", "spouse", "child"].includes(relation)) {
    return fail("That relationship slot isn't available — reload the page and try again.");
  }
  const anchorRows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, anchorId), eq(persons.treeId, treeId)))
    .limit(1);
  if (!anchorRows[0]) return fail("That person is no longer in this tree.");
  let createdPersonId: string | undefined;

  if (relation === "father" || relation === "mother") {
    const newId = await insertPerson(treeId, {
      ...fields,
      gender: fields.gender ?? (relation === "father" ? "m" : "f"),
    });
    createdPersonId = newId;
    const parentUnions = await parentUnionsOf(anchorId);
    // Fill an open partner slot if one exists; otherwise start a new family
    // (step/adoptive parent, or the first parent of a previously unknown pair).
    const open = parentUnions.find((u) => u.partnerBId === null);
    if (open) {
      await db
        .update(unions)
        .set({ partnerBId: newId })
        .where(eq(unions.id, open.id));
    } else {
      const unionId = randomUUID();
      await db.insert(unions).values({
        id: unionId,
        treeId,
        partnerAId: newId,
        partnerBId: null,
      });
      await db
        .insert(parentChild)
        .values({ id: randomUUID(), unionId, childId: anchorId });
    }
  } else if (relation === "spouse") {
    const newId = await insertPerson(treeId, fields);
    createdPersonId = newId;
    await db.insert(unions).values({
      id: randomUUID(),
      treeId,
      partnerAId: anchorId,
      partnerBId: newId,
    });
  } else {
    // child: attach to the anchor's couple union if one exists, else to a
    // single-parent union created for the anchor.
    const myUnions = await unionsOfPartner(treeId, anchorId);
    let target = myUnions.find((u) => u.partnerBId !== null);
    if (!target) target = myUnions[myUnions.length - 1];
    if (!target) {
      const unionId = randomUUID();
      await db.insert(unions).values({
        id: unionId,
        treeId,
        partnerAId: anchorId,
        partnerBId: null,
      });
      target = { id: unionId } as typeof target;
    }
    const childId = await insertPerson(treeId, fields);
    createdPersonId = childId;
    await db
      .insert(parentChild)
      .values({ id: randomUUID(), unionId: target.id, childId });
  }

  await touchTree(treeId);
  return { ok: true, message: displayNameOf(fields), personId: createdPersonId };
}

/** Applies an edit of a person's facts. */
export async function updatePersonInTree(
  treeId: string,
  personId: string,
  fields: PersonFields,
): Promise<ActionResult> {
  const updated = await db
    .update(persons)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(persons.id, personId), eq(persons.treeId, treeId)))
    .returning({ id: persons.id });
  if (updated.length === 0)
    return fail("That person is no longer in this tree.");
  await touchTree(treeId);
  return { ok: true, message: displayNameOf(fields) };
}
