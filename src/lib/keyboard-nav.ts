/**
 * Canvas keyboard navigation — pure helpers so the tree is fully navigable
 * without a mouse (issue #30, P2.5).
 *
 * Order = `layout.nodes` order, which the layout engine produces
 * deterministically (top-to-bottom generations, left-to-right siblings), so
 * arrow steps feel stable across visits and layouts.
 */

export interface NavNode {
  id: string;
  generation: number;
}

export type NavDirection = 1 | -1; // 1 = next (Down/Right), -1 = previous (Up/Left)

/**
 * Next visible node in engine order, wrapping at the ends so a keyboard user
 * can keep walking the tree in one key repeat. Null current starts at the
 * first (dir 1) or last (dir -1) node. Single-node trees are stable.
 */
export function stepFocus(
  nodes: NavNode[],
  currentId: string | null,
  dir: NavDirection,
): string | null {
  if (nodes.length === 0) return null;
  const idx = currentId ? nodes.findIndex((n) => n.id === currentId) : -1;
  if (idx === -1) return dir === 1 ? nodes[0].id : nodes[nodes.length - 1].id;
  const next = (idx + dir + nodes.length) % nodes.length;
  return nodes[next].id;
}

/**
 * All visible node ids at the same generation — the `*` shortcut expands
 * every collapsed branch among these siblings (returns them all; the caller
 * removes the ones actually collapsed).
 */
export function siblingsAtGeneration(nodes: NavNode[], generation: number): string[] {
  return nodes.filter((n) => n.generation === generation).map((n) => n.id);
}

/** Shortcut cheat-sheet shown by the `?` toast (order = help listing). */
export const CANVAS_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "← ↑ → ↓", action: "Move between people" },
  { keys: "Enter", action: "Open the person's page" },
  { keys: "*", action: "Expand all branches at this generation" },
  { keys: "Fit", action: "Whole tree in view (button or F)" },
  { keys: "?", action: "Show this help" },
];
