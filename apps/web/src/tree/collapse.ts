/**
 * Per-node branch collapse (F-3.3).
 *
 * Collapsing a person hides everything *below* them in the tree — their children and those
 * children's descendants — while keeping the collapsed person on screen so the branch can be
 * reopened. Partners are not descendants: a spouse stays visible even when their shared children are
 * folded away, which is what makes the folded node readable ("Ahmed and Zainab, 4 hidden").
 *
 * Kept pure and separate from the chart so the rule is testable without a browser.
 */

export interface CollapseEdge {
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly kind: string;
}

const PARENT_KINDS = new Set([
  'biological-parent',
  'adoptive-parent',
  'step-parent',
  'foster-parent',
  'guardian',
]);

export function childrenByParent(edges: readonly CollapseEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    if (!PARENT_KINDS.has(edge.kind)) continue;
    const list = map.get(edge.fromPersonId);
    if (list) {
      if (!list.includes(edge.toPersonId)) list.push(edge.toPersonId);
    } else {
      map.set(edge.fromPersonId, [edge.toPersonId]);
    }
  }
  return map;
}

/** Every id that should be hidden because an ancestor is collapsed. The collapsed ids are kept. */
export function hiddenByCollapse(
  edges: readonly CollapseEdge[],
  collapsed: ReadonlySet<string>,
): Set<string> {
  const hidden = new Set<string>();
  if (collapsed.size === 0) return hidden;
  const children = childrenByParent(edges);

  const visit = (personId: string): void => {
    for (const childId of children.get(personId) ?? []) {
      // A child is hidden by an ancestor's collapse even if the child is itself collapsed.
      if (!hidden.has(childId)) {
        hidden.add(childId);
        visit(childId);
      }
    }
  };

  for (const personId of collapsed) visit(personId);
  // A collapsed node itself is never added by its own visit — only by an ancestor's. That is the
  // behaviour we want: folding a parent hides the child card entirely, even if the child is also
  // folded, because there is nothing left to reopen it from.
  return hidden;
}

export interface CollapsibleNode {
  readonly id: string;
}

/** How many people each node hides when collapsed, used for the "+N" badge. */
export function hiddenCounts(
  edges: readonly CollapseEdge[],
  ids: readonly string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, hiddenByCollapse(edges, new Set([id])).size);
  return counts;
}
