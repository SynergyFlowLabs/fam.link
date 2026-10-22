/**
 * Tree layout, computed as pure functions so it can be tested without a browser.
 *
 * The visualisation never renders the whole graph: the API sends a focus window, and this module
 * turns it into generations and coordinates. Rules:
 *  - generations are relative to the focus (parents above, children below), partners level;
 *  - people are ordered by the position of their parents so branches do not cross needlessly;
 *  - the same person reachable by two paths draws once per path but is keyed by path, keeping
 *    cousin-marriage cases readable instead of collapsing them.
 */

export interface LayoutNodeInput {
  readonly id: string;
  readonly gender?: 'female' | 'male' | 'other' | 'unknown';
}

export interface LayoutEdgeInput {
  readonly id: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly kind: string;
}

export interface PositionedNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly generation: number;
}

export interface LayoutConnector {
  readonly id: string;
  readonly kind: 'parent' | 'partner';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly relationshipKind: string;
}

export interface TreeLayout {
  readonly nodes: ReadonlyMap<string, PositionedNode>;
  readonly connectors: readonly LayoutConnector[];
  readonly width: number;
  readonly height: number;
  readonly generations: number;
}

export const CARD_WIDTH = 176;
export const CARD_HEIGHT = 88;
export const COLUMN_GAP = 28;
export const ROW_GAP = 96;
const MARGIN = 64;

/** Assign each person a generation relative to the focus, tolerating cycles. */
export function assignGenerations(
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[],
  focusId: string,
): Map<string, number> {
  const ids = new Set(nodes.map((node) => node.id));
  const generation = new Map<string, number>();
  for (const node of nodes) generation.set(node.id, Number.NaN);
  if (!ids.has(focusId)) return generation;
  generation.set(focusId, 0);

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnersOf = new Map<string, string[]>();
  for (const edge of edges) {
    if (!ids.has(edge.fromPersonId) || !ids.has(edge.toPersonId)) continue;
    if (edge.kind.endsWith('parent') || edge.kind === 'guardian') {
      push(parentsOf, edge.toPersonId, edge.fromPersonId);
      push(childrenOf, edge.fromPersonId, edge.toPersonId);
    } else {
      push(partnersOf, edge.fromPersonId, edge.toPersonId);
      push(partnersOf, edge.toPersonId, edge.fromPersonId);
    }
  }

  // Relaxation loop: bounded by node count so a cyclic graph always terminates.
  for (let pass = 0; pass < nodes.length + 2; pass += 1) {
    let changed = false;
    for (const node of nodes) {
      const current = generation.get(node.id);
      if (current === undefined || Number.isNaN(current)) continue;
      for (const partner of partnersOf.get(node.id) ?? []) {
        if (Number.isNaN(generation.get(partner)) || generation.get(partner) !== current) {
          if (Number.isNaN(generation.get(partner) ?? Number.NaN)) {
            generation.set(partner, current);
            changed = true;
          }
        }
      }
      for (const parent of parentsOf.get(node.id) ?? []) {
        const existing = generation.get(parent);
        if (existing === undefined || Number.isNaN(existing) || existing !== current - 1) {
          if (existing === undefined || Number.isNaN(existing)) {
            generation.set(parent, current - 1);
            changed = true;
          }
        }
      }
      for (const child of childrenOf.get(node.id) ?? []) {
        const existing = generation.get(child);
        if (existing === undefined || Number.isNaN(existing)) {
          generation.set(child, current + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Anything unreached is placed alongside its partner, or one row below the focus.
  for (const node of nodes) {
    const value = generation.get(node.id);
    if (value === undefined || Number.isNaN(value)) generation.set(node.id, 1);
  }
  return generation;
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function barycenter(
  nodeId: string,
  parents: Map<string, string[]>,
  placed: Map<string, number>,
  fallback: number,
): number {
  const parentsOfNode = parents.get(nodeId) ?? [];
  const positions = parentsOfNode.map((parent) => placed.get(parent)).filter((value): value is number => value !== undefined);
  if (positions.length === 0) return fallback;
  return positions.reduce((total, value) => total + value, 0) / positions.length;
}

export function layoutTree(
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[],
  focusId: string,
): TreeLayout {
  const generation = assignGenerations(nodes, edges, focusId);
  const parents = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind.endsWith('parent') || edge.kind === 'guardian') {
      push(parents, edge.toPersonId, edge.fromPersonId);
    } else {
      push(partners, edge.fromPersonId, edge.toPersonId);
      push(partners, edge.toPersonId, edge.fromPersonId);
    }
  }

  const rows = new Map<number, string[]>();
  for (const node of nodes) {
    const level = generation.get(node.id) ?? 0;
    const row = rows.get(level);
    if (row) row.push(node.id);
    else rows.set(level, [node.id]);
  }

  const columnIndex = new Map<string, number>();
  const levels = [...rows.keys()].sort((left, right) => left - right);

  for (const level of levels) {
    const row = rows.get(level) ?? [];
    // Order by the average position of known parents, then keep partners adjacent.
    const ordered = row
      .map((id, position) => ({
        id,
        key: barycenter(id, parents, columnIndex, position + row.length),
        position,
      }))
      .sort((left, right) => (left.key === right.key ? left.position - right.position : left.key - right.key))
      .map((entry) => entry.id);

    const arranged: string[] = [];
    const seen = new Set<string>();
    for (const id of ordered) {
      if (seen.has(id)) continue;
      arranged.push(id);
      seen.add(id);
      for (const partner of partners.get(id) ?? []) {
        if (!seen.has(partner) && row.includes(partner)) {
          arranged.push(partner);
          seen.add(partner);
        }
      }
    }

    arranged.forEach((id, index) => columnIndex.set(id, index));
    rows.set(level, arranged);
  }

  const minLevel = levels[0] ?? 0;
  const maxLevel = levels[levels.length - 1] ?? 0;
  const widestRow = Math.max(...levels.map((level) => (rows.get(level) ?? []).length), 1);

  const positioned = new Map<string, PositionedNode>();
  for (const level of levels) {
    const row = rows.get(level) ?? [];
    const rowWidth = row.length * CARD_WIDTH + Math.max(0, row.length - 1) * COLUMN_GAP;
    const totalWidth = widestRow * CARD_WIDTH + Math.max(0, widestRow - 1) * COLUMN_GAP;
    const startX = MARGIN + (totalWidth - rowWidth) / 2;

    row.forEach((id, index) => {
      positioned.set(id, {
        id,
        x: startX + index * (CARD_WIDTH + COLUMN_GAP),
        y: MARGIN + (level - minLevel) * (CARD_HEIGHT + ROW_GAP),
        generation: level,
      });
    });
  }

  const connectors: LayoutConnector[] = [];
  for (const edge of edges) {
    const from = positioned.get(edge.fromPersonId);
    const to = positioned.get(edge.toPersonId);
    if (!from || !to) continue;
    if (edge.kind.endsWith('parent') || edge.kind === 'guardian') {
      connectors.push({
        id: edge.id,
        kind: 'parent',
        x1: from.x + CARD_WIDTH / 2,
        y1: from.y + CARD_HEIGHT,
        x2: to.x + CARD_WIDTH / 2,
        y2: to.y,
        relationshipKind: edge.kind,
      });
    } else {
      const [left, right] = from.x <= to.x ? [from, to] : [to, from];
      connectors.push({
        id: edge.id,
        kind: 'partner',
        x1: left.x + CARD_WIDTH,
        y1: left.y + CARD_HEIGHT / 2,
        x2: right.x,
        y2: right.y + CARD_HEIGHT / 2,
        relationshipKind: edge.kind,
      });
    }
  }

  return {
    nodes: positioned,
    connectors,
    width: widestRow * CARD_WIDTH + Math.max(0, widestRow - 1) * COLUMN_GAP + MARGIN * 2,
    height: (maxLevel - minLevel + 1) * (CARD_HEIGHT + ROW_GAP) + MARGIN,
    generations: maxLevel - minLevel + 1,
  };
}

/** Compact initials for people without a photograph. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
