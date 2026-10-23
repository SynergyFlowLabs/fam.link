/**
 * fam.link — branch collapse store (pure, deterministic).
 *
 * Collapsing a person hides its descendant branch (children + spouses of
 * descendants, deduped via DAG) while keeping the collapsed person itself
 * visible. Multiple collapses are unioned. Generation stats update from the
 * visible set.
 *
 * Virtualization helpers are also pure (viewport culling).
 */

export interface CollapseGraph {
  unionsByPerson: Map<string, string[]>;
  childrenByUnion: Map<string, string[]>;
  partnerOf: (unionId: string) => string[];
}

export function buildCollapseGraph(input: {
  unions: { id: string; partnerAId: string; partnerBId: string | null }[];
  links: { unionId: string; childId: string }[];
}): CollapseGraph {
  const unionsByPerson = new Map<string, string[]>();
  const childrenByUnion = new Map<string, string[]>();
  const unionById = new Map<string, { partnerAId: string; partnerBId: string | null }>();
  for (const u of input.unions) {
    unionById.set(u.id, u);
    for (const p of [u.partnerAId, u.partnerBId]) {
      if (!p) continue;
      const list = unionsByPerson.get(p) ?? [];
      list.push(u.id);
      unionsByPerson.set(p, list);
    }
  }
  for (const l of input.links) {
    const list = childrenByUnion.get(l.unionId) ?? [];
    if (!list.includes(l.childId)) list.push(l.childId);
    childrenByUnion.set(l.unionId, list);
  }
  const partnerOf = (unionId: string): string[] => {
    const u = unionById.get(unionId);
    if (!u) return [];
    return u.partnerBId ? [u.partnerAId, u.partnerBId] : [u.partnerAId];
  };
  return { unionsByPerson, childrenByUnion, partnerOf };
}

/**
 * Descendant branch of rootId: all persons reachable downstream via
 * children edges, including spouses of descendants (counted, but not expanded
 * beyond their own marital children). Deduped via DAG visited set.
 * Root itself is NOT included — it stays visible when collapsed.
 */
export function getDescendantBranchIds(
  rootId: string,
  graph: CollapseGraph,
): Set<string> {
  const visited = new Set<string>([rootId]);
  const branch = new Set<string>();
  const queue: string[] = [];

  // seed with direct children of root
  for (const uid of graph.unionsByPerson.get(rootId) ?? []) {
    for (const child of graph.childrenByUnion.get(uid) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        branch.add(child);
        queue.push(child);
      }
    }
    // also include root's spouses that are only relevant as part of branch?
    // No — root's spouses are not descendants; they are siblings/couple at same level, keep visible.
  }

  while (queue.length > 0) {
    const cur = queue.shift() as string;
    // spouses of cur: persons who share a union with cur (same generation) — count them as part of branch
    for (const uid of graph.unionsByPerson.get(cur) ?? []) {
      for (const partner of graph.partnerOf(uid)) {
        if (partner !== cur && !visited.has(partner)) {
          // Only include spouse if that spouse is not already an ancestor of cur
          // For descendant branch, we want spouses of descendants included, but not their ancestors.
          // We treat spouse as leaf (don't expand from spouse beyond shared children, which are already via cur's unions).
          visited.add(partner);
          branch.add(partner);
          // Do NOT push spouse onto queue to avoid pulling in spouse's parents or prior children.
        }
      }
    }
    // children of cur
    for (const uid of graph.unionsByPerson.get(cur) ?? []) {
      for (const child of graph.childrenByUnion.get(uid) ?? []) {
        if (!visited.has(child)) {
          visited.add(child);
          branch.add(child);
          queue.push(child);
        }
      }
    }
  }
  return branch;
}

/** Count for chip: size of descendant branch (persons + spouses, deduped). */
export function branchCount(rootId: string, graph: CollapseGraph): number {
  return getDescendantBranchIds(rootId, graph).size;
}

/**
 * Visible set after applying collapsedIds. Each collapse removes its branch.
 * Overlaps are naturally deduped (union of removals).
 */
export function getVisibleIds(
  allIds: string[],
  collapsedIds: Set<string>,
  graph: CollapseGraph,
): Set<string> {
  const visible = new Set(allIds);
  for (const collapsedId of collapsedIds) {
    if (!visible.has(collapsedId)) continue; // already hidden by ancestor collapse
    const branch = getDescendantBranchIds(collapsedId, graph);
    for (const id of branch) visible.delete(id);
  }
  return visible;
}

/** For keyboard '*': expand all siblings at same generation level as focused person. */
export function siblingsOf(
  personId: string,
  graph: CollapseGraph,
  parentChild: Map<string, string[]>, // parentUnion -> children, but we need parent search
  // We'll derive siblings via shared parent union
): string[] {
  // To find siblings, find parent unions of personId, then all children of those unions except self
  // Need parentUnionsByChild map
  return [];
}

/** Viewport culling: check if node center is within viewport + buffer. */
export function isInViewport(
  node: { x: number; y: number },
  view: { x: number; y: number; w: number; h: number },
  buffer = 200,
): boolean {
  return (
    node.x >= view.x - buffer &&
    node.x <= view.x + view.w + buffer &&
    node.y >= view.y - buffer &&
    node.y <= view.y + view.h + buffer
  );
}

/** For search auto-expand: find collapsed ancestors of targetId. */
export function collapsedAncestorsOf(
  targetId: string,
  collapsedIds: Set<string>,
  parentUnionsByChild: Map<string, string[]>,
  partnerOf: (unionId: string) => string[],
): string[] {
  const ancestors = new Set<string>();
  const visited = new Set<string>([targetId]);
  const queue = [targetId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const pu of parentUnionsByChild.get(cur) ?? []) {
      for (const parent of partnerOf(pu)) {
        if (!visited.has(parent)) {
          visited.add(parent);
          ancestors.add(parent);
          queue.push(parent);
        }
      }
    }
  }
  return [...collapsedIds].filter((id) => ancestors.has(id));
}
