/**
 * Relationship graph analytics (issue #40) — pure, local-only insights.
 * Privacy is the design: every function takes plain rows and returns
 * plain facts; nothing here ever makes an outbound call, and the insights
 * panel is opt-in and dismissible. Dignity over engagement — we notice
 * gaps, we don't nag.
 */

export interface AnalyticsPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  living: boolean;
  gender: string | null;
  birthDateText: string | null;
}

export interface AnalyticsUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
}

export interface AnalyticsLink {
  unionId: string;
  childId: string;
}

export interface AnalyticsMemory {
  personId: string;
}

export interface AnalyticsInput {
  persons: AnalyticsPerson[];
  unions: AnalyticsUnion[];
  links: AnalyticsLink[];
  memories: AnalyticsMemory[];
  /** Branch membership (from classifyBranches). */
  paternal: string[];
  maternal: string[];
}

export interface BranchCoverage {
  branch: "paternal" | "maternal" | "other";
  persons: number;
  withMemories: number;
  coverage: number; // 0..1
}

export type Insight = {
  id: string;
  severity: "notice" | "hint";
  title: string;
  detail: string;
};

export function personName(p: AnalyticsPerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed";
}

/** Memory coverage per family branch. */
export function branchCoverage(input: AnalyticsInput): BranchCoverage[] {
  const remembered = new Set(input.memories.map((m) => m.personId));
  const branchOf = (id: string): BranchCoverage["branch"] =>
    input.paternal.includes(id) ? "paternal" : input.maternal.includes(id) ? "maternal" : "other";
  const buckets: Record<BranchCoverage["branch"], BranchCoverage> = {
    paternal: { branch: "paternal", persons: 0, withMemories: 0, coverage: 0 },
    maternal: { branch: "maternal", persons: 0, withMemories: 0, coverage: 0 },
    other: { branch: "other", persons: 0, withMemories: 0, coverage: 0 },
  };
  for (const p of input.persons) {
    const b = buckets[branchOf(p.id)];
    b.persons += 1;
    if (remembered.has(p.id)) b.withMemories += 1;
  }
  for (const b of Object.values(buckets)) {
    b.coverage = b.persons === 0 ? 0 : b.withMemories / b.persons;
  }
  return Object.values(buckets);
}

/** A branch with room for more stories — gentle, only when it's real. */
export function sparseBranchInsight(coverages: BranchCoverage[]): Insight | null {
  // "other" (married-ins, unclassified) isn't a side anyone can name — only
  // the paternal/maternal branches are candidates.
  const populated = coverages.filter(
    (c) => c.persons >= 4 && c.branch !== "other",
  );
  if (populated.length < 2) return null;
  const worst = [...populated].sort((a, b) => a.coverage - b.coverage)[0]!;
  const best = [...populated].sort((a, b) => b.coverage - a.coverage)[0]!;
  if (worst.coverage >= 0.5 || best.coverage < 0.5) return null;
  const label = worst.branch === "paternal" ? "the paternal side" : "the maternal side";
  return {
    id: `sparse-${worst.branch}`,
    severity: "hint",
    title: `${label} could use more stories`,
    detail: `${worst.withMemories} of ${worst.persons} people there have a memory yet.`,
  };
}

/** People no one has written a single memory for. */
export function unrememberedPeople(
  persons: AnalyticsPerson[],
  memories: AnalyticsMemory[],
  limit = 6,
): { count: number; names: string[] } {
  const remembered = new Set(memories.map((m) => m.personId));
  const quiet = persons.filter((p) => !remembered.has(p.id));
  return {
    count: quiet.length,
    names: quiet.slice(0, limit).map(personName),
  };
}

/** Persons with no parents in the tree (a root of their own line). */
export function rootPersons(
  persons: AnalyticsPerson[],
  links: AnalyticsLink[],
): AnalyticsPerson[] {
  const hasParents = new Set(links.map((l) => l.childId));
  return persons.filter((p) => !hasParents.has(p.id));
}

/** Unions that never had a child attached — possible missing links. */
export function childlessUnions(
  unions: AnalyticsUnion[],
  links: AnalyticsLink[],
): AnalyticsUnion[] {
  const withChild = new Set(links.map((l) => l.unionId));
  return unions.filter((u) => !withChild.has(u.id));
}

/** Parse a leading 4-digit year from fuzzy date text ("c. 1947", "Eid 1994"). */
export function parseYear(dateText: string | null | undefined): number | null {
  if (!dateText) return null;
  // Not part of a longer digit run — "12345" is not a year.
  const m = /(?<!\d)(\d{4})(?!\d)/.exec(dateText);
  if (!m) return null;
  const year = Number(m[1]);
  return year >= 1000 && year <= 2100 ? year : null;
}

/** Decades (start year) that have at least one recorded birth. */
export function birthDecades(persons: AnalyticsPerson[]): { start: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const p of persons) {
    const year = parseYear(p.birthDateText);
    if (year === null) continue;
    const start = Math.floor(year / 10) * 10;
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, count]) => ({ start, count }));
}

/** Multi-decade stretches with no recorded births between the first and last. */
export function generationGaps(persons: AnalyticsPerson[]): { from: number; to: number }[] {
  const decades = birthDecades(persons);
  if (decades.length < 2) return [];
  const covered = new Set(decades.map((d) => d.start));
  const first = decades[0]!.start;
  const last = decades[decades.length - 1]!.start;
  const gaps: { from: number; to: number }[] = [];
  let run: number[] = [];
  for (let start = first; start <= last; start += 10) {
    if (!covered.has(start)) {
      run.push(start);
    } else if (run.length > 0) {
      gaps.push({ from: run[0]!, to: run[run.length - 1]! + 9 });
      run = [];
    }
  }
  if (run.length > 0) gaps.push({ from: run[0]!, to: run[run.length - 1]! + 9 });
  return gaps;
}

/** Assemble the panel's insights — empty when there's nothing honest to say. */
export function computeInsights(input: AnalyticsInput): {
  coverages: BranchCoverage[];
  insights: Insight[];
  unremembered: { count: number; names: string[] };
  gaps: { from: number; to: number }[];
} {
  const coverages = branchCoverage(input);
  const insights: Insight[] = [];
  const sparse = sparseBranchInsight(coverages);
  if (sparse) insights.push(sparse);
  for (const gap of generationGaps(input.persons)) {
    insights.push({
      id: `gap-${gap.from}`,
      severity: "hint",
      title: `No births recorded ${gap.from}–${gap.to}`,
      detail: "Either the family was between generations here, or someone is missing from the tree.",
    });
  }
  return {
    coverages,
    insights,
    unremembered: unrememberedPeople(input.persons, input.memories),
    gaps: generationGaps(input.persons),
  };
}
