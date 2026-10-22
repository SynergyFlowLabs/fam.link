"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmGedcomImportAction,
  discardGedcomImportAction,
  stageGedcomImportAction,
} from "@/actions/import";
import { useToast } from "@/components/toaster";

/**
 * The upload half of the GEDCOM review workflow. Parsing happens on the
 * server; this form only sends the file and answers problems with a toast.
 */
export function GedcomUploadForm({ treeId }: { treeId: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form
      action={(fd: FormData) => {
        startTransition(async () => {
          try {
            const res = await stageGedcomImportAction(fd);
            if (res.ok) {
              toast.success("File read successfully", "Review what's inside below.");
              if (fileRef.current) fileRef.current.value = "";
              setFileName(null);
              router.refresh();
            } else {
              toast.error(res.error ?? "Couldn't read that file — try again.");
            }
          } catch {
            toast.error("Something went wrong — please try again.");
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="treeId" value={treeId} />
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-paper px-6 py-10 text-center transition-colors hover:border-evergreen hover:text-evergreen">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-evergreen"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M12 16V21" />
          <path d="M12 16c0-4.5 3-7.5 7.5-7.5 0 4.5-3 7.5-7.5 7.5Z" />
          <path d="M12 16C12 11.5 9 8.5 4.5 8.5c0 4.5 3 7.5 7.5 7.5Z" />
          <path d="M12 12V3" />
        </svg>
        <span className="font-display text-lg font-semibold text-ink">
          {fileName ?? "Choose a GEDCOM file"}
        </span>
        <span className="max-w-sm text-xs leading-relaxed text-ink-soft">
          Export a <code className="rounded bg-evergreen-mist px-1 text-evergreen">.ged</code> file
          from Ancestry, MyHeritage, FamilySearch, Gramps… We&apos;ll read it and show you
          exactly what&apos;s inside before anything is added. Nothing touches your tree until
          you say so.
        </span>
        <input
          ref={fileRef}
          name="file"
          type="file"
          accept=".ged,.gedcom,text/plain"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary self-start text-sm disabled:opacity-60"
      >
        {pending ? "Reading the file…" : "Read the file"}
      </button>
    </form>
  );
}

/** Confirm / discard controls for the review screen. */
export function GedcomReviewActions({
  treeId,
  importId,
  personCount,
}: {
  treeId: string;
  importId: string;
  personCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [discarding, startDiscarding] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const confirm = (fd: FormData) => {
    startTransition(async () => {
      try {
        const res = await confirmGedcomImportAction(fd);
        if (res.ok) {
          toast.success(
            `${res.added ?? personCount} ${res.added === 1 ? "person" : "people"} added to the tree`,
            "Use “center tree here” on anyone to re-root the canvas.",
          );
          router.push(`/app/trees/${treeId}`);
        } else {
          toast.error(res.error ?? "The import failed — please try again.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  };

  const discard = (fd: FormData) => {
    startDiscarding(async () => {
      try {
        const res = await discardGedcomImportAction(fd);
        if (res.ok) {
          toast.info("Import discarded", "Your tree is untouched.");
          router.refresh();
        } else {
          toast.error(res.error ?? "Couldn't discard — try again.");
        }
      } catch {
        toast.error("Something went wrong — please try again.");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={confirm}>
        <input type="hidden" name="treeId" value={treeId} />
        <input type="hidden" name="importId" value={importId} />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-sm disabled:opacity-60"
        >
          {pending
            ? "Adding to the tree…"
            : `Add ${personCount} ${personCount === 1 ? "person" : "people"} to this tree`}
        </button>
      </form>
      <form action={discard}>
        <input type="hidden" name="treeId" value={treeId} />
        <input type="hidden" name="importId" value={importId} />
        <button
          type="submit"
          disabled={discarding}
          className="btn-secondary text-sm disabled:opacity-60"
        >
          {discarding ? "Discarding…" : "Discard this import"}
        </button>
      </form>
    </div>
  );
}
