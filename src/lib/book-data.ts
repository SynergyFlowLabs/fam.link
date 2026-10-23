import { eq, inArray } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, DATA_DIR } from "@/db";
import {
  media,
  memories,
  parentChild,
  personEvents,
  persons,
  trees,
  unions,
} from "@/db/schema";
import type { BookEvent, BookInput, BookMemory, BookPerson, LivingMode } from "@/lib/book";

/**
 * Family book data loading (issue #39) — one loader shared by the print
 * view page and the PDF route, so the two can never drift. Branch scope
 * (P1.5) applies here; living redaction happens in buildBook per the
 * owner's choice. Private custom fields are simply never loaded.
 */

export interface BookAccess {
  role: string;
  scopePersonId?: string | null;
}

interface GenUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
}
interface GenLink {
  unionId: string;
  childId: string;
}

/**
 * Generation of every reachable person from the focus: parents −1,
 * partners same generation, children +1. Unreached people (other lines)
 * land in an appendix generation so they still print, sorted last.
 */
export function generationsFromFocus(
  focusId: string | null,
  persons: { id: string }[],
  unions: GenUnion[],
  links: GenLink[],
): Map<string, number> {
  const gen = new Map<string, number>();
  if (!focusId) {
    for (const p of persons) gen.set(p.id, 0);
    return gen;
  }
  gen.set(focusId, 0);
  let frontier = [focusId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const g = gen.get(id)!;
      for (const l of links.filter((l) => l.childId === id)) {
        const u = unions.find((x) => x.id === l.unionId);
        for (const pid of [u?.partnerAId, u?.partnerBId]) {
          if (pid && !gen.has(pid)) {
            gen.set(pid, g - 1);
            next.push(pid);
          }
        }
      }
      for (const u of unions.filter((x) => x.partnerAId === id || x.partnerBId === id)) {
        for (const l of links.filter((l) => l.unionId === u.id)) {
          if (!gen.has(l.childId)) {
            gen.set(l.childId, g + 1);
            next.push(l.childId);
          }
        }
        const other = u.partnerAId === id ? u.partnerBId : u.partnerAId;
        if (other && !gen.has(other)) {
          gen.set(other, g);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  const APPENDIX = 900;
  for (const p of persons) {
    if (!gen.has(p.id)) gen.set(p.id, APPENDIX);
  }
  return gen;
}

export interface LoadedBook {
  input: BookInput;
  /** media id → file bytes, for photos the PDF embeds. */
  images: Map<string, Buffer>;
  treeName: string;
  focusPersonId: string | null;
}

export async function loadBookData(
  treeId: string,
  access: BookAccess,
  livingMode: LivingMode,
): Promise<LoadedBook> {
  const treeRow = (
    await db
      .select({ name: trees.name, focusPersonId: trees.focusPersonId })
      .from(trees)
      .where(eq(trees.id, treeId))
      .limit(1)
  )[0];

  const personRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      alsoKnownAs: persons.alsoKnownAs,
      living: persons.living,
      gender: persons.gender,
      birthDateText: persons.birthDateText,
      birthPlace: persons.birthPlace,
      deathDateText: persons.deathDateText,
      deathPlace: persons.deathPlace,
      notes: persons.notes,
      photoMediaId: persons.photoMediaId,
    })
    .from(persons)
    .where(eq(persons.treeId, treeId));

  const unionRows: GenUnion[] = (
    await db
      .select({ id: unions.id, partnerAId: unions.partnerAId, partnerBId: unions.partnerBId })
      .from(unions)
      .where(eq(unions.treeId, treeId))
  ).map((u) => ({ id: u.id, partnerAId: u.partnerAId, partnerBId: u.partnerBId ?? null }));
  const linkRows: GenLink[] = (
    await db
      .select({ unionId: parentChild.unionId, childId: parentChild.childId })
      .from(parentChild)
      .innerJoin(unions, eq(parentChild.unionId, unions.id))
      .where(eq(unions.treeId, treeId))
  ).map((l) => ({ unionId: l.unionId, childId: l.childId }));

  // Branch scope (P1.5): a scoped member's book covers their line only.
  let allowed: Set<string> | null = null;
  if (access.scopePersonId) {
    const { getBranchPersonIds } = await import("@/lib/branch-scope");
    const scoped = getBranchPersonIds(access.scopePersonId, personRows, unionRows, linkRows);
    const set = scoped ?? new Set<string>([access.scopePersonId]);
    allowed = set.size === 0 ? new Set([access.scopePersonId]) : set;
  }
  const visible = allowed ? personRows.filter((p) => allowed.has(p.id)) : personRows;

  const focusId =
    treeRow?.focusPersonId && visible.some((p) => p.id === treeRow.focusPersonId)
      ? treeRow.focusPersonId
      : visible[0]?.id ?? null;

  const gens = generationsFromFocus(focusId, visible, unionRows, linkRows);

  const bookPersons: BookPerson[] = visible.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    alsoKnownAs: p.alsoKnownAs,
    living: p.living,
    gender: p.gender,
    birthDateText: p.birthDateText,
    birthPlace: p.birthPlace,
    deathDateText: p.deathDateText,
    deathPlace: p.deathPlace,
    notes: p.notes,
    photoMediaId: p.photoMediaId,
    generation: gens.get(p.id) ?? 900,
    relation: null,
  }));

  const ids = visible.map((p) => p.id);
  const eventRows: BookEvent[] = ids.length
    ? await db
        .select({
          id: personEvents.id,
          personId: personEvents.personId,
          kind: personEvents.kind,
          dateText: personEvents.dateText,
          placeText: personEvents.placeText,
          note: personEvents.note,
        })
        .from(personEvents)
        .where(inArray(personEvents.personId, ids))
    : [];

  const memoryRows: BookMemory[] = ids.length
    ? (
        await db
          .select({
            id: memories.id,
            personId: memories.personId,
            kind: memories.kind,
            body: memories.body,
            occurredText: memories.occurredText,
            authorName: memories.authorName,
            mediaId: memories.mediaId,
            durationSeconds: media.durationSeconds,
          })
          .from(memories)
          .leftJoin(media, eq(memories.mediaId, media.id))
          .where(inArray(memories.personId, ids))
      ).map((m) => ({
        id: m.id,
        personId: m.personId,
        kind: m.kind,
        body: m.body,
        occurredText: m.occurredText,
        authorName: m.authorName,
        mediaId: m.mediaId,
        durationSeconds: m.durationSeconds ?? null,
      }))
    : [];

  // Photo files the PDF will embed (portraits + photo memories).
  const imageMediaIds = [
    ...new Set(
      [
        ...visible.map((p) => p.photoMediaId),
        ...memoryRows
          .filter((m) => m.kind === "photo" && m.mediaId)
          .map((m) => m.mediaId),
      ].filter((x): x is string => !!x),
    ),
  ];
  const images = new Map<string, Buffer>();
  if (imageMediaIds.length) {
    const mediaRows = await db
      .select({ id: media.id, path: media.path })
      .from(media)
      .where(inArray(media.id, imageMediaIds));
    await Promise.all(
      mediaRows.map(async (m) => {
        try {
          images.set(m.id, await readFile(path.join(DATA_DIR, m.path)));
        } catch {
          // file vanished (ephemeral disk) — the book renders without it
        }
      }),
    );
  }

  const input: BookInput = {
    treeName: treeRow?.name ?? "Family book",
    focusPersonId: focusId,
    persons: bookPersons,
    events: eventRows,
    memories: memoryRows,
    livingMode,
  };

  return {
    input,
    images,
    treeName: treeRow?.name ?? "Family book",
    focusPersonId: focusId,
  };
}
