"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishTreeAction } from "@/actions/public";
import { useToast } from "@/components/toaster";

/**
 * Owner's publish control for the canvas header. Publishing puts the tree
 * on /explore for anyone to read, with living relatives redacted; community
 * suggestions start flowing to the tree's review queue.
 */
export function PublicToggle({
  treeId,
  isPublic,
  pendingCount,
}: {
  treeId: string;
  isPublic: boolean;
  pendingCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function toggle() {
    const fd = new FormData();
    fd.set("treeId", treeId);
    fd.set("public", isPublic ? "false" : "true");
    startTransition(async () => {
      try {
        const res = await publishTreeAction(fd);
        if (res.ok) {
          toast.success(res.message ?? "Updated");
          setConfirming(false);
          router.refresh();
        } else {
          toast.error(res.error ?? "Couldn't update — please try again.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  }

  if (isPublic) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={`/explore/${treeId}`}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/10 px-2.5 text-xs font-medium text-ink"
          title="See the public view"
        >
          <span aria-hidden>🌍</span> Public
        </a>
        {pendingCount > 0 && (
          <a
            href={`/app/trees/${treeId}/suggestions`}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-evergreen/60 bg-evergreen-mist px-2.5 text-xs font-medium text-evergreen-deep"
            title={`${pendingCount} suggestion${pendingCount === 1 ? "" : "s"} to review`}
          >
            Suggestions
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-evergreen px-1 text-[10px] font-semibold text-paper">
              {pendingCount}
            </span>
          </a>
        )}
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="flex h-8 items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-rosewood hover:text-rosewood"
        >
          Unpublish
        </button>
        {confirming && (
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            Take it private?
            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              className="rounded-lg border border-rosewood/60 px-2 py-1 font-medium text-rosewood transition-colors hover:bg-rosewood hover:text-paper"
            >
              {pending ? "Working…" : "Yes, unpublish"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-2 py-1 hover:text-ink"
            >
              Keep it public
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-gold hover:text-ink"
      >
        <span aria-hidden>🌍</span> Publish
      </button>
      {confirming && (
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          Share on /explore? Living relatives stay private; others can suggest
          edits.
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="rounded-lg border border-evergreen/60 bg-evergreen-mist px-2 py-1 font-medium text-evergreen-deep transition-colors hover:bg-evergreen hover:text-paper"
          >
            {pending ? "Publishing…" : "Yes, publish"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2 py-1 hover:text-ink"
          >
            Not now
          </button>
        </span>
      )}
    </div>
  );
}
