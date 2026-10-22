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
    <div className="group relative rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-evergreen/50">
      <Link href={`/app/trees/${id}`} className="block">
        <h2 className="font-display text-lg font-semibold text-ink group-hover:text-evergreen">
          {name}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {people} {people === 1 ? "person" : "people"}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft/80">Updated {updated}</p>
      </Link>

      <details className="absolute right-3 top-3">
        <summary
          className="cursor-pointer list-none rounded-md px-2 py-1 text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label={`Tree options for ${name}`}
        >
          ⋯
        </summary>
        <div className="absolute right-0 top-9 z-10 w-48 rounded-xl border border-line bg-white p-3 shadow-sm">
          <form action={renameTreeAction} className="flex flex-col gap-2">
            <input type="hidden" name="treeId" value={id} />
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              defaultValue={name}
              aria-label="Rename tree"
              className="rounded-md border border-line px-2.5 py-1.5 text-sm focus:border-evergreen focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-line px-2.5 py-1.5 text-sm text-ink transition-colors hover:border-evergreen hover:text-evergreen"
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
              className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-rosewood transition-colors hover:bg-rosewood-mist"
            >
              Delete tree…
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
