"use client";

import Link from "next/link";
import { deleteTreeAction, renameTreeAction } from "@/actions/trees";

export function TreeCard({
  id,
  name,
  people,
  updated,
}: {
  id: string;
  name: string;
  people: number;
  updated: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-line bg-card p-5 transition-colors hover:border-evergreen/60">
      <Link href={`/app/trees/${id}`} className="flex items-start gap-4">
        <span
          aria-hidden
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-evergreen-mist"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5.5 w-5.5 text-evergreen"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 21v-8" />
            <path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" />
            <path d="M12 13C12 9.5 9.5 7 6 7c0 3.5 2.5 6 6 6Z" />
          </svg>
        </span>
        <span className="block min-w-0">
          <span className="block truncate font-display text-lg font-semibold text-ink transition-colors group-hover:text-evergreen">
            {name}
          </span>
          <span className="mt-1 block text-sm text-ink-soft">
            {people} {people === 1 ? "person" : "people"}
          </span>
          <span className="mt-0.5 block text-xs text-ink-soft/80">
            Updated {updated}
          </span>
        </span>
      </Link>

      <details className="absolute right-3 top-3">
        <summary
          className="cursor-pointer list-none rounded-md px-2 py-1 text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label={`Tree options for ${name}`}
        >
          ⋯
        </summary>
        <div className="shadow-float absolute right-0 top-9 z-10 w-48 rounded-xl border border-line bg-card p-3">
          <form action={renameTreeAction} className="flex flex-col gap-2">
            <input type="hidden" name="treeId" value={id} />
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              defaultValue={name}
              aria-label="Rename tree"
              className="input py-1.5 text-sm"
            />
            <button
              type="submit"
              className="btn-secondary py-1.5 text-sm"
            >
              Rename
            </button>
          </form>
          <form
            action={deleteTreeAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  `Delete "${name}" and everyone in it? This cannot be undone.`,
                )
              )
                e.preventDefault();
            }}
            className="mt-2 border-t border-line pt-2"
          >
            <input type="hidden" name="treeId" value={id} />
            <button
              type="submit"
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-rosewood transition-colors hover:bg-rosewood-mist"
            >
              Delete tree…
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
