/**
 * Edge geometry for the tree canvas — pure functions so the relationship
 * lines are unit-testable without React.
 *
 * Routing style: orthogonal "bus" lines with rounded corners, the classic
 * genealogy look. Siblings of one union share the same horizontal bus
 * height, so their runs read as one line. Couple connectors are straight
 * when partners share a row; a soft S-curve sagging toward the middle when
 * pedigree collapse puts them in different rows.
 */

export interface EdgePoint {
  x: number;
  y: number;
}

/** Connector between two partner cards. `nodeW` is the card width. */
export function coupleEdgeD(a: EdgePoint, b: EdgePoint, nodeW: number): string {
  const left = a.x <= b.x ? a : b;
  const right = a.x <= b.x ? b : a;
  const x1Raw = left.x + nodeW / 2;
  const x2Raw = right.x - nodeW / 2;
  // a few units of breathing room from the card borders when there's space
  const inset = x2Raw - x1Raw > 12 ? 3 : 0;
  const x1 = x1Raw + inset;
  const x2 = x2Raw - inset;

  if (Math.abs(a.y - b.y) < 1) {
    return `M ${x1} ${a.y} L ${x2} ${a.y}`;
  }
  // spouses in different rows (pedigree collapse): a soft S toward the middle
  const sag = Math.min(42, Math.abs(a.y - b.y) * 0.4);
  return `M ${x1} ${a.y} C ${x1 + 52} ${a.y + sag}, ${x2 - 52} ${b.y - sag}, ${x2} ${b.y}`;
}

/**
 * Drop from a union point (or a single parent's card) down into a child
 * card: vertical drop, rounded corner onto a horizontal bus at 45% of the
 * gap, rounded corner, vertical drop into the child. Children of the same
 * union share the bus height because it depends only on sy and ty.
 */
export function relationStrokeProps(relation?: string | null): { strokeDasharray?: string; stroke?: string } {
  switch (relation) {
    case "adoptive":
      return { strokeDasharray: "8 5" };
    case "step":
      return { strokeDasharray: "4 6" };
    case "foster":
      return { strokeDasharray: "2 5" };
    case "biological":
    default:
      return {};
  }
}

export function relationLabel(relation?: string | null): string {
  switch (relation) {
    case "adoptive": return "adopted";
    case "step": return "step";
    case "foster": return "foster";
    default: return "biological";
  }
}

export function parentChildEdgeD(
  sx: number,
  sy: number,
  cx: number,
  ty: number,
): string {
  const dx = cx - sx;
  const dy = ty - sy;

  // directly below (or degenerate): a simple drop
  if (Math.abs(dx) < 2 || dy <= 8) {
    return `M ${sx} ${sy} L ${cx} ${ty}`;
  }

  const busY = sy + dy * 0.45;
  const r = Math.min(14, Math.abs(dx) / 2 - 1, dy * 0.45 - 1, dy * 0.55 - 1);

  if (r < 2) {
    // too tight for rounded corners — a plain elbow
    return `M ${sx} ${sy} L ${sx} ${busY} L ${cx} ${busY} L ${cx} ${ty}`;
  }

  const dir = dx > 0 ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${busY - r}`,
    `Q ${sx} ${busY} ${sx + dir * r} ${busY}`,
    `L ${cx - dir * r} ${busY}`,
    `Q ${cx} ${busY} ${cx} ${busY + r}`,
    `L ${cx} ${ty}`,
  ].join(" ");
}
