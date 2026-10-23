"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { displayName, lifeLine } from "@/lib/canvas-types";
import { labelColorFor } from "@/lib/labels";
import { type TimelineEntry, decadesInEntries } from "@/lib/timeline";

interface PersonLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  living: boolean;
  birthDateText: string | null;
  deathDateText: string | null;
}

interface Props {
  treeId: string;
  treeName: string;
  persons: PersonLite[];
  entries: TimelineEntry[];
  paternal: string[];
  maternal: string[];
  readOnly?: boolean;
  shareNote?: string | null;
  /** Where "Back to tree" points — share views pass their own canvas URL. */
  backHref?: string | null;
}

function branchOf(personId: string, paternal: Set<string>, maternal: Set<string>): "paternal" | "maternal" | "other" {
  if (paternal.has(personId)) return "paternal";
  if (maternal.has(personId)) return "maternal";
  return "other";
}

export function TimelineClient({ treeId, treeName, persons, entries, paternal, maternal, readOnly, shareNote, backHref }: Props) {
  const paternalSet = useMemo(() => new Set(paternal), [paternal]);
  const maternalSet = useMemo(() => new Set(maternal), [maternal]);
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const searchParams = useSearchParams();

  const [branchFilter, setBranchFilter] = useState<Set<string>>(() => {
    const b = searchParams.get("branch");
    return b ? new Set(b.split(",")) : new Set();
  });
  const [decadeFilter, setDecadeFilter] = useState<Set<string>>(() => {
    const d = searchParams.get("decade");
    return d ? new Set(d.split(",")) : new Set();
  });
  const [personFilter, setPersonFilter] = useState<Set<string>>(() => {
    const p = searchParams.get("person");
    return p ? new Set(p.split(",")) : new Set();
  });
  const [decadeOpen, setDecadeOpen] = useState(false);

  // Reflect filter state into the URL (no reload) so scoped timelines are shareable.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (branchFilter.size) params.set("branch", [...branchFilter].join(","));
      else params.delete("branch");
      if (decadeFilter.size) params.set("decade", [...decadeFilter].join(","));
      else params.delete("decade");
      if (personFilter.size) params.set("person", [...personFilter].join(","));
      else params.delete("person");
      const qs = params.toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    } catch {}
  }, [branchFilter, decadeFilter, personFilter]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (branchFilter.size) {
        const br = branchOf(e.personId, paternalSet, maternalSet);
        if (!branchFilter.has(br)) return false;
      }
      if (decadeFilter.size && !decadeFilter.has(e.decade)) return false;
      if (personFilter.size && !personFilter.has(e.personId)) return false;
      return true;
    });
  }, [entries, branchFilter, decadeFilter, personFilter, paternalSet, maternalSet]);

  const grouped = useMemo(() => {
    const m = new Map<string, TimelineEntry[]>();
    for (const e of filtered) {
      const arr = m.get(e.decade) ?? [];
      arr.push(e);
      m.set(e.decade, arr);
    }
    // keep decade order as in decadesInEntries
    const order = decadesInEntries(filtered);
    return order.map((dec) => ({ decade: dec, entries: m.get(dec) ?? [] }));
  }, [filtered]);

  const hotspot = useMemo(() => {
    let paternalC = 0,
      maternalC = 0,
      otherC = 0;
    for (const e of entries) {
      const br = branchOf(e.personId, paternalSet, maternalSet);
      if (br === "paternal") paternalC++;
      else if (br === "maternal") maternalC++;
      else otherC++;
    }
    return { paternal: paternalC, maternal: maternalC, other: otherC, total: entries.length };
  }, [entries, paternalSet, maternalSet]);

  const decades = useMemo(() => decadesInEntries(entries), [entries]);
  const hasFilters = branchFilter.size > 0 || decadeFilter.size > 0 || personFilter.size > 0;

  if (entries.length === 0) {
    const samplePerson = persons.find((p) => !p.living) ?? persons[0];
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-2xl font-semibold text-ink">{treeName} — Timeline</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-card/60 p-8 text-center">
          <p className="text-sm text-ink-soft">Your timeline is just beginning — add a memory for {samplePerson ? displayName(samplePerson) : "your family"}.</p>
          {samplePerson && !readOnly && (
            <a href={`/app/trees/${treeId}/person/${samplePerson.id}`} className="btn-primary mt-4 inline-flex">Add a memory</a>
          )}
          {readOnly && <p className="mt-3 text-xs text-ink-soft/70">{shareNote ?? "Living relatives are kept private."}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2.5">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">{treeName} — Timeline</h1>
          <p className="text-xs text-ink-soft">{filtered.length} of {entries.length} entries · {grouped.length} decades · hotspot: paternal {hotspot.paternal} / maternal {hotspot.maternal} / other {hotspot.other}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={(backHref ?? `/app/trees/${treeId}`) + "/map"} className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen">Map</a>
          <a href={backHref ?? `/app/trees/${treeId}`} className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen">Back to tree</a>
          {hasFilters && <button onClick={() => { setBranchFilter(new Set()); setDecadeFilter(new Set()); setPersonFilter(new Set()); }} className="text-xs text-ink-soft hover:text-evergreen">Clear</button>}
        </div>
      </div>

      {/* Hotspot heatmap */}
      <div className="border-b border-line bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium text-ink">Memory hotspot</span>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: labelColorFor("paternal") }} aria-hidden />
            <span className="text-ink-soft">Paternal {hotspot.paternal}</span>
            <div className="h-1.5 w-16 rounded-full bg-line"><div className="h-1.5 rounded-full bg-evergreen" style={{ width: `${hotspot.total ? (hotspot.paternal / hotspot.total) * 100 : 0}%` }} /></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: labelColorFor("maternal", "#b98a2f") }} aria-hidden />
            <span className="text-ink-soft">Maternal {hotspot.maternal}</span>
            <div className="h-1.5 w-16 rounded-full bg-line"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${hotspot.total ? (hotspot.maternal / hotspot.total) * 100 : 0}%` }} /></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ink-soft" aria-hidden />
            <span className="text-ink-soft">Other {hotspot.other}</span>
          </div>
          {hotspot.paternal < 2 || hotspot.maternal < 2 ? <span className="text-[11px] text-rosewood">Thin branch — add memories to keep it alive.</span> : null}
        </div>
      </div>

      {/* Filters bar — matches canvas filter bar design */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
        <div className="flex items-center gap-1">
          {(["paternal", "maternal", "other"] as const).map((br) => {
            const active = branchFilter.has(br);
            return (
              <button key={br} onClick={() => setBranchFilter((prev) => { const n = new Set(prev); if (n.has(br)) n.delete(br); else n.add(br); return n; })} className={`h-8 rounded-lg border px-3 text-xs capitalize ${active ? "border-evergreen bg-evergreen-mist text-evergreen-deep" : "border-line bg-card text-ink-soft hover:border-evergreen hover:text-evergreen"}`}>{br}</button>
            );
          })}
        </div>

        <div className="relative">
          <button onClick={() => setDecadeOpen((v) => !v)} className="flex h-8 items-center gap-1 rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen">
            Decade {decadeFilter.size ? `· ${decadeFilter.size} selected` : ""}
            <span className="text-[10px]">▾</span>
          </button>
          {decadeOpen && (
            <div className="absolute left-0 top-9 z-20 w-44 rounded-xl border border-line bg-card p-2 shadow-float">
              {decades.map((d) => {
                const active = decadeFilter.has(d);
                return (
                  <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-evergreen-mist">
                    <input type="checkbox" checked={active} onChange={() => setDecadeFilter((prev) => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n; })} className="accent-evergreen" />
                    <span className={active ? "text-evergreen-deep font-medium" : "text-ink-soft"}>{d}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <select value={[...personFilter][0] ?? ""} onChange={(e) => setPersonFilter(e.target.value ? new Set([e.target.value]) : new Set())} className="h-8 min-w-32 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-evergreen focus:outline-none">
          <option value="">All people</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>{displayName(p)}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-ink-soft">{filtered.length} shown</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-paper" tabIndex={0} aria-label="Family timeline">
        <ol role="list" className="mx-auto max-w-3xl px-4 py-6">
          {grouped.map(({ decade, entries: decEntries }) => (
            <li key={decade} role="listitem" className="relative pl-8">
              <div className="sticky top-0 z-10 -ml-8 flex items-center gap-2 bg-paper py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-evergreen" aria-hidden />
                <h2 className="font-display text-sm font-semibold tracking-wide text-evergreen">{decade}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-ink-soft">{decEntries.length} entries</span>
              </div>
              <div className="absolute left-[5px] top-6 bottom-0 w-px bg-line" aria-hidden />
              <ul className="space-y-3 py-2">
                {decEntries.map((e) => {
                  const person = personById.get(e.personId);
                  const br = branchOf(e.personId, paternalSet, maternalSet);
                  const branchColor = br === "paternal" ? labelColorFor("paternal") : br === "maternal" ? labelColorFor("maternal", "#b98a2f") : "#8a9a95";
                  return (
                    <li key={e.id} className="shadow-float relative rounded-2xl border border-line bg-card p-4 focus-within:ring-2 focus-within:ring-evergreen/30" tabIndex={0}>
                      <div className="absolute left-[-22px] top-5 h-3 w-3 rounded-full border-2 border-paper bg-gold" style={{ borderColor: "var(--color-paper)", background: e.kind === "event" ? "var(--color-rosewood)" : branchColor }} aria-hidden />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{person ? displayName(person) : "Unknown"} <span className="font-normal text-ink-soft">— {e.title}</span> {e.eventKind && <span className="ml-1 rounded-full bg-evergreen-mist px-1.5 py-0.5 text-[10px] font-medium text-evergreen-deep">{e.eventKind}</span>}</p>
                          {person && <p className="text-xs text-ink-soft">{lifeLine(person)} {br !== "other" && <span className="ml-1 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: branchColor }} />{br}</span>}</p>}
                        </div>
                        {e.dateText && <span className="shrink-0 rounded-full bg-evergreen-mist px-2 py-1 text-xs font-medium text-evergreen-deep">{e.dateText}</span>}
                      </div>
                      {e.placeText && <p className="mt-1 text-xs text-ink-soft">📍 {e.placeText}</p>}
                      {e.body && <p className="mt-2 text-sm leading-relaxed text-ink">{e.body}</p>}
                      {e.authorOrSource && <p className="mt-2 text-xs text-ink-soft">— {e.authorOrSource}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <a href={readOnly ? undefined : `/app/trees/${treeId}/person/${e.personId}`} className={readOnly ? "pointer-events-none text-ink-soft" : "text-evergreen hover:underline"}>View {person ? displayName(person) : "person"}</a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="rounded-2xl border border-dashed border-line bg-card/60 p-6 text-center text-sm text-ink-soft">No entries match those filters — try clearing.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
