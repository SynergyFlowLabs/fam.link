"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteDocumentAction, uploadDocumentAction } from "@/actions/sources";
import { formatBytes } from "@/lib/sources";
import type { ActionResult } from "@/lib/action-result";

/**
 * Editor's upload for standalone documents & scans into the gallery
 * (issue #37) — PDFs, certificate photos, register scans. Optional person
 * tag and a provenance note ("found in the Patwari register, 1948").
 */
function UploadButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={disabled || pending}>
      {pending ? "Uploading…" : "Add to gallery"}
    </button>
  );
}

export function DocumentUpload({
  treeId,
  people,
}: {
  treeId: string;
  people: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  async function save(formData: FormData) {
    const res = await uploadDocumentAction(formData);
    setResult(res);
    if (res.ok) {
      setFileInfo(null);
      // keep the panel open so editors can add several in a row
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        ⬆ Add document / scan
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Add a document or scan</h2>
        <button
          type="button"
          className="text-xs text-ink-soft hover:text-ink"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
      <form action={save} className="mt-3 space-y-2">
        <input type="hidden" name="treeId" value={treeId} />
        <input
          type="file"
          name="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="input w-full text-xs"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileInfo(f ? `${f.name} · ${formatBytes(f.size)}` : null);
          }}
        />
        {fileInfo ? <p className="text-[11px] text-ink-soft">{fileInfo}</p> : null}
        <div className="flex flex-wrap gap-2">
          <select name="docKind" className="input w-36 text-xs" defaultValue="document">
            <option value="document">Document (PDF)</option>
            <option value="scan">Scan (photo)</option>
          </select>
          <select name="personId" className="input w-52 text-xs" defaultValue="">
            <option value="">Not tied to a person</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          name="provenance"
          placeholder="Where did this come from? (e.g. Patwari register, 1948)"
          className="input w-full text-xs"
          maxLength={300}
        />
        <div className="flex items-center gap-3">
          <UploadButton disabled={false} />
          {result ? (
            <span className={`text-xs ${result.ok ? "text-pine-700" : "text-rosewood"}`}>
              {result.ok ? result.message : result.error}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

/** Small delete button editors see on standalone documents in the grid. */
export function DeleteDocumentButton({ treeId, mediaId }: { treeId: string; mediaId: string }) {
  const [confirming, setConfirming] = useState(false);
  async function remove(formData: FormData) {
    await deleteDocumentAction(formData);
  }
  if (!confirming) {
    return (
      <button
        type="button"
        className="text-[11px] text-ink-soft hover:text-rosewood"
        onClick={() => setConfirming(true)}
      >
        Remove
      </button>
    );
  }
  return (
    <form action={remove} className="flex items-center gap-1">
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      <button type="submit" className="text-[11px] text-rosewood hover:underline">
        Really remove?
      </button>
      <button
        type="button"
        className="text-[11px] text-ink-soft"
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
    </form>
  );
}
