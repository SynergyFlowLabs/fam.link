import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, DATA_DIR } from "@/db";
import { media, memories, persons } from "@/db/schema";
import {
  collectReferencedMediaIds,
  pickOrphanMedia,
} from "@/lib/orphan-media";

/**
 * Uploaded-file hygiene.
 *
 * The DB cascades rows when trees/people/memories go away, but the files
 * under DATA_DIR/uploads live outside SQLite — someone has to sweep them.
 * Strategy: targeted sweeps after every deletion action (instant feedback,
 * bounded work), plus a boot-time stray sweep as the safety net
 * (see db/index.ts).
 */

/** Best-effort unlink; a missing file is fine, a failure to remove is logged. */
export async function deleteFiles(paths: readonly string[]): Promise<void> {
  for (const rel of paths) {
    try {
      await unlink(path.join(DATA_DIR, rel));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`fam.link: couldn't delete upload ${rel}`, err);
      }
    }
  }
}

/**
 * Removes a tree's media rows + files that nothing references anymore.
 * Called after memory/person deletions — safe to run often (it only ever
 * removes what has zero references).
 */
export async function sweepTreeMedia(treeId: string): Promise<void> {
  const rows = await db.select().from(media).where(eq(media.treeId, treeId));
  if (rows.length === 0) return;

  const memoryMediaIds = await db
    .select({ mediaId: memories.mediaId })
    .from(memories)
    .innerJoin(persons, eq(memories.personId, persons.id))
    .where(eq(persons.treeId, treeId));
  const personPhotoIds = await db
    .select({ photoMediaId: persons.photoMediaId })
    .from(persons)
    .where(eq(persons.treeId, treeId));
  // Standalone gallery documents/scans (issue #37) are referenced by their
  // person tag — a media row with a person_id belongs to the gallery.
  const documentRows = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.treeId, treeId), isNotNull(media.personId)));

  const orphans = pickOrphanMedia(
    rows,
    collectReferencedMediaIds({
      memoryMediaIds: memoryMediaIds.map((m) => m.mediaId),
      personPhotoIds: personPhotoIds.map((p) => p.photoMediaId),
      documentMediaIds: documentRows.map((d) => d.id),
    }),
  );
  if (orphans.length === 0) return;

  await db.delete(media).where(
    inArray(
      media.id,
      orphans.map((o) => o.id),
    ),
  );
  await deleteFiles(orphans.map((o) => o.path));
}

/**
 * Tree deletion wipes the DB rows via cascade but would leave the files —
 * this returns the tree's file paths so the caller can unlink them after
 * (rows first: if the unlink crashes, the next boot's stray sweep catches up).
 */
export async function collectTreeFilePaths(
  treeId: string,
): Promise<string[]> {
  const rows = await db
    .select({ path: media.path })
    .from(media)
    .where(eq(media.treeId, treeId));
  return rows.map((r) => r.path);
}

/** All file names currently sitting in the uploads directory. */
export async function listUploadFileNames(): Promise<string[]> {
  try {
    return await readdir(path.join(DATA_DIR, "uploads"));
  } catch {
    return []; // directory missing — nothing to sweep
  }
}
