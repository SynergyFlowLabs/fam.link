/**
 * fam.link family-tree layout engine.
 *
 * Pure, deterministic, React-free. The seam under test.
 *
 * Model: a person-centric DAG. Children attach to unions; unions have up to
 * two partners (partnerB nullable — single-parent families are first-class).
 * Pedigree collapse (cousin marriages) means one human is one node, reachable
 * via multiple paths.
 *
 * Layout: generations relative to the focus person (ancestors above at -1,
 * -2, …; descendants below at +1, +2, …; in-laws inherit their partner's
 * generation). Rows are processed focus-outward: row 0, then upward rows,
 * then downward rows. Couples in the same row form a single placement unit.
 * Families (units sharing a parent union) cluster and center under their
 * parents' union midpoint.
 */

export interface LayoutPerson {
  id: string;
}

export interface LayoutUnion {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
}

export interface LayoutLink {
  unionId: string;
  childId: string;
}

export interface LayoutInput {
  persons: LayoutPerson[];
  unions: LayoutUnion[];
  links: LayoutLink[];
  focusPersonId: string;
}

export interface LayoutNode {
  id: string;
  x: number; // center
  y: number; // center
  generation: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  width: number;
  height: number;
  focusX: number;
  focusY: number;
}

export const NODE_W = 172;
export const NODE_H = 74;
export const COUPLE_GAP = 24;
export const SIBLING_GAP = 34;
export const ROW_GAP = 128;
export const PADDING = 90;

interface Graph {
  childrenByUnion: Map<string, string[]>;
  parentUnionsByChild: Map<string, string[]>;
  unionsByPerson: Map<string, string[]>;
  unionById: Map<string, LayoutUnion>;
}

function buildGraph(input: LayoutInput): Graph {
  const childrenByUnion = new Map<string, string[]>();
  const parentUnionsByChild = new Map<string, string[]>();
  const unionsByPerson = new Map<string, string[]>();
  const unionById = new Map<string, LayoutUnion>();

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
    list.push(l.childId);
    childrenByUnion.set(l.unionId, list);
    const pl = parentUnionsByChild.get(l.childId) ?? [];
    pl.push(l.unionId);
    parentUnionsByChild.set(l.childId, pl);
  }
  return { childrenByUnion, parentUnionsByChild, unionsByPerson, unionById };
}

function partnersOf(g: Graph, unionId: string): string[] {
  const u = g.unionById.get(unionId);
  if (!u) return [];
  return u.partnerBId ? [u.partnerAId, u.partnerBId] : [u.partnerAId];
}

/**
 * Assign every person a generation relative to the focus person:
 * parent → gen-1, child → gen+1, spouse → same gen. First assignment wins
 * (write-once), iterated to a fixpoint over the persons in input order —
 * deterministic. Disconnected persons land at 0.
 */
export function assignGenerations(input: LayoutInput): Map<string, number> {
  const g = buildGraph(input);
  const gen = new Map<string, number>([[input.focusPersonId, 0]]);
  const maxIter = input.persons.length * 2 + 10;
  let changed = true;
  let iter = 0;
  while (changed && iter++ < maxIter) {
    changed = false;
    for (const p of input.persons) {
      const pg = gen.get(p.id);
      if (pg === undefined) continue;
      for (const pu of g.parentUnionsByChild.get(p.id) ?? []) {
        for (const parent of partnersOf(g, pu)) {
          if (!gen.has(parent)) {
            gen.set(parent, pg - 1);
            changed = true;
          }
        }
      }
      for (const u of g.unionsByPerson.get(p.id) ?? []) {
        for (const child of g.childrenByUnion.get(u) ?? []) {
          if (!gen.has(child)) {
            gen.set(child, pg + 1);
            changed = true;
          }
        }
        for (const spouse of partnersOf(g, u)) {
          if (spouse !== p.id && !gen.has(spouse)) {
            gen.set(spouse, pg);
            changed = true;
          }
        }
      }
    }
  }
  for (const p of input.persons) if (!gen.has(p.id)) gen.set(p.id, 0);
  return gen;
}

interface Unit {
  id: string;
  members: string[]; // left-to-right
  width: number;
  primaryParentUnion: string | null;
  desired: number | null;
  left: number;
}

export function layoutTree(input: LayoutInput): LayoutResult {
  const g = buildGraph(input);
  const gen = assignGenerations(input);
  const minGen = Math.min(...gen.values());
  const maxGen = Math.max(...gen.values());

  // BFS visit order from focus (parents, then spouses, then children) —
  // used for stable ordering and tie-breaks.
  const seen = new Set<string>([input.focusPersonId]);
  const queue = [input.focusPersonId];
  const visitOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    visitOrder.push(id);
    const neighbors: string[] = [];
    for (const pu of g.parentUnionsByChild.get(id) ?? []) {
      neighbors.push(...partnersOf(g, pu));
    }
    for (const u of g.unionsByPerson.get(id) ?? []) {
      for (const p of partnersOf(g, u)) if (p !== id) neighbors.push(p);
    }
    for (const u of g.unionsByPerson.get(id) ?? []) {
      neighbors.push(...(g.childrenByUnion.get(u) ?? []));
    }
    for (const n of neighbors) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  for (const p of input.persons) {
    if (!seen.has(p.id)) visitOrder.push(p.id);
  }
  const visitIndex = new Map(visitOrder.map((id, i) => [id, i] as const));

  // Couple units: same-row partners of the earliest unions merge into one
  // placement unit. Remarried persons join their first union's unit.
  const unitOf = new Map<string, string>();
  const unitsByRow = new Map<number, Unit[]>();
  const allUnits: Unit[] = [];
  for (const u of input.unions) {
    const a = u.partnerAId;
    const b = u.partnerBId;
    if (
      b &&
      gen.get(a) === gen.get(b) &&
      !unitOf.has(a) &&
      !unitOf.has(b)
    ) {
      const unit: Unit = {
        id: `u:${u.id}`,
        members: [a, b],
        width: 2 * NODE_W + COUPLE_GAP,
        primaryParentUnion: null,
        desired: null,
        left: 0,
      };
      unitOf.set(a, unit.id);
      unitOf.set(b, unit.id);
      allUnits.push(unit);
    }
  }
  for (const p of input.persons) {
    if (!unitOf.has(p.id)) {
      const unit: Unit = {
        id: `s:${p.id}`,
        members: [p.id],
        width: NODE_W,
        primaryParentUnion: null,
        desired: null,
        left: 0,
      };
      unitOf.set(p.id, unit.id);
      allUnits.push(unit);
    }
  }
  for (const unit of allUnits) {
    const r = gen.get(unit.members[0]) as number;
    const list = unitsByRow.get(r) ?? [];
    list.push(unit);
    unitsByRow.set(r, list);
  }

  const pos = new Map<string, number>(); // personId -> x center
  const unionMid = new Map<string, number>(); // unionId -> midpoint (set when partners' row is placed)

  // Row processing order: focus row, then upward rows, then downward rows.
  const rowOrder: number[] = [0];
  for (let r = -1; r >= minGen; r--) rowOrder.push(r);
  for (let r = 1; r <= maxGen; r++) rowOrder.push(r);
  const rowsToProcess = Array.from(
    new Set(rowOrder.filter((r) => unitsByRow.has(r))),
  );

  for (const r of rowsToProcess) {
    const units = unitsByRow.get(r) as Unit[];

    for (const unit of units) {
      const anchors: number[] = [];
      let primary: string | null = null;
      for (const m of unit.members) {
        for (const pu of g.parentUnionsByChild.get(m) ?? []) {
          const mid = unionMid.get(pu);
          if (mid !== undefined) {
            anchors.push(mid);
            if (primary === null) primary = pu;
          }
        }
        // child anchors: children already placed (upward rows / in-law roots)
        for (const u of g.unionsByPerson.get(m) ?? []) {
          const kids = (g.childrenByUnion.get(u) ?? []).filter((c) =>
            pos.has(c),
          );
          if (kids.length > 0) {
            const centroid =
              kids.reduce((s, c) => s + (pos.get(c) as number), 0) / kids.length;
            anchors.push(centroid);
          }
        }
      }
      unit.desired =
        anchors.length > 0
          ? anchors.reduce((s, a) => s + a, 0) / anchors.length
          : null;
      unit.primaryParentUnion = primary;
    }

    // Place: anchored units first (by desired, then visit order), then free
    // units (visit order).
    const anchored = units
      .filter((u) => u.desired !== null)
      .sort(
        (a, b) =>
          (a.desired as number) - (b.desired as number) ||
          (visitIndex.get(a.members[0]) as number) -
            (visitIndex.get(b.members[0]) as number),
      );
    const free = units
      .filter((u) => u.desired === null)
      .sort(
        (a, b) =>
          (visitIndex.get(a.members[0]) as number) -
          (visitIndex.get(b.members[0]) as number),
      );

    let cursor = PADDING;
    for (const unit of [...anchored, ...free]) {
      const desiredLeft =
        unit.desired === null ? cursor : unit.desired - unit.width / 2;
      unit.left = Math.max(desiredLeft, cursor);
      cursor = unit.left + unit.width + SIBLING_GAP;
      unit.members.forEach((m, i) => {
        pos.set(m, unit.left + NODE_W / 2 + i * (NODE_W + COUPLE_GAP));
      });
    }

    // Recenter family clusters under their parents' union midpoint.
    const placed = [...anchored]; // in left-to-right order
    const clusters: Unit[][] = [];
    let current: Unit[] = [];
    let currentUnion: string | null = null;
    for (const unit of placed) {
      const pu = unit.primaryParentUnion;
      if (pu !== null && pu === currentUnion) {
        current.push(unit);
      } else {
        if (current.length > 0) clusters.push(current);
        current = [unit];
        currentUnion = pu;
      }
    }
    if (current.length > 0) clusters.push(current);

    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      const unionId = cluster[0].primaryParentUnion;
      if (unionId === null) continue;
      const target = unionMid.get(unionId);
      if (target === undefined) continue;
      const leftEdge = cluster[0].left;
      const rightEdge =
        cluster[cluster.length - 1].left + cluster[cluster.length - 1].width;
      const centroid = (leftEdge + rightEdge) / 2;
      let delta = target - centroid;
      // don't collide with the cluster on our left
      if (ci > 0) {
        const prev = clusters[ci - 1];
        const prevRight =
          prev[prev.length - 1].left + prev[prev.length - 1].width;
        const minLeft = prevRight + SIBLING_GAP;
        delta = Math.max(delta, minLeft - leftEdge);
      }
      if (delta !== 0) {
        for (const unit of cluster) {
          unit.left += delta;
          unit.members.forEach((m, i) => {
            pos.set(m, unit.left + NODE_W / 2 + i * (NODE_W + COUPLE_GAP));
          });
        }
      }
    }

    // Record union midpoints for unions whose partners sit in this row.
    for (const u of input.unions) {
      const a = u.partnerAId;
      const b = u.partnerBId;
      const aHere = gen.get(a) === r && pos.has(a);
      const bHere = b !== null && gen.get(b) === r && pos.has(b);
      if (aHere && bHere) {
        unionMid.set(u.id, ((pos.get(a) as number) + (pos.get(b) as number)) / 2);
      } else if (aHere) {
        unionMid.set(u.id, pos.get(a) as number);
      } else if (bHere) {
        unionMid.set(u.id, pos.get(b) as number);
      }
    }
  }

  // Bounds and node list.
  const xs = input.persons.map((p) => pos.get(p.id) as number);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const width = maxX - minX + NODE_W + 2 * PADDING;
  const height = (maxGen - minGen) * ROW_GAP + NODE_H + 2 * PADDING;
  const yFor = (r: number) => PADDING + NODE_H / 2 + (r - minGen) * ROW_GAP;
  const nodes: LayoutNode[] = input.persons.map((p) => ({
    id: p.id,
    x: pos.get(p.id) as number,
    y: yFor(gen.get(p.id) as number),
    generation: gen.get(p.id) as number,
  }));

  const focusNode = nodes.find((n) => n.id === input.focusPersonId);

  return {
    nodes,
    width: Math.max(width, NODE_W + 2 * PADDING),
    height: Math.max(height, NODE_H + 2 * PADDING),
    focusX: focusNode ? focusNode.x : width / 2,
    focusY: focusNode ? focusNode.y : height / 2,
  };
}
