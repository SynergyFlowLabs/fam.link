"use client";

import { useEffect, useState } from "react";
import type { BranchCoverage, Insight } from "@/lib/analytics";

/**
 * Insights panel (issue #40) — local-only analytics, opt-in and
 * dismissible. Cards can be dismissed individually; "Don't show again"
 * parks the whole panel behind a one-click restore. Nothing nags.
 */

const STORAGE_KEY = "famlink:insights-hidden";
const CARD_KEY = "famlink:insights-dismissed";

export interface InsightsData {
  treeName: string;
  stats: { persons: number; memories: number; photos: number; voices: number };
  coverages: BranchCoverage[];
  insights: Insight[];
  unremembered: { count: number; names: string[] };
  roots: { count: number; names: string[] };
  childlessUnions: number;
}

const BRANCH_LABEL: Record<BranchCoverage["branch"], string> = {
  paternal: "Paternal side",
  maternal: "Maternal side",
  other: "Other family",
};

export function InsightsPanel({ data, treeId }: { data: InsightsData; treeId: string }) {
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    // localStorage reads must happen client-side only (SSR has no storage).
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(JSON.parse(window.localStorage.getItem(CARD_KEY) ?? "[]"));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(false);
    }
  }, []);

  const hidePanel = (v: boolean) => {
    setHidden(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {}
  };
  const dismissCard = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(CARD_KEY, JSON.stringify(next));
    } catch {}
  };

  if (hidden === null) return null; // localStorage not read yet

  if (hidden) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-ink-soft">
          Insights are turned off for this tree — nothing is computed or
          shown until you ask.
        </p>
        <button type="button" className="btn-secondary mt-4" onClick={() => hidePanel(false)}>
          Show insights
        </button>
      </div>
    );
  }

  const visibleInsights = data.insights.filter((i) => !dismissed.includes(i.id));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {data.treeName} — Insights
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Computed from your tree, on the server, just now. Nothing leaves
            fam.link — no ads, no data selling, no model training. Ever.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/app/trees/${treeId}`}
            className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen"
          >
            Back to tree
          </a>
          <button
            type="button"
            className="text-xs text-ink-soft underline-offset-2 hover:underline"
            onClick={() => hidePanel(true)}
          >
            Don&apos;t show again
          </button>
        </div>
      </div>

      {/* Coverage */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-ink">
          Story coverage
        </h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          {data.stats.persons} people · {data.stats.memories} memories (
          {data.stats.photos} photos, {data.stats.voices} voice) ·{" "}
          {data.stats.persons - data.unremembered.count} with at least one story
        </p>
        <ul className="mt-4 space-y-3">
          {data.coverages.map((c) => (
            <li key={c.branch}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">{BRANCH_LABEL[c.branch]}</span>
                <span className="text-ink-soft">
                  {c.withMemories}/{c.persons} people
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                <div
                  className={`h-full rounded-full ${c.branch === "paternal" ? "bg-[#2f5d50]" : c.branch === "maternal" ? "bg-[#b98a2f]" : "bg-[#8a9a95]"}`}
                  style={{ width: `${Math.round(c.coverage * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Gentle insights */}
      {visibleInsights.length > 0 ? (
        <section className="mt-6 space-y-3">
          {visibleInsights.map((i) => (
            <div
              key={i.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{i.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{i.detail}</p>
              </div>
              <button
                type="button"
                className="text-xs text-ink-soft/60 hover:text-ink"
                title="Dismiss this insight"
                onClick={() => dismissCard(i.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {/* Structure notes */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-medium text-ink">
            People without stories ({data.unremembered.count})
          </h2>
          {data.unremembered.count > 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {data.unremembered.names.join(", ")}
              {data.unremembered.count > data.unremembered.names.length
                ? ` and ${data.unremembered.count - data.unremembered.names.length} more`
                : ""}{" "}
              — a line or a voice clip would keep them close.
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">
              Everyone in the tree has at least one story. 🌿
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-sm font-medium text-ink">
            Tree structure notes
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {data.roots.count} root{data.roots.count === 1 ? "" : "s"}
            {data.roots.names.length
              ? ` (${data.roots.names.join(", ")})`
              : ""}{" "}
            · {data.childlessUnions} union{data.childlessUnions === 1 ? "" : "s"} without
            children linked — often a missing generation.
          </p>
        </div>
      </section>
    </div>
  );
}
