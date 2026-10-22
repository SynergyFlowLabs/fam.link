/**
 * Keyboard movement through the chart (F-3.4).
 *
 * The chart is a set of absolutely positioned cards, so "next card" is not a DOM question. Movement
 * follows the relationships a person actually has — up to a parent, down to a child, left/right to a
 * partner — and falls back to reading order when there is no such relative. Keeping this pure means
 * the behaviour can be tested without a browser, and the outline view stays the complete fallback.
 */

export interface NavEdge {
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly kind: string;
}

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export type NavRelation = 'parent' | 'child' | 'partner';

export function relationTo(edges: readonly NavEdge[], fromId: string, toId: string): NavRelation | undefined {
  for (const edge of edges) {
    if (edge.fromPersonId !== fromId && edge.toPersonId !== fromId) continue;
    const other = edge.fromPersonId === fromId ? edge.toPersonId : edge.fromPersonId;
    if (other !== toId) continue;
    if (edge.kind === 'spouse' || edge.kind === 'former-spouse' || edge.kind === 'partner') return 'partner';
    return edge.fromPersonId === fromId ? 'child' : 'parent';
  }
  return undefined;
}

export function neighboursOf(
  edges: readonly NavEdge[],
  fromId: string,
  present?: ReadonlySet<string>,
): Array<{ id: string; relation: NavRelation }> {
  const seen = new Set<string>();
  const result: Array<{ id: string; relation: NavRelation }> = [];
  for (const edge of edges) {
    if (edge.fromPersonId !== fromId && edge.toPersonId !== fromId) continue;
    const other = edge.fromPersonId === fromId ? edge.toPersonId : edge.fromPersonId;
    if (other === fromId || seen.has(other)) continue;
    if (present && !present.has(other)) continue;
    seen.add(other);
    const relation = relationTo(edges, fromId, other);
    if (relation) result.push({ id: other, relation });
  }
  return result;
}

export interface NavigationInput {
  readonly edges: readonly NavEdge[];
  /** Visible ids in reading order (top to bottom, left to right). */
  readonly ordered: readonly string[];
  readonly fromId: string;
  readonly direction: NavDirection;
  readonly present?: ReadonlySet<string>;
}

/**
 * The id to move keyboard focus to, or undefined when there is nowhere to go. Returning undefined
 * instead of wrapping keeps the tree from trapping focus in a cycle.
 */
export function nextNodeId({ edges, ordered, fromId, direction, present }: NavigationInput): string | undefined {
  const neighbours = neighboursOf(edges, fromId, present);

  if (direction === 'up') return neighbours.find((entry) => entry.relation === 'parent')?.id;
  if (direction === 'down') return neighbours.find((entry) => entry.relation === 'child')?.id;

  const index = ordered.indexOf(fromId);
  const inDirection = (id: string): boolean =>
    direction === 'right' ? ordered.indexOf(id) > index : ordered.indexOf(id) < index;

  // Partners first, but only if one actually lies in the direction asked for; otherwise move through
  // the row in reading order so the arrow key never appears to do nothing.
  const partners = neighbours.filter((entry) => entry.relation === 'partner').map((entry) => entry.id);
  const partner = direction === 'right' ? partners.find(inDirection) : [...partners].reverse().find(inDirection);
  if (partner) return partner;

  return direction === 'right' ? ordered.find(inDirection) : [...ordered].reverse().find(inDirection);
}
