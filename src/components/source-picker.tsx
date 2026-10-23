"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  attachSourceAction,
  createSourceAction,
  deleteSourceAction,
  detachSourceAction,
} from "@/actions/sources";
import type { ActionResult } from "@/lib/action-result";

/**
 * Source citations on person pages (issue #37) — muted chips for readers,
 * an attach/create picker for editors. Shared by the person-level Sources
 * section, memory cards, and event cards.
 */
export interface SourceRef {
  id: string;
  title: string;
  citation: string | null;
  url: string | null;
}

function AttachButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary !px-3 !py-1 text-xs" disabled={disabled || pending}>
      {pending ? "…" : "Attach"}
    </button>
  );
}

function CreateButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary !px-3 !py-1 text-xs" disabled={pending}>
      {pending ? "…" : label}
    </button>
  );
}

/** The editor's compact control: attach an existing source or create one. */
export function SourcePicker({
  treeId,
  targetType,
  targetId,
  allSources,
  attachedIds,
}: {
  treeId: string;
  targetType: "person" | "memory" | "event";
  targetId: string;
  allSources: SourceRef[];
  attachedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function attach(formData: FormData) {
    setResult(await attachSourceAction(formData));
  }
  async function create(formData: FormData) {
    const res = await createSourceAction(formData);
    setResult(res);
    if (res.ok) setCreating(false);
  }

  const remaining = allSources.filter((s) => !attachedIds.includes(s.id));

  return (
    <div className="mt-2 text-xs">
      {open ? (
        <div className="rounded-xl border border-line bg-paper p-3">
          {creating ? (
            <form action={create} className="space-y-2">
              <input type="hidden" name="treeId" value={treeId} />
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />
              <input
                type="text"
                name="title"
                required
                maxLength={120}
                placeholder="Source title (e.g. Interview with Farida Begum)"
                className="input w-full text-xs"
              />
              <input
                type="text"
                name="citation"
                maxLength={500}
                placeholder="Citation detail (optional) — date, register, page"
                className="input w-full text-xs"
              />
              <input
                type="url"
                name="url"
                placeholder="Link (optional, https://…)"
                className="input w-full text-xs"
              />
              <div className="flex items-center gap-2">
                <CreateButton label="Create & attach" />
                <button
                  type="button"
                  className="text-xs text-ink-soft hover:text-ink"
                  onClick={() => setCreating(false)}
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form action={attach} className="space-y-2">
              <input type="hidden" name="treeId" value={treeId} />
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />
              {remaining.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select name="sourceId" className="input w-64 text-xs" required>
                    {remaining.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <AttachButton disabled={false} />
                </div>
              ) : (
                <p className="text-ink-soft">
                  Every source in this tree is already attached here.
                </p>
              )}
              <button
                type="button"
                className="text-xs text-evergreen hover:underline"
                onClick={() => setCreating(true)}
              >
                + New source…
              </button>
            </form>
          )}
          {result ? (
            <p className={`mt-2 ${result.ok ? "text-pine-700" : "text-rosewood"}`}>
              {result.ok ? result.message : result.error}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-2 text-[11px] text-ink-soft hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-[11px] text-ink-soft underline-offset-2 hover:text-evergreen hover:underline"
          onClick={() => setOpen(true)}
        >
          📎 Add source
        </button>
      )}
    </div>
  );
}

/** Muted citation line + editor's detach link. */
export function SourceChips({
  treeId,
  targetType,
  targetId,
  sources,
  canEdit,
}: {
  treeId: string;
  targetType: "person" | "memory" | "event";
  targetId: string;
  sources: SourceRef[];
  canEdit: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  if (sources.length === 0 && !canEdit) return null;

  async function detach(sourceId: string) {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("targetType", targetType);
    fd.set("targetId", targetId);
    fd.set("sourceId", sourceId);
    setResult(await detachSourceAction(fd));
  }
  async function destroy(sourceId: string) {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("sourceId", sourceId);
    setResult(await deleteSourceAction(fd));
  }

  return (
    <div className="mt-2 space-y-1">
      {sources.map((s) => (
        <p key={s.id} className="text-xs italic text-ink-soft">
          Source:{" "}
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-evergreen"
            >
              {s.title}
            </a>
          ) : (
            s.title
          )}
          {s.citation ? <span className="text-ink-soft/70"> · {s.citation}</span> : null}
          {canEdit ? (
            <>
              {" "}
              <button
                type="button"
                className="not-italic text-ink-soft/50 hover:text-rosewood"
                onClick={() => detach(s.id)}
                title="Detach this source"
              >
                ✕
              </button>{" "}
              <button
                type="button"
                className="not-italic text-ink-soft/30 hover:text-rosewood"
                onClick={() => destroy(s.id)}
                title="Delete this source everywhere"
              >
                🗑
              </button>
            </>
          ) : null}
        </p>
      ))}
      {result && !result.ok ? <p className="text-xs text-rosewood">{result.error}</p> : null}
    </div>
  );
}
