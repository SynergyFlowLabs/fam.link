/**
 * fam.link timeline — pure feed aggregation, fuzzy-date sorting, branch buckets.
 *
 * Turns memories + person_events into a single chronological scroll.
 * Privacy: living persons filtered out by caller for share views.
 */

import { extractYear as baseExtractYear } from "./person-events.ts";
import { getBranchPersonIds } from "./branch-scope.ts";

export type TimelineKind = "memory" | "event";

export interface TimelinePersonRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
  living: boolean;
  birthDateText?: string | null;
  branchLabel?: string | null;
}

export interface MemoryInput {
  id: string;
  personId: string;
  body: string;
  occurredText: string | null;
  authorName: string | null;
  kind?: string | null;
  createdAt: Date | string | number | null;
  mediaId?: string | null;
}

export interface EventInput {
  id: string;
  personId: string;
  kind: string;
  dateText: string | null;
  placeText: string | null;
  note: string | null;
  source: string | null;
  createdAt: Date | string | number | null;
}

export interface TimelineEntry {
  id: string; // "memory:<id>" or "event:<id>"
  sourceId: string;
  personId: string;
  kind: TimelineKind;
  eventKind?: string; // for events: birth/death/etc
  title: string; // display title: event kind or memory snippet
  body: string; // full text: memory body or note
  dateText: string | null;
  placeText: string | null;
  authorOrSource: string | null;
  year: number | null;
  decade: string;
  createdAtMs: number;
}

// Historical phrases without explicit year
const HISTORICAL_YEARS: Record<string, number> = {
  partition: 1947,
  independence: 1947,
  "1947 partition": 1947,
  "1971 war": 1971,
  "bangladesh liberation": 1971,
};

export function extractYearEnhanced(dateText: string | null | undefined): number | null {
  if (!dateText) return null;
  const base = baseExtractYear(dateText);
  if (base !== null) {
    // handle "before 1947" -> 1946, "after 1947" -> 1948
    const low = dateText.toLowerCase();
    if (/\bbefore\b/.test(low)) return base - 1;
    if (/\bafter\b/.test(low)) return base + 1;
    return base;
  }
  const low = dateText.trim().toLowerCase();
  for (const [phrase, year] of Object.entries(HISTORICAL_YEARS)) {
    if (low.includes(phrase)) {
      if (/\bbefore\b/.test(low)) return year - 1;
      if (/\bafter\b/.test(low)) return year + 1;
      return year;
    }
  }
  return null;
}

export function decadeOf(year: number | null): string {
  if (year === null) return "Unknown";
  const d = Math.floor(year / 10) * 10;
  return `${d}s`;
}

const EVENT_KIND_ORDER: Record<string, number> = {
  birth: 0,
  marriage: 1,
  relocation: 2,
  divorce: 3,
  death: 4,
  custom: 5,
  memory: 6,
};

function eventWeight(e: TimelineEntry): number {
  if (e.kind === "event" && e.eventKind) return EVENT_KIND_ORDER[e.eventKind] ?? 99;
  return EVENT_KIND_ORDER.memory;
}

export function compareTimeline(a: TimelineEntry, b: TimelineEntry): number {
  if (a.year !== null && b.year !== null && a.year !== b.year) return a.year - b.year;
  if (a.year !== null && b.year === null) return -1;
  if (a.year === null && b.year !== null) return 1;
  const wa = eventWeight(a);
  const wb = eventWeight(b);
  if (wa !== wb) return wa - wb;
  return a.createdAtMs - b.createdAtMs;
}

export function buildTimelineEntries(
  memories: MemoryInput[],
  events: EventInput[],
  personsById: Map<string, TimelinePersonRef>,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const m of memories) {
    // Skip orphans (person outside the visible set, e.g. branch-scoped)
    if (!personsById.has(m.personId)) continue;
    const year = extractYearEnhanced(m.occurredText);
    const title = m.kind === "photo" ? "Photo memory" : m.kind === "voice" ? "Voice memory" : "Memory";
    entries.push({
      id: `memory:${m.id}`,
      sourceId: m.id,
      personId: m.personId,
      kind: "memory",
      title,
      body: m.body,
      dateText: m.occurredText,
      placeText: null,
      authorOrSource: m.authorName,
      year,
      decade: decadeOf(year),
      createdAtMs: m.createdAt ? new Date(m.createdAt).getTime() : 0,
    });
  }
  for (const e of events) {
    if (!personsById.has(e.personId)) continue;
    const year = extractYearEnhanced(e.dateText);
    entries.push({
      id: `event:${e.id}`,
      sourceId: e.id,
      personId: e.personId,
      kind: "event",
      eventKind: e.kind,
      title: e.kind.charAt(0).toUpperCase() + e.kind.slice(1),
      body: e.note ?? "",
      dateText: e.dateText,
      placeText: e.placeText,
      authorOrSource: e.source,
      year,
      decade: decadeOf(year),
      createdAtMs: e.createdAt ? new Date(e.createdAt).getTime() : 0,
    });
  }
  entries.sort(compareTimeline);
  return entries;
}

export function filterByLiving(entries: TimelineEntry[], personsById: Map<string, TimelinePersonRef>, hideLiving: boolean): TimelineEntry[] {
  if (!hideLiving) return entries;
  return entries.filter((e) => {
    const p = personsById.get(e.personId);
    if (!p) return true;
    return !p.living;
  });
}

// Branch classification
export function classifyBranches(
  persons: { id: string; gender?: string | null }[],
  unions: { id: string; partnerAId: string; partnerBId: string | null }[],
  links: { unionId: string; childId: string }[],
  focusPersonId: string,
): { paternal: Set<string>; maternal: Set<string>; focusSet: Set<string> } {
  const parentUnionsByChild = new Map<string, string[]>();
  for (const l of links) {
    const arr = parentUnionsByChild.get(l.childId) ?? [];
    if (!arr.includes(l.unionId)) arr.push(l.unionId);
    parentUnionsByChild.set(l.childId, arr);
  }
  const partnerOf = (uid: string) => {
    const u = unions.find((x) => x.id === uid);
    return u ? ([u.partnerAId, u.partnerBId].filter(Boolean) as string[]) : [];
  };
  const focusParentUnionIds = parentUnionsByChild.get(focusPersonId) ?? [];
  const parents: string[] = [];
  for (const pu of focusParentUnionIds) parents.push(...partnerOf(pu));
  const uniqueParents = [...new Set(parents)];
  if (uniqueParents.length === 0) return { paternal: new Set(), maternal: new Set(), focusSet: new Set([focusPersonId]) };
  const genderOf = (id: string) => persons.find((p) => p.id === id)?.gender ?? null;
  let paternalId: string | null = null;
  let maternalId: string | null = null;
  if (uniqueParents.length === 1) {
    paternalId = uniqueParents[0];
  } else if (uniqueParents.length >= 2) {
    for (const pid of uniqueParents) {
      const g = genderOf(pid);
      if (g === "m" && !paternalId) paternalId = pid;
      else if (g === "f" && !maternalId) maternalId = pid;
    }
    if (!paternalId) paternalId = uniqueParents[0];
    if (!maternalId) maternalId = uniqueParents[1] ?? null;
    if (paternalId === maternalId) maternalId = uniqueParents[1] ?? null;
  }
  const paternal = paternalId ? getBranchPersonIds(paternalId, persons, unions, links) ?? new Set<string>() : new Set<string>();
  const maternal = maternalId ? getBranchPersonIds(maternalId, persons, unions, links) ?? new Set<string>() : new Set<string>();
  return { paternal, maternal, focusSet: new Set([focusPersonId]) };
}

export function hotspotCounts(
  entries: TimelineEntry[],
  branchSets: { paternal: Set<string>; maternal: Set<string> },
): { paternal: number; maternal: number; other: number; total: number } {
  let paternal = 0;
  let maternal = 0;
  let other = 0;
  for (const e of entries) {
    if (branchSets.paternal.has(e.personId)) paternal++;
    else if (branchSets.maternal.has(e.personId)) maternal++;
    else other++;
  }
  return { paternal, maternal, other, total: entries.length };
}

export function decadesInEntries(entries: TimelineEntry[]): string[] {
  const s = new Set(entries.map((e) => e.decade));
  // sort: numeric decades first ascending, Unknown last
  const arr = [...s];
  arr.sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return parseInt(a) - parseInt(b);
  });
  return arr;
}
