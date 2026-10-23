import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { media, memories, persons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { GalleryGrid } from "@/components/gallery-grid";
import { DocumentUpload } from "@/components/gallery-upload";
import { galleryKindOf, type GalleryKind } from "@/lib/sources";

/**
 * Media gallery (issue #37) — every photo, voice clip, document, and scan
 * in the tree on one grid, with person/kind filters and a lightbox.
 * Editors add documents & scans here; photos and voice stay on person
 * pages but surface in the grid too.
 */
export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ person?: string; kind?: string }>;
}) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/app/trees/${treeId}/gallery`);
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();

  const sp = await searchParams;
  const personFilter = sp.person ?? "";
  const kindFilter = (sp.kind ?? "") as GalleryKind | "";

  const rows = await db
    .select({
      id: media.id,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      sourceType: media.sourceType,
      provenance: media.provenance,
      durationSeconds: media.durationSeconds,
      createdAt: media.createdAt,
      personId: media.personId,
      memoryPersonId: memories.personId,
      memoryBody: memories.body,
    })
    .from(media)
    .leftJoin(memories, eq(memories.mediaId, media.id))
    .where(eq(media.treeId, treeId))
    .orderBy(desc(media.createdAt));

  const peopleRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(persons)
    .where(eq(persons.treeId, treeId));

  const nameById = new Map(
    peopleRows.map(
      (p) => [p.id, [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed"] as const,
    ),
  );

  type Item = {
    id: string;
    kind: GalleryKind;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number | null;
    provenance: string | null;
    caption: string | null;
    personIds: string[];
    createdAt: string;
  };

  const items: Item[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const kind = galleryKindOf(r);
    const ids = [...new Set([r.personId, r.memoryPersonId].filter((x): x is string => !!x))];
    if (seen.has(r.id)) continue; // first (newest) memory link wins
    seen.add(r.id);
    if (personFilter && !ids.includes(personFilter)) continue;
    if (kindFilter && kind !== kindFilter) continue;
    items.push({
      id: r.id,
      kind,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      durationSeconds: r.durationSeconds,
      provenance: r.provenance,
      caption: r.memoryBody || null,
      personIds: ids,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    });
  }

  // Persons that appear in the (unfiltered) gallery — the filter's options.
  const galleryPersonIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.personId, r.memoryPersonId])
        .filter((x): x is string => !!x),
    ),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {access.tree.name} — Gallery
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {items.length} item{items.length === 1 ? "" : "s"} — photos, voice
            clips, documents, and scans across the tree.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit(access.role) ? (
            <DocumentUpload
              treeId={treeId}
              people={galleryPersonIds.map((pid) => ({
                id: pid,
                name: nameById.get(pid) ?? "Unnamed",
              }))}
            />
          ) : null}
          <a
            href={`/app/trees/${treeId}`}
            className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen"
          >
            Back to tree
          </a>
        </div>
      </div>

      <form
        method="get"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3"
      >
        <label className="text-xs text-ink-soft">
          Person
          <select name="person" defaultValue={personFilter} className="input mt-1 w-48">
            <option value="">Everyone</option>
            {galleryPersonIds.map((pid) => (
              <option key={pid} value={pid}>
                {nameById.get(pid) ?? "Unnamed"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-soft">
          Kind
          <select name="kind" defaultValue={kindFilter} className="input mt-1 w-40">
            <option value="">All kinds</option>
            <option value="photo">Photos</option>
            <option value="voice">Voice</option>
            <option value="document">Documents</option>
            <option value="scan">Scans</option>
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        {personFilter || kindFilter ? (
          <a
            href={`/app/trees/${treeId}/gallery`}
            className="text-xs text-ink-soft underline-offset-2 hover:underline"
          >
            Clear
          </a>
        ) : null}
      </form>

      <GalleryGrid
        treeId={treeId}
        items={items}
        personNames={galleryPersonIds.map((pid) => ({
          id: pid,
          name: nameById.get(pid) ?? "Unnamed",
        }))}
        canEdit={canEdit(access.role)}
      />
    </div>
  );
}
