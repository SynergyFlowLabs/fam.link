import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  customFieldDefs,
  labelDefs,
  memories,
  memoryCustomValues,
  memoryLabels,
  personCustomValues,
  personLabels,
  persons,
} from "@/db/schema";

export interface LabelView {
  id: string;
  treeId: string;
  name: string;
  color: string | null;
}

export async function listLabelDefs(treeId: string): Promise<LabelView[]> {
  const rows = await db.select().from(labelDefs).where(eq(labelDefs.treeId, treeId));
  return rows.map((r) => ({ id: r.id, treeId: r.treeId, name: r.name, color: r.color }));
}

export async function listCustomFieldDefs(treeId: string) {
  const rows = await db.select().from(customFieldDefs).where(eq(customFieldDefs.treeId, treeId));
  return rows;
}

/** Labels for a specific person (joined to def names). */
export async function getPersonLabels(personId: string): Promise<LabelView[]> {
  const rows = await db
    .select({ label: labelDefs })
    .from(personLabels)
    .innerJoin(labelDefs, eq(personLabels.labelId, labelDefs.id))
    .where(eq(personLabels.personId, personId));
  return rows.map((r) => ({
    id: r.label.id,
    treeId: r.label.treeId,
    name: r.label.name,
    color: r.label.color,
  }));
}

/** Map personId → labels for all persons in a tree (one query). */
export async function getPersonLabelsByTree(treeId: string): Promise<Map<string, LabelView[]>> {
  const personRows = await db.select({ id: persons.id }).from(persons).where(eq(persons.treeId, treeId));
  if (personRows.length === 0) return new Map();
  const ids = personRows.map((p) => p.id);
  const rows = await db
    .select({ personId: personLabels.personId, label: labelDefs })
    .from(personLabels)
    .innerJoin(labelDefs, eq(personLabels.labelId, labelDefs.id))
    .where(inArray(personLabels.personId, ids));
  const map = new Map<string, LabelView[]>();
  for (const r of rows) {
    const arr = map.get(r.personId) ?? [];
    arr.push({ id: r.label.id, treeId: r.label.treeId, name: r.label.name, color: r.label.color });
    map.set(r.personId, arr);
  }
  return map;
}

/** Labels for a specific memory. */
export async function getMemoryLabels(memoryId: string): Promise<LabelView[]> {
  const rows = await db
    .select({ label: labelDefs })
    .from(memoryLabels)
    .innerJoin(labelDefs, eq(memoryLabels.labelId, labelDefs.id))
    .where(eq(memoryLabels.memoryId, memoryId));
  return rows.map((r) => ({
    id: r.label.id,
    treeId: r.label.treeId,
    name: r.label.name,
    color: r.label.color,
  }));
}

/** Map memoryId → labels for all memories in a tree. */
export async function getMemoryLabelsByTree(treeId: string): Promise<Map<string, LabelView[]>> {
  const memRows = await db
    .select({ id: memories.id })
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(persons.treeId, treeId));
  if (memRows.length === 0) return new Map();
  const ids = memRows.map((m) => m.id);
  const rows = await db
    .select({ memoryId: memoryLabels.memoryId, label: labelDefs })
    .from(memoryLabels)
    .innerJoin(labelDefs, eq(memoryLabels.labelId, labelDefs.id))
    .where(inArray(memoryLabels.memoryId, ids));
  const map = new Map<string, LabelView[]>();
  for (const r of rows) {
    const arr = map.get(r.memoryId) ?? [];
    arr.push({ id: r.label.id, treeId: r.label.treeId, name: r.label.name, color: r.label.color });
    map.set(r.memoryId, arr);
  }
  return map;
}

/** Custom values for a person: fieldDef → value */
export async function getPersonCustomValues(personId: string) {
  const rows = await db
    .select({ field: customFieldDefs, value: personCustomValues })
    .from(personCustomValues)
    .innerJoin(customFieldDefs, eq(personCustomValues.fieldId, customFieldDefs.id))
    .where(eq(personCustomValues.personId, personId));
  return rows.map((r) => ({
    fieldId: r.field.id,
    fieldName: r.field.name,
    kind: r.field.kind as "text" | "number" | "date" | "select",
    optionsJson: r.field.optionsJson,
    value: r.value.value,
  }));
}

/** Map personId → custom values for all persons in tree. */
export async function getPersonCustomValuesByTree(
  treeId: string,
): Promise<Map<string, { fieldId: string; fieldName: string; kind: string; optionsJson: string | null; value: string }[]>> {
  const personRows = await db.select({ id: persons.id }).from(persons).where(eq(persons.treeId, treeId));
  if (personRows.length === 0) return new Map();
  const ids = personRows.map((p) => p.id);
  const rows = await db
    .select({ personId: personCustomValues.personId, field: customFieldDefs, value: personCustomValues })
    .from(personCustomValues)
    .innerJoin(customFieldDefs, eq(personCustomValues.fieldId, customFieldDefs.id))
    .where(inArray(personCustomValues.personId, ids));
  const map = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = map.get(r.personId) as never[] | undefined;
    if (arr) (arr as never[]).push(r as never);
    else map.set(r.personId, [r as never]);
  }
  // Normalize to simpler shape
  const out = new Map<string, { fieldId: string; fieldName: string; kind: string; optionsJson: string | null; value: string }[]>();
  for (const [k, v] of map) {
    out.set(
      k,
      (v as { field: typeof customFieldDefs.$inferSelect; value: typeof personCustomValues.$inferSelect }[]).map((x) => ({
        fieldId: x.field.id,
        fieldName: x.field.name,
        kind: x.field.kind as string,
        optionsJson: x.field.optionsJson,
        value: x.value.value,
      })),
    );
  }
  return out;
}

export async function getMemoryCustomValues(memoryId: string) {
  const rows = await db
    .select({ field: customFieldDefs, value: memoryCustomValues })
    .from(memoryCustomValues)
    .innerJoin(customFieldDefs, eq(memoryCustomValues.fieldId, customFieldDefs.id))
    .where(eq(memoryCustomValues.memoryId, memoryId));
  return rows.map((r) => ({
    fieldId: r.field.id,
    fieldName: r.field.name,
    kind: r.field.kind as string,
    optionsJson: r.field.optionsJson,
    value: r.value.value,
  }));
}
