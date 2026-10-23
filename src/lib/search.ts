/**
 * Federated search + relationship-path helpers for the family tree.
 * Pure, testable, React-free. Used by TreeCanvas for dimming/highlighting
 * and by the relationship breadcrumb.
 */

export interface SearchablePerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  alsoKnownAs: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  birthDateText: string | null;
  deathDateText: string | null;
  labels?: { name: string }[];
  customFields?: { fieldName: string; value: string }[];
  // life-events (P1.2): optional, for place/date matching
  events?: { placeText: string | null; dateText: string | null; note: string | null; source: string | null; kind: string }[];
  living?: boolean;
  redacted?: boolean;
}

export interface SearchHit {
  id: string;
  score: number;
  matchedField: string;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function displayName(p: SearchablePerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unknown";
}

/**
 * Federated, scored search across person fields.
 * - Name/alsoKnownAs: highest weight
 * - Place/date: medium
 * - Labels/custom/event: lower but still match
 * Redacted (living on public) persons are skipped.
 */
export function searchPersons(
  query: string,
  persons: SearchablePerson[],
  opts?: { limit?: number }
): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const tokens = needle.split(/\s+/).filter(Boolean);
  const limit = opts?.limit ?? 8;
  const hits: SearchHit[] = [];

  for (const p of persons) {
    if (p.redacted) continue;
    let score = 0;
    let matchedField = "";
    const haystacks: [string, number, string][] = [
      [norm(displayName(p)), 100, "name"],
      [norm(p.alsoKnownAs), 90, "alsoKnownAs"],
      [norm(p.birthPlace), 40, "birthPlace"],
      [norm(p.deathPlace), 40, "deathPlace"],
      [norm(p.birthDateText), 30, "birthDate"],
      [norm(p.deathDateText), 30, "deathDate"],
    ];
    // labels
    for (const lb of p.labels ?? []) haystacks.push([norm(lb.name), 50, "label"]);
    for (const cf of p.customFields ?? []) {
      haystacks.push([norm(cf.fieldName), 30, "fieldName"]);
      haystacks.push([norm(cf.value), 35, "fieldValue"]);
    }
    for (const ev of p.events ?? []) {
      haystacks.push([norm(ev.placeText), 35, "eventPlace"]);
      haystacks.push([norm(ev.dateText), 25, "eventDate"]);
      haystacks.push([norm(ev.note), 20, "eventNote"]);
      haystacks.push([norm(ev.kind), 20, "eventKind"]);
    }

    const hayAll = haystacks.map((h) => h[0]).join(" \u0000 ");

    // token-level AND: all tokens must appear somewhere
    const allTokensMatch = tokens.every((t) => hayAll.includes(t));
    if (!allTokensMatch) continue;

    for (const [hay, weight, field] of haystacks) {
      if (!hay) continue;
      if (hay.includes(needle)) {
        // exact phrase bonus
        if (weight > score) {
          score = weight + 10;
          matchedField = field;
        }
      } else {
        for (const t of tokens) {
          if (hay.includes(t) && weight > score) {
            score = weight;
            matchedField = field;
          }
        }
      }
    }
    if (score > 0) hits.push({ id: p.id, score, matchedField });
  }

  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return hits.slice(0, limit);
}

export function matchesFilters(
  p: SearchablePerson,
  filters: { label?: string | null; fieldId?: string | null; fieldQuery?: string; fieldDefs?: { id: string; name: string }[] }
): boolean {
  if (filters.label) {
    if (filters.label === "__unlabeled") {
      if ((p.labels ?? []).length !== 0) return false;
    } else {
      const has = (p.labels ?? []).some((l) => l.name.toLowerCase() === filters.label!.toLowerCase());
      if (!has) return false;
    }
  }
  if (filters.fieldId) {
    const fieldName = filters.fieldDefs?.find((f) => f.id === filters.fieldId)?.name ?? "";
    const vals = p.customFields ?? [];
    const q = (filters.fieldQuery ?? "").trim().toLowerCase();
    if (q) {
      const match = vals.some(
        (v) =>
          (v.fieldName.toLowerCase() === fieldName.toLowerCase() || (v as unknown as { fieldId?: string }).fieldId === filters.fieldId) &&
          v.value.toLowerCase().includes(q)
      );
      if (!match) return false;
    } else {
      const hasField = vals.some(
        (v) => (v as unknown as { fieldId?: string }).fieldId === filters.fieldId || v.fieldName.toLowerCase() === fieldName.toLowerCase()
      );
      if (!hasField) return false;
    }
  }
  return true;
}

// -------- relationship path (BFS on DAG) --------

export interface GraphUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
}
export interface GraphLink {
  unionId: string;
  childId: string;
}
export interface RelStep {
  fromId: string;
  toId: string;
  relation: string; // e.g. "parent", "child", "spouse", "sibling-ish via"
  unionId?: string;
}
export interface RelPath {
  steps: RelStep[];
  ids: string[]; // ordered from `from` to `to`
}

/**
 * BFS shortest path between two persons over:
 *  - spouse edges (partnerA <-> partnerB via union)
 *  - parent -> child (via union children)
 *  - child -> parent (reverse)
 * Handles cycles (pedigree collapse) via visited set.
 */
export function findRelationshipPath(
  fromId: string,
  toId: string,
  unions: GraphUnion[],
  links: GraphLink[]
): RelPath | null {
  if (fromId === toId) return { steps: [], ids: [fromId] };
  if (!fromId || !toId) return null;

  const unionById = new Map(unions.map((u) => [u.id, u]));
  const childrenByUnion = new Map<string, string[]>();
  const unionsByPerson = new Map<string, string[]>();
  const parentUnionsByChild = new Map<string, string[]>();

  for (const u of unions) {
    for (const p of [u.partnerAId, u.partnerBId]) {
      if (!p) continue;
      const arr = unionsByPerson.get(p) ?? [];
      arr.push(u.id);
      unionsByPerson.set(p, arr);
    }
  }
  for (const l of links) {
    if (!unionById.has(l.unionId)) continue;
    const arr = childrenByUnion.get(l.unionId) ?? [];
    if (!arr.includes(l.childId)) arr.push(l.childId);
    childrenByUnion.set(l.unionId, arr);
    const pu = parentUnionsByChild.get(l.childId) ?? [];
    if (!pu.includes(l.unionId)) pu.push(l.unionId);
    parentUnionsByChild.set(l.childId, pu);
  }

  type Edge = { to: string; rel: string; unionId?: string };
  const neighbors = (id: string): Edge[] => {
    const out: Edge[] = [];
    // spouses
    for (const uid of unionsByPerson.get(id) ?? []) {
      const u = unionById.get(uid);
      if (!u) continue;
      const other = u.partnerAId === id ? u.partnerBId : u.partnerAId === id ? u.partnerAId : null;
      // partnerA <-> partnerB
      if (u.partnerAId === id && u.partnerBId) out.push({ to: u.partnerBId, rel: "spouse", unionId: uid });
      if (u.partnerBId === id) out.push({ to: u.partnerAId, rel: "spouse", unionId: uid });
    }
    // parent -> children
    for (const uid of unionsByPerson.get(id) ?? []) {
      for (const c of childrenByUnion.get(uid) ?? []) out.push({ to: c, rel: "child", unionId: uid });
    }
    // child -> parents
    for (const uid of parentUnionsByChild.get(id) ?? []) {
      const u = unionById.get(uid);
      if (!u) continue;
      for (const parent of [u.partnerAId, u.partnerBId]) {
        if (parent && parent !== id) out.push({ to: parent, rel: "parent", unionId: uid });
      }
    }
    return out;
  };

  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  const prev = new Map<string, { from: string; edge: Edge }>();

  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const e of neighbors(cur)) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      prev.set(e.to, { from: cur, edge: e });
      if (e.to === toId) {
        // reconstruct
        const steps: RelStep[] = [];
        const ids: string[] = [toId];
        let node = toId;
        while (node !== fromId) {
          const p = prev.get(node);
          if (!p) break;
          steps.unshift({ fromId: p.from, toId: node, relation: p.edge.rel, unionId: p.edge.unionId });
          ids.unshift(p.from);
          node = p.from;
        }
        return { steps, ids };
      }
      queue.push(e.to);
    }
  }
  return null;
}

function genderOf(persons: Map<string, SearchablePerson>, id: string): string | null {
  // gender not on SearchablePerson by default — use as tag if present
  const p = persons.get(id) as unknown as { gender?: string | null };
  return p?.gender ?? null;
}

function upDownLabel(steps: RelStep[], persons: Map<string, SearchablePerson>): string | null {
  // Single-step trivial cases
  if (steps.length === 1) {
    const r = steps[0].relation;
    if (r === "parent") return "parent";
    if (r === "child") return "child";
    if (r === "spouse") return "spouse / partner";
  }
  // Pure parental chain up: all steps are "parent" => ancestor
  const allParent = steps.every((s) => s.relation === "parent");
  const allChild = steps.every((s) => s.relation === "child");
  if (allParent) {
    const n = steps.length;
    if (n === 1) return "parent";
    if (n === 2) return "grandparent";
    return `${"great-".repeat(n - 2)}grandparent`;
  }
  if (allChild) {
    const n = steps.length;
    if (n === 1) return "child";
    if (n === 2) return "grandchild";
    return `${"great-".repeat(n - 2)}grandchild`;
  }
  // parent.. then child.. => aunt/uncle / cousin etc. Provide generic for now.
  return null;
}

/**
 * Human-readable label for a path, e.g. "paternal great-grandfather".
 * Uses gender if available. Falls back to breadcrumb + generic label.
 */
export function describeRelationship(
  fromId: string,
  toId: string,
  path: RelPath | null,
  personsById: Map<string, SearchablePerson>
): string {
  if (!path) return "No relationship found in this tree";
  if (path.ids.length === 1) return "Same person";
  const steps = path.steps;
  const candidate = upDownLabel(steps, personsById);
  if (candidate) {
    const target = personsById.get(toId);
    const name = target ? [target.firstName, target.lastName].filter(Boolean).join(" ") || "Unknown" : toId;
    return `${name} is ${fromId}'s ${candidate}`;
  }
  // Generic: breadcrumb + hop count
  const names = path.ids.map((id) => {
    const p = personsById.get(id);
    return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown" : id.slice(0, 6);
  });
  const rels = steps.map((s) => s.relation).join(" → ");
  return `${names.join(" → ")} (${rels})`;
}

export function breadcrumbNames(path: RelPath, personsById: Map<string, SearchablePerson>): string[] {
  return path.ids.map((id) => {
    const p = personsById.get(id);
    return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown" : id;
  });
}
