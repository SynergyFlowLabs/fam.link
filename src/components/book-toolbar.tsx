"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Family book toolbar (issue #39) — the owner's choices before the book
 * prints or exports: living relatives in (full), redacted, or out, and
 * the paper size. Download hits the PDF route with the same query.
 */
export function BookToolbar({
  treeId,
  living,
  paper,
}: {
  treeId: string;
  living: "include" | "omit" | "redact";
  paper: "a4" | "letter";
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const qs = (over?: { living?: string; paper?: string }) => {
    const p = new URLSearchParams({
      living: over?.living ?? living,
      paper: over?.paper ?? paper,
    });
    return p.toString();
  };

  const select =
    "input rounded-lg border border-line bg-card px-2 py-1.5 text-xs text-ink";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-3 py-2">
      <span className="text-[11px] text-ink-soft">Living relatives</span>
      <select
        className={select}
        value={living}
        onChange={(e) => {
          const v = e.target.value as typeof living;
          startTransition(() => {
            router.push(`/app/trees/${treeId}/book?${qs({ living: v })}`);
          });
        }}
      >
        <option value="redact">Redacted (structure only)</option>
        <option value="include">Included with details</option>
        <option value="omit">Left out</option>
      </select>
      <span className="text-[11px] text-ink-soft">Paper</span>
      <select
        className={select}
        value={paper}
        onChange={(e) => {
          const v = e.target.value as typeof paper;
          startTransition(() => {
            router.push(`/app/trees/${treeId}/book?${qs({ paper: v })}`);
          });
        }}
      >
        <option value="a4">A4</option>
        <option value="letter">Letter</option>
      </select>
      <a
        href={`/app/trees/${treeId}/export/book?${qs()}`}
        className="btn-primary !px-3 !py-1.5 text-xs"
      >
        ⬇ Download PDF
      </a>
      <button
        type="button"
        className="btn-secondary !px-3 !py-1.5 text-xs"
        onClick={() => window.print()}
      >
        🖨 Print this view
      </button>
    </div>
  );
}
