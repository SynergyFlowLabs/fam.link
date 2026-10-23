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
 * Layout (the "hourglass" used by mature genealogy tools): generations are
 * assigned BLOOD-FIRST (ancestors above, descendants below, spouses inherit
 * their partner's row — so a sibship never splits across rows), and
 * coordinates come from a tidy two-sided packing:
 *
 *  - Units are spouse chains: a person plus every same-generation partner
 *    sit side by side as one placement unit (remarriage included).
 *  - Every unit except the focus's hangs from ONE anchor — the family whose
 *    midpoint it centers under (children), or the direct child it sits
 *    exactly above (ancestors) — chosen by BFS from the focus so blood
 *    structure dominates.
 *  - Ancestor units align exactly over their direct-line child; that
 *    child's siblings flank OUTBOARD (older siblings left, younger right),
 *    which keeps cousin lines from crossing the direct line.
 *  - Sibships pack under their family's midpoint; a whole sibship shifts
 *    atomically when a row is genuinely full, so families never interleave.
 *  - Same-row overlaps are impossible by construction (per-row interval
 *    registry, checked on every placement).
 */

export interface LayoutPerson {
  id: string;
  /** Optional birth text ("1918", "c. 570") — orders siblings; no other use. */
  birthHint?: string | null;
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
  personById: Map<string, LayoutPerson>;
}

function buildGraph(input: LayoutInput): Graph {
  const childrenByUnion = new Map<string, string[]>();
  const parentUnionsByChild = new Map<string, string[]>();
  const unionsByPerson = new Map<string, string[]>();
  const unionById = new Map<string, LayoutUnion>();
  const personById = new Map<string, LayoutPerson>();

  for (const p of input.persons) personById.set(p.id, p);
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
    if (!unionById.has(l.unionId) || !personById.has(l.childId)) continue;
    const list = childrenByUnion.get(l.unionId) ?? [];
    if (!list.includes(l.childId)) list.push(l.childId);
    childrenByUnion.set(l.unionId, list);
    const pl = parentUnionsByChild.get(l.childId) ?? [];
    if (!pl.includes(l.unionId)) pl.push(l.unionId);
    parentUnionsByChild.set(l.childId, pl);
  }
  return {
    childrenByUnion,
    parentUnionsByChild,
    unionsByPerson,
    unionById,
    personById,
  };
}

function partnersOf(g: Graph, unionId: string): string[] {
  const u = g.unionById.get(unionId);
  if (!u) return [];
  return u.partnerBId ? [u.partnerAId, u.partnerBId] : [u.partnerAId];
}

/** Rough birth year for sibling ordering — fuzzy text welcome. */
export function birthYearOf(person: { birthHint?: string | null }): number {
  const hint = person.birthHint;
  if (!hint) return Number.POSITIVE_INFINITY;
  const m = hint.match(/\d{3,4}/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

/**
 * Generation relative to the focus person — the "hourglass" rule, in four
 * phases so a sibship can never split across rows:
 *
 *  A. Ancestors: BFS UP from the focus over parent unions → −distance.
 *  B. Descendants: BFS DOWN over child unions → +distance. (Runs before
 *     collaterals so a grandchild's row wins over a cousin reading.)
 *  C. Collaterals: waves spreading DOWN from everyone already assigned —
 *     uncles, cousins, their children. A child of parents in different
 *     generations takes the deeper parent's row + 1 (so the grandchild of
 *     the focus via a cross-row marriage lands with the grandchildren).
 *  D. In-laws: spouses inherit their partner's row, then their own blood
 *     follows by the same waves. Write-once, input order — deterministic.
 *
 * The bow-tie case (a cousin who is also a son-in-law) keeps his collateral
 * row — he sits with his sibship and his marriage draws as a cross-row
 * couple connector, instead of dragging his parents into the wrong row.
 */
export function assignGenerations(input: LayoutInput): Map<string, number> {
  const g = buildGraph(input);
  const gen = new Map<string, number>();
  if (!g.personById.has(input.focusPersonId)) {
    for (const p of input.persons) gen.set(p.id, 0);
    return gen;
  }

  // A. ancestors (BFS up)
  gen.set(input.focusPersonId, 0);
  let queue = [input.focusPersonId];
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi];
    for (const pu of g.parentUnionsByChild.get(id) ?? []) {
      for (const parent of partnersOf(g, pu)) {
        if (!gen.has(parent)) {
          gen.set(parent, (gen.get(id) as number) - 1);
          queue.push(parent);
        }
      }
    }
  }

  // B. descendants (BFS down)
  queue = [input.focusPersonId];
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi];
    for (const u of g.unionsByPerson.get(id) ?? []) {
      for (const c of g.childrenByUnion.get(u) ?? []) {
        if (!gen.has(c)) {
          gen.set(c, (gen.get(id) as number) + 1);
          queue.push(c);
        }
      }
    }
  }

  // spread-down helper with the deeper-parent rule
  const tryChild = (child: string, fromGen: number, fromId: string): boolean => {
    if (gen.has(child)) return false;
    // a child of parents in different rows follows the deeper parent
    for (const pu of g.parentUnionsByChild.get(child) ?? []) {
      for (const other of partnersOf(g, pu)) {
        if (other !== fromId && gen.has(other) && (gen.get(other) as number) > fromGen) {
          return false; // the deeper parent (or a later wave) places them
        }
      }
    }
    gen.set(child, fromGen + 1);
    return true;
  };

  // C + D: waves over everyone assigned, in input order, until fixpoint.
  // Spouses inherit, children follow (deeper parent wins), parents of
  // in-laws follow upward.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < input.persons.length + 4) {
    changed = false;
    for (const p of input.persons) {
      const pg = gen.get(p.id);
      if (pg === undefined) continue;
      for (const u of g.unionsByPerson.get(p.id) ?? []) {
        for (const partner of partnersOf(g, u)) {
          if (partner !== p.id && !gen.has(partner)) {
            gen.set(partner, pg);
            changed = true;
          }
        }
        for (const c of g.childrenByUnion.get(u) ?? []) {
          if (tryChild(c, pg, p.id)) changed = true;
        }
      }
      for (const pu of g.parentUnionsByChild.get(p.id) ?? []) {
        for (const parent of partnersOf(g, pu)) {
          if (!gen.has(parent)) {
            gen.set(parent, pg - 1);
            changed = true;
          }
        }
      }
    }
  }

  for (const p of input.persons) if (!gen.has(p.id)) gen.set(p.id, 0);
  return gen;
}

/* ------------------------------------------------------------------ units */

interface Unit {
  id: string;
  members: string[]; // left-to-right
  width: number;
}

interface Family {
  unionId: string;
  ownerUnitIds: Set<string>;
  anchorUnit: Unit | null; // the owner unit the children hang from
  childUnits: Unit[];
}

type Anchor =
  | { type: "root" }
  | { type: "family"; family: Family }
  | { type: "member"; member: string };

export function layoutTree(input: LayoutInput): LayoutResult {
  const g = buildGraph(input);
  const gen = assignGenerations(input);
  const minGen = Math.min(...gen.values());
  const maxGen = Math.max(...gen.values());

  // BFS visit order from focus (parents, spouses, children) — stable
  // ordering and tie-breaks.
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
  const inputIndex = new Map<string, number>();
  input.persons.forEach((p, i) => inputIndex.set(p.id, i));

  /* Units: connected chains of same-generation partners, members ordered by
   * visit index (focus-ward member first). Cross-row couples stay separate
   * units — their connector is drawn as a soft S-curve. */
  const unitOf = new Map<string, Unit>();
  const units: Unit[] = [];
  const sameGenSpouses = new Map<string, Set<string>>();
  for (const u of input.unions) {
    const a = u.partnerAId;
    const b = u.partnerBId;
    if (!b || gen.get(a) !== gen.get(b)) continue;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const s = sameGenSpouses.get(x) ?? new Set<string>();
      s.add(y);
      sameGenSpouses.set(x, s);
    }
  }
  for (const p of input.persons) {
    if (unitOf.has(p.id)) continue;
    const chain: string[] = [];
    const chainSeen = new Set<string>([p.id]);
    const q = [p.id];
    while (q.length > 0) {
      const id = q.shift() as string;
      chain.push(id);
      for (const n of sameGenSpouses.get(id) ?? []) {
        if (!chainSeen.has(n)) {
          chainSeen.add(n);
          q.push(n);
        }
      }
    }
    // Path order: a remarried partner sits BETWEEN their spouses. Walk the
    // chain from one endpoint (a member with a single in-chain spouse);
    // cycles fall back to visit order.
    const deg = (id: string) =>
      [...(sameGenSpouses.get(id) ?? [])].filter((n) => chainSeen.has(n)).length;
    const endpoints = chain.filter((id) => deg(id) === 1);
    let ordered = chain;
    if (endpoints.length === 2) {
      const start =
        (inputIndex.get(endpoints[0]) ?? 0) <= (inputIndex.get(endpoints[1]) ?? 0)
          ? endpoints[0]
          : endpoints[1];
      ordered = [start];
      const used = new Set<string>([start]);
      let cur = start;
      while (true) {
        const next = [...(sameGenSpouses.get(cur) ?? [])].find((n) => !used.has(n));
        if (!next) break;
        ordered.push(next);
        used.add(next);
        cur = next;
      }
    } else {
      ordered = chain.sort(
        (a, b) => (visitIndex.get(a) as number) - (visitIndex.get(b) as number),
      );
    }
    const unit: Unit = {
      id: `unit:${ordered[0]}`,
      members: ordered,
      width: ordered.length * NODE_W + (ordered.length - 1) * COUPLE_GAP,
    };
    for (const m of ordered) unitOf.set(m, unit);
    units.push(unit);
  }

  const unitRow = (u: Unit): number => gen.get(u.members[0]) as number;

  /* Families: unions with children. */
  const familyByUnion = new Map<string, Family>();
  for (const u of input.unions) {
    const kids = g.childrenByUnion.get(u.id) ?? [];
    if (kids.length === 0) continue;
    const ownerUnitIds = new Set<string>();
    for (const p of partnersOf(g, u.id)) {
      const un = unitOf.get(p);
      if (un) ownerUnitIds.add(un.id);
    }
    familyByUnion.set(u.id, {
      unionId: u.id,
      ownerUnitIds,
      anchorUnit: null,
      childUnits: [],
    });
  }

  /* Anchor BFS over units: parents first, then children (per family).
   * Anchors are GENERATION-CONSISTENT: an up-anchor (parent above a member)
   * requires the parent's row to be exactly one above the member's; a
   * down-anchor requires the child's row to be exactly one below this
   * owner's. Without the guard, a grandson's BFS turn can steal his father
   * (a cross-row-couple parent) and anchor him upward, stranding the
   * father's own sibship. */
  const anchor = new Map<string, Anchor>();
  const focusUnit = unitOf.get(input.focusPersonId) as Unit;
  anchor.set(focusUnit.id, { type: "root" });
  const unitQueue: Unit[] = [focusUnit];
  for (let qi = 0; qi < unitQueue.length; qi++) {
    const u = unitQueue[qi];
    // parent units — each hangs exactly above the member it is a parent of
    for (const m of u.members) {
      for (const puid of g.parentUnionsByChild.get(m) ?? []) {
        for (const parent of partnersOf(g, puid)) {
          const pun = unitOf.get(parent);
          if (!pun || pun.id === u.id || anchor.has(pun.id)) continue;
          if (unitRow(pun) !== (gen.get(m) as number) - 1) continue;
          anchor.set(pun.id, { type: "member", member: m });
          unitQueue.push(pun);
        }
      }
    }
    // families owned here + their child units
    for (const m of u.members) {
      for (const unionId of g.unionsByPerson.get(m) ?? []) {
        const fam = familyByUnion.get(unionId);
        if (!fam) continue;
        if (fam.anchorUnit === null && fam.ownerUnitIds.has(u.id)) {
          fam.anchorUnit = u;
        }
        for (const kid of g.childrenByUnion.get(unionId) ?? []) {
          const ku = unitOf.get(kid);
          if (!ku || anchor.has(ku.id)) continue;
          if (unitRow(ku) !== unitRow(u) + 1) continue;
          anchor.set(ku.id, { type: "family", family: fam });
          if (!fam.childUnits.includes(ku)) fam.childUnits.push(ku);
          unitQueue.push(ku);
        }
      }
    }
  }
  // Second chance: families never claimed and units never reached. Try to
  // find a generation-consistent anchor before falling back to "root".
  for (const fam of familyByUnion.values()) {
    if (fam.anchorUnit !== null) continue;
    const owner = units
      .filter((x) => fam.ownerUnitIds.has(x.id))
      .sort(
        (a, b) =>
          (visitIndex.get(a.members[0]) as number) -
          (visitIndex.get(b.members[0]) as number),
      )[0];
    if (owner) {
      fam.anchorUnit = owner;
      for (const kid of g.childrenByUnion.get(fam.unionId) ?? []) {
        const ku = unitOf.get(kid);
        if (ku && !anchor.has(ku.id) && unitRow(ku) === unitRow(owner) + 1) {
          anchor.set(ku.id, { type: "family", family: fam });
          if (!fam.childUnits.includes(ku)) fam.childUnits.push(ku);
        }
      }
    }
  }
  for (const u of units) {
    if (anchor.has(u.id)) continue;
    // any consistent family it is a child of?
    let done = false;
    for (const m of u.members) {
      for (const puid of g.parentUnionsByChild.get(m) ?? []) {
        const fam = familyByUnion.get(puid);
        if (!fam || fam.anchorUnit === null) continue;
        if (unitRow(u) === unitRow(fam.anchorUnit) + 1) {
          anchor.set(u.id, { type: "family", family: fam });
          if (!fam.childUnits.includes(u)) fam.childUnits.push(u);
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (done) continue;
    // any consistent member it is a parent of?
    for (const m of u.members) {
      for (const unionId of g.unionsByPerson.get(m) ?? []) {
        for (const kid of g.childrenByUnion.get(unionId) ?? []) {
          if (unitRow(u) === (gen.get(kid) as number) - 1) {
            anchor.set(u.id, { type: "member", member: kid });
            done = true;
            break;
          }
        }
        if (done) break;
      }
      if (done) break;
    }
    if (!done) anchor.set(u.id, { type: "root" });
  }

  // Sibship order: birth year (fuzzy), then visit order.
  const siblingsOf = (fam: Family): Unit[] =>
    fam.childUnits
      .filter((a, i) => fam.childUnits.indexOf(a) === i)
      .sort((a, b) => {
        const ya = Math.min(
          ...a.members.map((m) => birthYearOf(g.personById.get(m) ?? {})),
        );
        const yb = Math.min(
          ...b.members.map((m) => birthYearOf(g.personById.get(m) ?? {})),
        );
        if (ya !== yb) return ya - yb;
        return (
          (inputIndex.get(a.members[0]) ?? 0) -
          (inputIndex.get(b.members[0]) ?? 0)
        );
      });

  /* ------------------------------------------------------------- placement */

  const pos = new Map<string, number>(); // personId -> x center
  const intervals = new Map<number, { l: number; r: number }[]>();
  const placedUnits = new Set<string>();
  const pendingFamilies: Family[] = [];

  /** Minimal shift (whole block) so [left, left+width] is free in `row`. */
  function freeShift(row: number, left: number, width: number): number {
    let l = left;
    for (let round = 0; round < 64; round++) {
      const list = (intervals.get(row) ?? []).slice().sort((a, b) => a.l - b.l);
      const hits = list.filter(
        (it) => l < it.r + SIBLING_GAP && it.l < l + width + SIBLING_GAP,
      );
      if (hits.length === 0) return l - left;
      const maxR = Math.max(...hits.map((h) => h.r));
      const minL = Math.min(...hits.map((h) => h.l));
      const shiftRight = Math.abs(maxR + SIBLING_GAP - l);
      const shiftLeft = Math.abs(minL - SIBLING_GAP - (l + width));
      l = shiftRight <= shiftLeft ? maxR + SIBLING_GAP : minL - SIBLING_GAP - width;
    }
    // pathological rows: append far right
    const list = (intervals.get(row) ?? []).slice().sort((a, b) => a.l - b.l);
    const farR = list.length ? Math.max(...list.map((i2) => i2.r)) : l;
    return farR + SIBLING_GAP - left;
  }

  function placeUnit(u: Unit, centerX: number): void {
    const row = unitRow(u);
    const left =
      centerX - u.width / 2 + freeShift(row, centerX - u.width / 2, u.width);
    intervals.set(row, [
      ...(intervals.get(row) ?? []),
      { l: left, r: left + u.width },
    ]);
    u.members.forEach((m, i) => {
      pos.set(m, left + NODE_W / 2 + i * (NODE_W + COUPLE_GAP));
    });
  }

  /**
   * Anchor x of a family: midpoint of its partners. Two-partner unions wait
   * for both partners (a cross-row couple's children center under the true
   * couple midpoint); `force` accepts whatever is placed, for leftovers.
   */
  function familyAnchorX(fam: Family, force: boolean): number | null {
    const ps = partnersOf(g, fam.unionId);
    const placed = ps.filter((p) => pos.has(p));
    if (placed.length === 0) return null;
    if (placed.length < ps.length && !force) return null;
    if (placed.length === 1) return pos.get(placed[0]) as number;
    return (
      ((pos.get(placed[0]) as number) + (pos.get(placed[1]) as number)) / 2
    );
  }

  function placeSibship(fam: Family, force = false): boolean {
    if (!fam.anchorUnit || !placedUnits.has(fam.anchorUnit.id)) return false;
    const anchorX = familyAnchorX(fam, force);
    if (anchorX === null) return false;
    const sibs = siblingsOf(fam);
    const toPlace = sibs.filter((s) => !placedUnits.has(s.id));
    if (toPlace.length === 0) return true;

    // Ancestor-side family? The unit that anchors it hangs above a direct
    // child already sitting in this sibship's row — flank the siblings
    // outboard of that child instead of packing over it.
    const ownerAnchor = anchor.get(fam.anchorUnit.id);
    if (ownerAnchor && ownerAnchor.type === "member") {
      const dcUnit = unitOf.get(ownerAnchor.member);
      const row = unitRow(toPlace[0]);
      if (dcUnit && placedUnits.has(dcUnit.id) && unitRow(dcUnit) === row) {
        const dcCenter = pos.get(dcUnit.members[0]) as number;
        const dcLeft = dcCenter - dcUnit.width / 2;
        const dcRight = dcCenter + dcUnit.width / 2;
        // sibship keeps birth order with the direct child at its own
        // position: siblings born before it pack left, after it right
        const keyOf = (u: Unit): [number, number] => [
          Math.min(...u.members.map((m) => birthYearOf(g.personById.get(m) ?? {}))),
          inputIndex.get(u.members[0]) ?? 0,
        ];
        const dcKey = keyOf(dcUnit);
        const before: Unit[] = [];
        const after: Unit[] = [];
        for (const s of toPlace) {
          const k = keyOf(s);
          const cmp = k[0] !== dcKey[0] ? k[0] - dcKey[0] : k[1] - dcKey[1];
          (cmp < 0 ? before : after).push(s);
        }
        let cursor = dcRight + SIBLING_GAP;
        for (const s of after) {
          placeUnit(s, cursor + s.width / 2);
          placedUnits.add(s.id);
          cursor += s.width + SIBLING_GAP;
        }
        cursor = dcLeft - SIBLING_GAP;
        for (const s of [...before].reverse()) {
          placeUnit(s, cursor - s.width / 2);
          placedUnits.add(s.id);
          cursor -= s.width + SIBLING_GAP;
        }
        for (const s of [...after, ...before]) placeDependents(s);
        return true;
      }
    }

    // Normal sibship: pack left-to-right under the family midpoint.
    const row = unitRow(toPlace[0]);
    const total =
      toPlace.reduce((s, u) => s + u.width, 0) +
      (toPlace.length - 1) * SIBLING_GAP;
    let left = anchorX - total / 2 + freeShift(row, anchorX - total / 2, total);
    for (const s of toPlace) {
      placeUnit(s, left + s.width / 2);
      placedUnits.add(s.id);
      left += s.width + SIBLING_GAP;
    }
    for (const s of toPlace) placeDependents(s);
    return true;
  }

  function placeDependents(u: Unit): void {
    const ancestorSide = anchor.get(u.id)?.type === "member";
    if (ancestorSide) {
      placeUp(u);
      placeDown(u);
    } else {
      placeDown(u);
      placeUp(u);
    }
  }

  /** Parent units above each member — aligned over their direct child. */
  function placeUp(u: Unit): void {
    for (const m of u.members) {
      for (const puid of g.parentUnionsByChild.get(m) ?? []) {
        for (const parent of partnersOf(g, puid)) {
          const pun = unitOf.get(parent);
          if (!pun || pun.id === u.id || placedUnits.has(pun.id)) continue;
          const a = anchor.get(pun.id);
          // this unit hangs above a member of ours only if the anchor says so
          if (!a || a.type !== "member" || a.member !== m) continue;
          const mx = pos.get(m) as number;
          let center = mx;
          const ps = partnersOf(g, puid);
          const inUnit = ps.filter((p) => unitOf.get(p)?.id === pun.id);
          const memberOffset = (id: string) => {
            const i = pun.members.indexOf(id);
            return i < 0 ? 0 : NODE_W / 2 + i * (NODE_W + COUPLE_GAP) - pun.width / 2;
          };
          if (inUnit.length === 2) {
            // couple inside the unit: union midpoint over the child
            const off =
              (memberOffset(inUnit[0]) + memberOffset(inUnit[1])) / 2;
            center = mx - off;
          } else if (inUnit.length === 1 && ps.length === 2) {
            // cross-row parent couple: midpoint of both partners over the child
            const other = ps.find((p) => unitOf.get(p)?.id !== pun.id) as string;
            if (pos.has(other)) {
              center = 2 * mx - (pos.get(other) as number) - memberOffset(inUnit[0]);
            }
          }
          placeUnit(pun, center);
          placedUnits.add(pun.id);
          placeDependents(pun);
        }
      }
    }
  }

  /** Families this unit anchors (children below). */
  function placeDown(u: Unit): void {
    for (const m of u.members) {
      for (const unionId of g.unionsByPerson.get(m) ?? []) {
        const fam = familyByUnion.get(unionId);
        if (!fam || fam.anchorUnit?.id !== u.id) continue;
        if (!placeSibship(fam)) pendingFamilies.push(fam);
      }
    }
  }

  // Root: the focus unit, then everything hangs off it.
  placeUnit(focusUnit, 0);
  placedUnits.add(focusUnit.id);
  placeDependents(focusUnit);

  // Families whose partners only became placeable later — run to fixpoint.
  const drainPending = () => {
    for (let round = 0; round < 8 && pendingFamilies.length > 0; round++) {
      let progress = false;
      for (let i = 0; i < pendingFamilies.length; i++) {
        if (placeSibship(pendingFamilies[i])) {
          pendingFamilies.splice(i, 1);
          i--;
          progress = true;
        }
      }
      if (!progress) break;
    }
  };
  drainPending();

  // Units nothing anchored (disconnected or exotic): place at their anchor
  // point if one was found, else at the origin — then their dependents.
  for (const u of units) {
    if (placedUnits.has(u.id)) continue;
    const a = anchor.get(u.id);
    let center = 0;
    if (a && a.type === "family") {
      center = familyAnchorX(a.family, true) ?? 0;
    } else if (a && a.type === "member") {
      center = pos.get(a.member) ?? 0;
    }
    placeUnit(u, center);
    placedUnits.add(u.id);
    placeDependents(u);
  }
  drainPending();

  // True leftovers (a partner that never placed): place with what we have.
  for (let i = 0; i < pendingFamilies.length; i++) {
    if (placeSibship(pendingFamilies[i], true)) {
      pendingFamilies.splice(i, 1);
      i--;
    }
  }

  /* --------------------------------------------------------------- bounds */

  const xs = input.persons.map((p) => pos.get(p.id) ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const offsetX = PADDING + NODE_W / 2 - minX;
  for (const p of input.persons) {
    pos.set(p.id, (pos.get(p.id) ?? 0) + offsetX);
  }
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
