"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/voice-media";

/**
 * Narrative walkthrough (issue #38) — one full-bleed slide per person
 * along an ancestor/descendant line: photo, life line, top memories, and
 * a "Next: name (relation)" step. Arrow keys navigate, Enter opens the
 * profile, Escape exits. MindMeister's presentation mode, for lineages.
 */
export interface WalkSlide {
  person: {
    id: string;
    name: string;
    living: boolean;
    lifeLine: string;
    photoMediaId: string | null;
  };
  memories: { id: string; body: string; kind: string; mediaId: string | null; authorName: string | null; durationSeconds: number | null }[];
  nextName: string | null;
  nextRelation: string | null;
  nextHref: string | null;
}

export function WalkthroughClient({
  treeId,
  treeName,
  direction,
  slides,
  readOnly,
  backHref,
}: {
  treeId: string;
  treeName: string;
  direction: "ancestors" | "descendants";
  slides: WalkSlide[];
  readOnly?: boolean;
  backHref?: string | null;
}) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const exitHref = backHref ?? `/app/trees/${treeId}`;
  const router = useRouter();
  const go = (href: string) => {
    if (readOnly && href.startsWith("/app/")) return;
    router.push(href);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setI((v) => Math.min(v + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setI((v) => Math.max(v - 1, 0));
      } else if (e.key === "Enter") {
        const p = slides[i]?.person;
        if (p && !readOnly) go(`/app/trees/${treeId}/person/${p.id}`);
      } else if (e.key === "Escape") {
        go(exitHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, slides, slides.length, treeId, exitHref, readOnly]);

  if (slides.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {treeName} — Walkthrough
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Nothing to walk through yet — the {direction} line from the focus
          person is empty (or private).
        </p>
        <a href={exitHref} className="btn-secondary mt-4 inline-flex">
          Back to the tree
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div>
          <h1 className="font-display text-sm font-semibold text-ink">
            {treeName} — {direction === "ancestors" ? "Ancestor" : "Descendant"} walkthrough
          </h1>
          <p className="text-[11px] text-ink-soft">
            ← → to move · Enter opens the profile · Esc exits
          </p>
        </div>
        <a
          href={exitHref}
          className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen"
        >
          Exit
        </a>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">
          <p className="text-[11px] uppercase tracking-wide text-ink-soft">
            Slide {i + 1} of {slides.length}
            {i > 0 ? ` · ${slides.length - i - 1} step${slides.length - i - 1 === 1 ? "" : "s"} back` : ""}
          </p>
          <div className="mt-3 flex items-start gap-5">
            {slide.person.photoMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${slide.person.photoMediaId}`}
                alt={slide.person.name}
                className="h-24 w-24 rounded-2xl border border-line object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-24 w-24 items-center justify-center rounded-2xl bg-rosewood-mist font-display text-3xl text-rosewood"
              >
                {slide.person.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-3xl font-semibold text-ink">
                {slide.person.name}
                {slide.person.living ? null : " ✝"}
              </h2>
              {slide.person.lifeLine ? (
                <p className="mt-1 text-sm text-ink-soft">{slide.person.lifeLine}</p>
              ) : null}
            </div>
          </div>

          {slide.memories.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {slide.memories.map((m) => (
                <li key={m.id} className="rounded-xl border border-line/70 bg-card px-4 py-3">
                  {m.kind === "voice" && m.mediaId ? (
                    <audio controls preload="none" src={`/api/media/${m.mediaId}`} className="mb-2 w-full" />
                  ) : null}
                  {m.kind === "photo" && m.mediaId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${m.mediaId}`}
                      alt={m.body || "Memory photo"}
                      className="mb-2 max-h-48 w-auto rounded-lg border border-line"
                    />
                  ) : null}
                  <p className="text-sm leading-relaxed text-ink">{m.body || "🎙 Voice memory"}</p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {m.authorName ? `remembered by ${m.authorName}` : ""}
                    {m.durationSeconds ? ` · ${formatDuration(m.durationSeconds)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-line bg-card/60 px-4 py-3 text-xs text-ink-soft">
              No memories on this person yet — the walkthrough grows as the
              family does.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <button
          type="button"
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-ink-soft disabled:opacity-40"
          onClick={() => setI((v) => Math.max(v - 1, 0))}
          disabled={i === 0}
        >
          ← Back
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
          {slides.map((s, idx) => (
            <button
              key={s.person.id}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`Slide ${idx + 1}: ${s.person.name}`}
              className={`h-2 w-2 rounded-full transition-colors ${idx === i ? "bg-evergreen" : "bg-line hover:bg-ink-soft/50"}`}
              onClick={() => setI(idx)}
            />
          ))}
        </div>
        {slide.nextName ? (
          <button
            type="button"
            className="rounded-lg bg-evergreen px-3 py-1.5 text-xs font-medium text-paper hover:bg-evergreen-deep"
            onClick={() => setI((v) => Math.min(v + 1, slides.length - 1))}
            disabled={i === slides.length - 1}
          >
            Next: {slide.nextName}
            {slide.nextRelation ? ` (${slide.nextRelation})` : ""} →
          </button>
        ) : (
          <a
            href={exitHref}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen"
          >
            That&apos;s the whole line — back to the tree
          </a>
        )}
      </div>
    </div>
  );
}
