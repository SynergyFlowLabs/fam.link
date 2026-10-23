"use client";

import { SourceChips, SourcePicker, type SourceRef } from "@/components/source-picker";

/**
 * Person-level Sources section (issue #37) — the "how do you know?" block
 * under a person's story. Readers see muted citations; editors attach,
 * create, detach, or delete.
 */
export function SourcesSection({
  treeId,
  personId,
  sources,
  allSources,
  canEdit,
}: {
  treeId: string;
  personId: string;
  sources: SourceRef[];
  allSources: SourceRef[];
  canEdit: boolean;
}) {
  if (sources.length === 0 && !canEdit) return null;
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">
        Sources{" "}
        <span className="text-sm font-normal text-ink-soft">({sources.length})</span>
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        How the family knows what it knows — interviews, registers, documents.
      </p>
      <SourceChips
        treeId={treeId}
        targetType="person"
        targetId={personId}
        sources={sources}
        canEdit={canEdit}
      />
      {canEdit ? (
        <SourcePicker
          treeId={treeId}
          targetType="person"
          targetId={personId}
          allSources={allSources}
          attachedIds={sources.map((s) => s.id)}
        />
      ) : null}
    </section>
  );
}
