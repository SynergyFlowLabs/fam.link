"use client";

import { useTransition } from "react";
import {
  createShareLinkAction,
  revokeShareLinkAction,
} from "@/actions/share";
import { useToast } from "@/components/toaster";

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
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [revoking, startRevoking] = useTransition();
  const active = links.filter((l) => !l.revoked);
  const revoked = links.filter((l) => l.revoked);

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.info("Couldn't copy automatically", "Select the link text below and copy it by hand.");
    }
  };

  const create = (fd: FormData) => {
    startTransition(async () => {
      try {
        const res = await createShareLinkAction(fd);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't create the link — try again.");
          return;
        }
        // Copy the fresh link straight to the clipboard — one fewer step.
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/share/${res.token}`);
          toast.success("Share link created", "Already copied to your clipboard.");
        } catch {
          toast.success("Share link created", "Copy it from the list below.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  };

  const revoke = (fd: FormData) => {
    startRevoking(async () => {
      try {
        const res = await revokeShareLinkAction(fd);
        if (res.ok) toast.info("Link revoked", "Its URL stops working immediately.");
        else toast.error(res.error ?? "Couldn't revoke the link — try again.");
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
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

        <form action={create} className="mt-2.5 flex gap-1.5">
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
            disabled={pending}
            className="shrink-0 rounded-lg bg-evergreen px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create"}
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
                    Copy
                  </button>
                </div>
                <form action={revoke} className="mt-1.5">
                  <input type="hidden" name="treeId" value={treeId} />
                  <input type="hidden" name="linkId" value={l.id} />
                  <button
                    type="submit"
                    disabled={revoking}
                    className="text-[10px] text-rosewood/80 underline-offset-2 transition-colors hover:text-rosewood hover:underline disabled:opacity-60"
                  >
                    {revoking ? "Revoking…" : "Revoke this link"}
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
