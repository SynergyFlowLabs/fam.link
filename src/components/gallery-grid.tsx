"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/sources";
import { formatDuration } from "@/lib/voice-media";
import { DeleteDocumentButton } from "@/components/gallery-upload";

/**
 * Gallery grid + lightbox (issue #37). Photos and scans open in a lightbox;
 * voice clips play inline; documents link straight to the PDF.
 */
export interface GalleryItem {
  id: string;
  kind: "photo" | "voice" | "document" | "scan";
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  provenance: string | null;
  caption: string | null;
  personIds: string[];
  createdAt: string;
}

const KIND_META: Record<GalleryItem["kind"], { icon: string; label: string }> = {
  photo: { icon: "🖼", label: "Photo" },
  voice: { icon: "🎙", label: "Voice" },
  document: { icon: "📄", label: "Document" },
  scan: { icon: "🔍", label: "Scan" },
};

export function GalleryGrid({
  treeId,
  items,
  personNames,
  canEdit,
}: {
  treeId: string;
  items: GalleryItem[];
  personNames: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.id === openId) ?? null;
  const nameOf = (pid: string) => personNames.find((p) => p.id === pid)?.name ?? "Unnamed";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-card/60 p-10 text-center">
        <p className="text-sm text-ink-soft">
          The gallery is empty — photos and voice memories added on person
          pages, and documents uploaded here, will gather here.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const isImage = item.mimeType.startsWith("image/");
          const standalone = item.kind === "document" || item.kind === "scan";
          return (
            <li
              key={item.id}
              className="group overflow-hidden rounded-xl border border-line bg-card"
            >
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setOpenId(item.id)}
              >
                <div className="flex h-32 items-center justify-center overflow-hidden bg-paper">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${item.id}`}
                      alt={item.caption ?? meta.label}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-3xl" aria-hidden>
                      {meta.icon}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="truncate text-xs font-medium text-ink">
                    {item.caption || meta.label}
                    {item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ""}
                  </p>
                  <p className="truncate text-[11px] text-ink-soft">
                    {item.personIds.length
                      ? item.personIds.map(nameOf).join(", ")
                      : "Tree-wide"}
                    {" · "}
                    {formatBytes(item.sizeBytes)}
                  </p>
                </div>
              </button>
              {standalone && canEdit ? (
                <div className="border-t border-line px-3 py-1.5">
                  <DeleteDocumentButton treeId={treeId} mediaId={item.id} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-paper p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {KIND_META[open.kind].icon} {open.caption || KIND_META[open.kind].label}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {open.personIds.length
                    ? open.personIds.map(nameOf).join(", ")
                    : "Tree-wide"}
                  {open.provenance ? ` · ${open.provenance}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:text-ink"
                onClick={() => setOpenId(null)}
              >
                ✕
              </button>
            </div>
            <div className="mt-3">
              {open.kind === "voice" ? (
                <audio controls src={`/api/media/${open.id}`} className="w-full" />
              ) : open.kind === "document" ? (
                <div className="rounded-xl border border-line bg-card p-6 text-center">
                  <p className="text-4xl" aria-hidden>
                    📄
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {formatBytes(open.sizeBytes)} · {open.mimeType}
                  </p>
                  <a
                    href={`/api/media/${open.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary mt-3 inline-flex"
                  >
                    Open document
                  </a>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${open.id}`}
                  alt={open.caption ?? KIND_META[open.kind].label}
                  className="max-h-[70dvh] w-full rounded-xl object-contain"
                />
              )}
              {open.caption && open.kind !== "photo" && open.kind !== "scan" ? (
                <p className="mt-3 text-sm leading-relaxed text-ink">{open.caption}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
