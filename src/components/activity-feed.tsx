"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { undoActivityAction } from "@/actions/activity";
import { useToast } from "@/components/toaster";

/** "Undo" on a feed entry — the server re-checks the grace window. */
export function UndoButton({ treeId, activityId }: { treeId: string; activityId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const fd = new FormData();
        fd.set("treeId", treeId);
        fd.set("activityId", activityId);
        startTransition(async () => {
          const res = await undoActivityAction(fd);
          if (res.ok) {
            toast.success(res.message ?? "Undone.");
            router.refresh();
          } else {
            toast.error(res.error ?? "Couldn't undo that change.");
          }
        });
      }}
      className="flex h-7 items-center rounded-full border border-evergreen/50 bg-evergreen-mist px-2.5 text-[11px] font-medium text-evergreen-deep transition-colors hover:bg-evergreen hover:text-paper disabled:opacity-60"
      aria-label="Undo this change"
    >
      {pending ? "Undoing…" : "Undo"}
    </button>
  );
}
