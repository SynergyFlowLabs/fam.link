/**
 * Pure orphan-picking logic for the uploads sweep — no imports so it can be
 * unit-tested directly (and reused by any storage driver later).
 */

export interface MediaLike {
  id: string;
  path: string;
}

/**
 * Which media rows are no longer referenced by anything (a memory's photo,
 * a person's avatar) and may therefore be deleted together with their file.
 */
export function pickOrphanMedia<M extends MediaLike>(
  rows: readonly M[],
  referencedIds: ReadonlySet<string>,
): M[] {
  return rows.filter((r) => !referencedIds.has(r.id));
}

/**
 * The set of media ids a tree still references: every memory photo/voice
 * clip, every person avatar, and every standalone gallery document/scan
 * (media rows tagged to a person, issue #37).
 */
export function collectReferencedMediaIds(input: {
  memoryMediaIds: (string | null | undefined)[];
  personPhotoIds: (string | null | undefined)[];
  documentMediaIds?: (string | null | undefined)[];
}): Set<string> {
  const ids = new Set<string>();
  for (const id of input.memoryMediaIds) {
    if (id) ids.add(id);
  }
  for (const id of input.personPhotoIds) {
    if (id) ids.add(id);
  }
  for (const id of input.documentMediaIds ?? []) {
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Files under uploads/ that no media row points at (strays from crashes or
 * interrupted uploads). `knownPaths` are the DB's `media.path` values, e.g.
 * "uploads/<id>.jpg"; `fileNames` are the directory entries.
 */
export function pickStrayFiles(
  knownPaths: ReadonlySet<string>,
  fileNames: readonly string[],
): string[] {
  return fileNames.filter((f) => !knownPaths.has(`uploads/${f}`));
}
