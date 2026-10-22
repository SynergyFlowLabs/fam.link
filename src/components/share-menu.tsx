"use client";

import { useState } from "react";
import {
  createShareLinkAction,
  revokeShareLinkAction,
} from "@/actions/share";

export interface ShareLinkView {
  id: string;
  token: string;
  label: string | null;
  createdAt: string; // ISO
  revoked: boolean;
}

/**
 * Owner-facing share panel: create public read-only links, copy them,
 * revoke them. Lives next to Export in the canvas header.
 */
export function ShareMenu({ treeId, links }: { treeId: string; links: ShareLinkView[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const active = links.filter((l) => !l.revoked);
  const revoked = links.filter((l) => l.revoked);

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard blocked — the URL is still selectable text
    }
  };

  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen">
        Share
        {active.length > 0 && (
          <span className="ml-1.5 rounded-full bg-evergreen-mist px-1.5 text-[10px] font-medium text-evergreen">
            {active.length}
          </span>
        )}
      </summary>
      <div className="absolute right-0 top-9 z-30 w-80 rounded-xl border border-line bg-card p-3 shadow-lg">
        <p className="text-[11px] leading-snug text-ink-soft">
          A public link shows this tree read-only. Living relatives are kept
          private — shown only as &ldquo;{`Living relative`}&rdquo; without
          dates or stories.
        </p>

        <form action={createShareLinkAction} className="mt-2.5 flex gap-1.5">
          <input type="hidden" name="treeId" value={treeId} />
          <input
            type="text"
            name="label"
            placeholder="Label (e.g. cousins group)"
            maxLength={120}
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-soft/60 focus:border-evergreen focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-evergreen px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:opacity-90"
          >
            Create
          </button>
        </form>

        {active.length > 0 && (
          <ul className="mt-3 space-y-2">
            {active.map((l) => (
              <li key={l.id} className="rounded-lg border border-line bg-paper p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-ink">
                    {l.label ?? "Untitled link"}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-soft">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded bg-evergreen-mist px-1.5 py-1 text-[10px] text-evergreen">
                    /share/{l.token}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(l.token)}
                    className="shrink-0 rounded-lg border border-line px-2 py-1 text-[10px] text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
                  >
                    {copied === l.token ? "Copied!" : "Copy"}
                  </button>
                </div>
                <form action={revokeShareLinkAction} className="mt-1.5">
                  <input type="hidden" name="treeId" value={treeId} />
                  <input type="hidden" name="linkId" value={l.id} />
                  <button
                    type="submit"
                    className="text-[10px] text-rosewood/80 underline-offset-2 transition-colors hover:text-rosewood hover:underline"
                  >
                    Revoke this link
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {revoked.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer list-none text-[10px] text-ink-soft hover:text-ink">
              {revoked.length} revoked {revoked.length === 1 ? "link" : "links"}
            </summary>
            <ul className="mt-1 space-y-0.5">
              {revoked.map((l) => (
                <li key={l.id} className="truncate text-[10px] text-ink-soft line-through opacity-70">
                  {l.label ?? "Untitled link"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}
